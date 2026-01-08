const fs = require('fs');
const path = require('path');

const pol = JSON.parse(fs.readFileSync(path.join('db_refonte','_policies.json'),'utf8'));

const rlsEnabled = new Set(Object.keys(pol.rlsEnabled || {}));
const allTables = new Set([...Object.keys(pol.policiesByTable || {}), ...Array.from(rlsEnabled)]);
const tables = Array.from(allTables).sort();

function oneLine(s){
  if(!s) return '';
  return s.replace(/\s+/g,' ').trim();
}

let out = '';
out += '# RLS / Policies Matrix\n\n';
out += 'Auto-generated from SQL files in `db_refonte/`.\n\n';
out += '## Tables with RLS enabled but NO policies\n\n';
if((pol.tablesWithRlsNoPolicies||[]).length===0){
  out += '- (none)\n\n';
} else {
  for(const t of pol.tablesWithRlsNoPolicies){ out += `- ${t}\n`; }
  out += '\n';
}

for(const t of tables){
  const enabled = rlsEnabled.has(t);
  out += `## ${t}\n\n`;
  out += `- **RLS**: ${enabled ? 'ON' : 'OFF/UNKNOWN (no ALTER TABLE ... ENABLE RLS found)'}\n`;
  const pols = (pol.policiesByTable && pol.policiesByTable[t]) ? pol.policiesByTable[t] : [];
  if(pols.length===0){
    out += '- **Policies**: (none)\n\n';
    continue;
  }
  out += '\n| Policy | FOR | TO | Source file |\n|---|---|---|---|\n';
  for(const p of pols){
    out += `| ${p.name} | ${p.for||''} | ${p.to||''} | ${p.file} |\n`;
  }
  out += '\n';

  const full = pol.policies.filter(p=>p.table===t).sort((a,b)=>a.name.localeCompare(b.name));
  for(const p of full){
    const using = oneLine(p.using);
    const wc = oneLine(p.with_check);
    out += `- **${p.name}** (${p.for||'?'})`;
    if(p.to) out += ` TO ${p.to}`;
    out += ':\n';
    if(using) out += `  - USING: \`${using.length>180 ? using.slice(0,180)+'â€¦' : using}\`\n`;
    if(wc) out += `  - WITH CHECK: \`${wc.length>180 ? wc.slice(0,180)+'â€¦' : wc}\`\n`;
  }
  out += '\n';
}

fs.writeFileSync(path.join('db_refonte','RLS_MATRIX.md'), out, 'utf8');
console.log('Wrote db_refonte/RLS_MATRIX.md');
