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

function addToMap(map, key, val){
  if(!map[key]) map[key]=[];
  if(!map[key].includes(val)) map[key].push(val);
}

const index = {
  files: {},
  objects: {
    tables: {},
    types: {},
    functions: {},
    views: {},
    materialized_views: {},
    triggers: {},
    policies: {},
    indexes: {},
    rls_enabled_on: {},
    references: {}
  }
};

for(const f of files){
  const filePath = path.join(dir,f);
  const sql = fs.readFileSync(filePath,'utf8');

  const tables = uniq(grabAll(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([\w.]+)\s*\(/gmi, sql).map(x=>x[0]));
  const types = uniq(grabAll(/\bCREATE\s+TYPE\s+([\w.]+)\s+AS\s+ENUM\b/gmi, sql).map(x=>x[0]));
  const funcs = uniq(grabAll(/\bCREATE\s+OR\s+REPLACE\s+FUNCTION\s+([\w.]+)\s*\(/gmi, sql).map(x=>x[0]));
  const views = uniq(grabAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([\w.]+)\b/gmi, sql).map(x=>x[0]));
  const matViews = uniq(grabAll(/\bCREATE\s+MATERIALIZED\s+VIEW\s+([\w.]+)\b/gmi, sql).map(x=>x[0]));
  const triggers = uniq(grabAll(/\bCREATE\s+TRIGGER\s+"?([\w-]+)"?\b[\s\S]*?\bON\s+([\w.]+)/gmi, sql).map(x=>`${x[0]} on ${x[1]}`));
  const policies = uniq(grabAll(/\bCREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([\w.]+)/gmi, sql).map(x=>({ name: x[0], table: x[1] }))
    .map(p=>`${p.name} on ${p.table}`));
  const enableRls = uniq(grabAll(/\bALTER\s+TABLE\s+([\w.]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gmi, sql).map(x=>x[0]));
  const indexes = uniq(grabAll(/\bCREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([\w.]+)\s+ON\s+([\w.]+)/gmi, sql).map(x=>`${x[0]} on ${x[1]}`));
  const refs = uniq(grabAll(/\bREFERENCES\s+([\w.]+)\s*\(/gmi, sql).map(x=>x[0]));

  index.files[f] = { tables, types, functions: funcs, views, materialized_views: matViews, triggers, policies, indexes, rls_enable: enableRls, references: refs };

  for(const t of tables) addToMap(index.objects.tables, t, f);
  for(const t of types) addToMap(index.objects.types, t, f);
  for(const fn of funcs) addToMap(index.objects.functions, fn, f);
  for(const v of views) addToMap(index.objects.views, v, f);
  for(const mv of matViews) addToMap(index.objects.materialized_views, mv, f);
  for(const trg of triggers) addToMap(index.objects.triggers, trg, f);
  for(const pol of policies) addToMap(index.objects.policies, pol, f);
  for(const idx of indexes) addToMap(index.objects.indexes, idx, f);
  for(const rls of enableRls) addToMap(index.objects.rls_enabled_on, rls, f);
  for(const ref of refs) addToMap(index.objects.references, ref, f);
}

// also compute duplicates (objects defined in >1 file)
const duplicates = {};
for(const [kind, mp] of Object.entries(index.objects)){
  duplicates[kind] = Object.fromEntries(Object.entries(mp).filter(([k,v])=>v.length>1));
}
index.duplicates = duplicates;

fs.writeFileSync(path.join(dir,'_audit_index.json'), JSON.stringify(index,null,2), 'utf8');
console.log('Wrote db_refonte/_audit_index.json');
