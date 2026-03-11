/**
 * scripts/audit-brand-security.ts
 *
 * Scans src/app/api/brand/ and verifies each POST/PATCH/DELETE handler has:
 *   1. assertCsrf
 *   2. enforceBrandRateLimit
 *   3. An ownership / identity check (brand_id or user.id)
 *
 * Also reports Math.random() usage in security-sensitive contexts
 * (excludes pure UI files: hooks/use-toast*, components/admin/*, brand/ui-kit/demo*).
 *
 * Exit code: 0 if all checks pass, 1 if any issue found.
 */
import { readdir, readFile } from 'fs/promises';
import { join, extname, relative } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

type HttpMethod = 'POST' | 'PATCH' | 'DELETE';

interface RouteCheck {
  file: string;
  method: HttpMethod;
  hasCsrf: boolean;
  hasRateLimit: boolean;
  hasOwnershipCheck: boolean;
}

interface MathRandomIssue {
  file: string;
  line: number;
  snippet: string;
}

// ─── File walker ──────────────────────────────────────────────────────────────

async function walk(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walk(full)));
      } else if (entry.isFile() && extname(entry.name) === '.ts') {
        files.push(full);
      }
    }
  } catch {
    // directory may not exist yet
  }
  return files;
}

// ─── Brand route audit ────────────────────────────────────────────────────────

async function auditBrandRoutes(brandApiDir: string): Promise<RouteCheck[]> {
  const files = await walk(brandApiDir);
  const results: RouteCheck[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');

    const methods: HttpMethod[] = [];
    if (/export\s+async\s+function\s+POST/.test(content)) methods.push('POST');
    if (/export\s+async\s+function\s+PATCH/.test(content)) methods.push('PATCH');
    if (/export\s+async\s+function\s+DELETE/.test(content)) methods.push('DELETE');

    if (methods.length === 0) continue;

    const hasCsrf = /assertCsrf/.test(content);
    const hasRateLimit = /enforceBrandRateLimit/.test(content);
    // Ownership check: brand_id === user.id or user.id comparison or RLS-implicit brand_id eq
    const hasOwnershipCheck =
      /brand_id.*user\.id|user\.id.*brand_id|\.eq\('brand_id'|\.eq\("brand_id"/.test(content);

    for (const method of methods) {
      results.push({ file, method, hasCsrf, hasRateLimit, hasOwnershipCheck });
    }
  }

  return results;
}

// ─── Math.random() scan ───────────────────────────────────────────────────────

/** Files/patterns that are acceptable UI usage — skip them. */
const UI_PATTERNS = [
  /hooks[\\/]use-toast/,
  /components[\\/]admin[\\/]/,
  /brand[\\/]ui-kit[\\/]demo/,
  /\.test\./,
  /\.spec\./,
];

function isUiFile(filePath: string): boolean {
  return UI_PATTERNS.some((re) => re.test(filePath));
}

async function scanMathRandom(srcDir: string): Promise<MathRandomIssue[]> {
  const issues: MathRandomIssue[] = [];

  async function scanDir(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(full);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        if (isUiFile(full)) continue;
        const content = await readFile(full, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (/Math\.random\(\)/.test(line)) {
            issues.push({ file: full, line: idx + 1, snippet: line.trim().slice(0, 120) });
          }
        });
      }
    }
  }

  await scanDir(srcDir);
  return issues;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const cwd = process.cwd();
  const brandApiDir = join(cwd, 'src/app/api/brand');
  const srcDir = join(cwd, 'src');

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  ClipRace — Brand Security Audit');
  console.log('════════════════════════════════════════════════════════\n');

  // ── 1. Brand route checks ──────────────────────────────────────────────────
  console.log('📂  Scanning src/app/api/brand/ …\n');
  const routeChecks = await auditBrandRoutes(brandApiDir);

  let routesFailed = 0;

  if (routeChecks.length === 0) {
    console.log('  ℹ️  No POST/PATCH/DELETE handlers found in api/brand/ yet.\n');
  } else {
    for (const check of routeChecks) {
      const rel = relative(cwd, check.file);
      const allOk = check.hasCsrf && check.hasRateLimit && check.hasOwnershipCheck;

      if (allOk) {
        console.log(`  ✅  ${rel} [${check.method}]`);
      } else {
        routesFailed++;
        console.log(`  ❌  ${rel} [${check.method}]`);
        if (!check.hasCsrf)           console.log('       ↳ missing: assertCsrf');
        if (!check.hasRateLimit)      console.log('       ↳ missing: enforceBrandRateLimit');
        if (!check.hasOwnershipCheck) console.log('       ↳ missing: ownership check (brand_id/user.id)');
      }
    }
    console.log();
  }

  // ── 2. Math.random() scan ──────────────────────────────────────────────────
  console.log('🎲  Scanning for Math.random() in security contexts …\n');
  const mathIssues = await scanMathRandom(srcDir);

  if (mathIssues.length === 0) {
    console.log('  ✅  No Math.random() found in security-sensitive files.\n');
  } else {
    console.log(`  ❌  Found ${mathIssues.length} occurrence(s):\n`);
    for (const issue of mathIssues) {
      console.log(`  📄  ${relative(cwd, issue.file)}:${issue.line}`);
      console.log(`       ${issue.snippet}\n`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════════════');
  const totalIssues = routesFailed + mathIssues.length;
  if (totalIssues === 0) {
    console.log('  ✅  All checks passed — brand security baseline OK.');
  } else {
    console.log(`  ❌  ${totalIssues} issue(s) found — fix before merging.`);
  }
  console.log('════════════════════════════════════════════════════════\n');

  return totalIssues > 0 ? 1 : 0;
}

main().then((code) => process.exit(code));
