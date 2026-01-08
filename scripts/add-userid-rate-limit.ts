import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

interface FileToFix {
  file: string;
  line: number;
  currentLine: string;
}

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

async function findFilesNeedingUserId() {
  const apiDir = join(process.cwd(), 'src/app/api/admin');
  const files = await getAllRouteFiles(apiDir);
  const toFix: FileToFix[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      // Chercher enforceAdminRateLimit sans userId
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('enforceAdminRateLimit') && !line.includes('user.id') && !line.includes('actor.id') && !line.includes('userId')) {
          // Vérifier si la ligne précédente a user ou actor
          const prevLine = i > 0 ? lines[i - 1] : '';
          const hasUser = prevLine.includes('const { user') || prevLine.includes('const { user: actor') || prevLine.includes('const { user: userId');
          
          if (hasUser) {
            // Vérifier si c'est déjà avec userId (peut être sur plusieurs lignes)
            const nextLines = lines.slice(i, i + 3).join(' ');
            if (!nextLines.includes('user.id') && !nextLines.includes('actor.id')) {
              toFix.push({ file, line: i + 1, currentLine: line });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }

  return toFix;
}

async function fixFiles(files: FileToFix[]) {
  for (const { file, line } of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const lines = content.split('\n');
      const lineIndex = line - 1;
      
      // Trouver la variable user dans les lignes précédentes
      let userIdVar = 'user.id';
      for (let i = lineIndex - 5; i < lineIndex; i++) {
        if (i >= 0 && lines[i]) {
          if (lines[i].includes('const { user: actor')) {
            userIdVar = 'actor.id';
            break;
          } else if (lines[i].includes('const { user')) {
            userIdVar = 'user.id';
            break;
          }
        }
      }
      
      // Remplacer la ligne
      const oldLine = lines[lineIndex];
      if (oldLine.includes('enforceAdminRateLimit(req,')) {
        // Pattern: enforceAdminRateLimit(req, { route: '...', max: ..., windowMs: ... });
        const newLine = oldLine.replace(
          /enforceAdminRateLimit\(req,\s*\{([^}]+)\}\)/,
          `enforceAdminRateLimit(req, {$1}, ${userIdVar})`
        );
        lines[lineIndex] = newLine;
        
        await writeFile(file, lines.join('\n'), 'utf-8');
        console.log(`✅ Fixed: ${file}:${line}`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ${file}:`, error);
    }
  }
}

async function main() {
  console.log('🔍 Finding files needing userId in enforceAdminRateLimit...\n');
  const files = await findFilesNeedingUserId();
  
  if (files.length === 0) {
    console.log('✅ All files already have userId in enforceAdminRateLimit');
    return;
  }
  
  console.log(`Found ${files.length} files to fix:\n`);
  files.forEach(f => {
    console.log(`  📄 ${f.file}:${f.line}`);
    console.log(`     ${f.currentLine.trim()}\n`);
  });
  
  console.log('Fixing files...\n');
  await fixFiles(files);
  console.log('\n✅ Done!');
}

main().catch(console.error);

