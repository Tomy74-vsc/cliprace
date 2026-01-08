import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

interface Issue {
  file: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  line: number;
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

async function auditCSRF() {
  const apiDir = join(process.cwd(), 'src/app/api/admin');
  const files = await getAllRouteFiles(apiDir);
  const issues: Issue[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      
      // Vérifier si le fichier contient des mutations
      const hasPOST = /export\s+async\s+function\s+POST/.test(content);
      const hasPATCH = /export\s+async\s+function\s+PATCH/.test(content);
      const hasDELETE = /export\s+async\s+function\s+DELETE/.test(content);
      
      // Vérifier si CSRF est présent
      const hasCSRF = /assertCsrf/.test(content);
      
      if ((hasPOST || hasPATCH || hasDELETE) && !hasCSRF) {
        const lines = content.split('\n');
        let methodLine = -1;
        let method: 'POST' | 'PATCH' | 'DELETE' = 'POST';
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('export async function POST')) {
            methodLine = i + 1;
            method = 'POST';
            break;
          } else if (lines[i].includes('export async function PATCH')) {
            methodLine = i + 1;
            method = 'PATCH';
            break;
          } else if (lines[i].includes('export async function DELETE')) {
            methodLine = i + 1;
            method = 'DELETE';
            break;
          }
        }
        
        if (methodLine > 0) {
          issues.push({ file, method, line: methodLine });
        }
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }

  console.log('\n🔍 CSRF Audit Results\n');
  if (issues.length === 0) {
    console.log('✅ All routes are protected with CSRF');
    return 0;
  } else {
    console.log(`❌ Found ${issues.length} unprotected routes:\n`);
    issues.forEach(i => {
      console.log(`  📄 ${i.file}`);
      console.log(`     Method: ${i.method} at line ${i.line}\n`);
    });
    return 1;
  }
}

auditCSRF().then(exitCode => process.exit(exitCode));

