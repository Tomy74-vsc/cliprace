import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

interface Issue {
  file: string;
  action: string;
  line: number;
  hasAudit: boolean;
}

// Actions critiques qui doivent avoir audit logs
const CRITICAL_ACTIONS = [
  'cashout',
  'invoice',
  'payment',
  'user',
  'contest',
  'setting',
  'feature',
  'moderation',
  'approve',
  'reject',
  'ban',
  'activate',
  'deactivate',
  'publish',
  'pause',
  'end',
  'archive',
];

async function getAllRouteFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await getAllRouteFiles(fullPath));
      } else if (entry.isFile() && extname(entry.name) === '.ts') {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory might not exist, skip
  }
  
  return files;
}

function isCriticalRoute(file: string): boolean {
  const fileName = file.toLowerCase();
  return CRITICAL_ACTIONS.some(action => fileName.includes(action));
}

async function auditAuditLogs() {
  const apiDir = join(process.cwd(), 'src/app/api/admin');
  const files = await getAllRouteFiles(apiDir);
  const issues: Issue[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      
      const hasPOST = /export\s+async\s+function\s+POST/.test(content);
      const hasPATCH = /export\s+async\s+function\s+PATCH/.test(content);
      const hasDELETE = /export\s+async\s+function\s+DELETE/.test(content);
      const hasAudit = /audit_logs|logAdminAction/.test(content);
      
      if ((hasPOST || hasPATCH || hasDELETE) && isCriticalRoute(file) && !hasAudit) {
        const lines = content.split('\n');
        let actionLine = -1;
        let action = 'unknown';
        
        // Trouver la ligne de la fonction
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('export async function POST')) {
            actionLine = i + 1;
            action = 'POST';
            break;
          } else if (lines[i].includes('export async function PATCH')) {
            actionLine = i + 1;
            action = 'PATCH';
            break;
          } else if (lines[i].includes('export async function DELETE')) {
            actionLine = i + 1;
            action = 'DELETE';
            break;
          }
        }
        
        if (actionLine > 0) {
          issues.push({ file, action, line: actionLine, hasAudit: false });
        }
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }

  console.log('\n🔍 Audit Logs Audit Results\n');
  if (issues.length === 0) {
    console.log('✅ All critical routes have audit logs');
    return 0;
  } else {
    console.log(`⚠️  Found ${issues.length} critical routes that may need audit logs:\n`);
    issues.forEach(i => {
      console.log(`  📄 ${i.file}`);
      console.log(`     Method: ${i.action} at line ${i.line}`);
      console.log(`     Note: This may be a false positive - verify manually\n`);
    });
    return 0; // Warning, not error
  }
}

auditAuditLogs().then(exitCode => process.exit(exitCode));

