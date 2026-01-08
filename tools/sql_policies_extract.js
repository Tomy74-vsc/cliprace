const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'db_refonte');
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.sql'))
  .sort((a,b)=>a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

function uniq(arr){ return Array.from(new Set(arr)).sort(); }
function grabAll(re, s){
  const out=[]; let m; re.lastIndex=0;
  while((m=re.exec(s))!==null){ out.push(m.slice(1)); }
  return out;
}

function stripComments(sql){
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  sql = sql.replace(/--[^\n\r]*/g, '');
  return sql;
}

const policies=[];
for(const f of files){
  const raw = fs.readFileSync(path.join(dir,f),'utf8');
  const sql = stripComments(raw);

  const re = /\bCREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([\w.]+)([\s\S]*?);/gmi;
  let m;
  while((m = re.exec(sql)) !== null){
    const name = m[1];
    const table = m[2];
    const body = m[3];

    const forM = /\bFOR\s+([A-Z ,]+)/i.exec(body);
    const toM = /\bTO\s+([\s\S]+?)(?=\s*\bUSING\b|\s*\bWITH\s+CHECK\b|\s*$)/i.exec(body);
    const usingM = /\bUSING\s*\(([\s\S]*?)\)\s*(?:WITH\s+CHECK\s*\(|$)/i.exec(body);
    const withCheckM = /\bWITH\s+CHECK\s*\(([\s\S]*?)\)\s*$/i.exec(body);

    policies.push({
      file: f,
      name,
      table,
      for: forM ? forM[1].trim().replace(/\s+/g,' ').toUpperCase() : null,
      to: toM ? toM[1].trim().replace(/\s+/g,' ') : null,
      using: usingM ? usingM[1].trim() : null,
      with_check: withCheckM ? withCheckM[1].trim() : null
    });
  }
}

const rlsEnabled = {};
for(const f of files){
  const raw = fs.readFileSync(path.join(dir,f),'utf8');
  const sql = stripComments(raw);
  const enable = uniq(grabAll(/\bALTER\s+TABLE\s+([\w.]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gmi, sql).map(x=>x[0]));
  for(const t of enable){
    if(!rlsEnabled[t]) rlsEnabled[t]=[];
    if(!rlsEnabled[t].includes(f)) rlsEnabled[t].push(f);
  }
}

const policiesByTable = {};
for(const p of policies){
  if(!policiesByTable[p.table]) policiesByTable[p.table]=[];
  policiesByTable[p.table].push({ name:p.name, for:p.for, to:p.to, file:p.file, using:p.using, with_check:p.with_check });
}
for(const t of Object.keys(policiesByTable)){
  policiesByTable[t].sort((a,b)=>a.name.localeCompare(b.name));
}

const tablesWithRlsNoPolicies = Object.keys(rlsEnabled).filter(t => !policiesByTable[t] || policiesByTable[t].length===0).sort();

const out = { policies, policiesByTable, rlsEnabled, tablesWithRlsNoPolicies };
fs.writeFileSync(path.join(dir,'_policies.json'), JSON.stringify(out,null,2), 'utf8');
console.log('Wrote db_refonte/_policies.json');
