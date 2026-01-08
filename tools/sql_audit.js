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

const rows=[];
for(const f of files){
  const p = path.join(dir,f);
  const sql = fs.readFileSync(p,'utf8');
  const tables = uniq(grabAll(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([\w.]+)\s*\(/gmi, sql));
  const types = uniq(grabAll(/\bCREATE\s+TYPE\s+([\w.]+)\s+AS\s+ENUM\b/gmi, sql));
  const funcs = uniq(grabAll(/\bCREATE\s+OR\s+REPLACE\s+FUNCTION\s+([\w.]+)\s*\(/gmi, sql));
  const triggers = uniq(grabAll(/\bCREATE\s+TRIGGER\s+"?([\w-]+)"?\b/gmi, sql));
  const policies = uniq(grabAll(/\bCREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([\w.]+)/gmi, sql).map(x=>x.join(' on ')));
  const enableRls = uniq(grabAll(/\bALTER\s+TABLE\s+([\w.]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gmi, sql));
  const views = uniq(grabAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([\w.]+)\b/gmi, sql));
  const matViews = uniq(grabAll(/\bCREATE\s+MATERIALIZED\s+VIEW\s+([\w.]+)\b/gmi, sql));
  const indexes = uniq(grabAll(/\bCREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([\w.]+)\s+ON\s+([\w.]+)/gmi, sql).map(x=>x.join(' on ')));
  const refs = uniq(grabAll(/\bREFERENCES\s+([\w.]+)\s*\(/gmi, sql));
  const hasSeed = /\bINSERT\s+INTO\b/i.test(sql);
  const hasStorage = /\bstorage\.(objects|buckets)\b|storage\.create_bucket\b/i.test(sql);
  const hasAuthUid = /auth\.uid\(\)/i.test(sql);

  const classes=[];
  if(/CREATE\s+EXTENSION/i.test(sql)) classes.push('extensions');
  if(types.length) classes.push('types/enums');
  if(funcs.length) classes.push('functions');
  if(tables.length) classes.push('schema/tables');
  if(triggers.length) classes.push('triggers');
  if(policies.length || /DROP\s+POLICY/i.test(sql) || enableRls.length) classes.push('RLS/policies');
  if(views.length || matViews.length) classes.push('views');
  if(indexes.length || /\bALTER\s+TABLE\b/i.test(sql) || refs.length) classes.push('indexes/constraints/FK');
  if(hasSeed) classes.push('seed/data');
  if(hasStorage) classes.push('storage');

  rows.push({
    file: f,
    class: uniq(classes).join(' | '),
    tables: tables.length,
    types: types.length,
    funcs: funcs.length,
    triggers: triggers.length,
    policies: policies.length,
    rls_tables: enableRls.length,
    views: views.length,
    mat_views: matViews.length,
    refs: refs.length,
    seed: hasSeed,
    storage: hasStorage,
    auth_uid: hasAuthUid
  });
}

const header = Object.keys(rows[0]);
console.log(header.join(','));
for(const r of rows){
  console.log(header.map(k=>{
    const v = r[k];
    const s = String(v);
    if(/[\",\n]/.test(s)) return '"'+s.replaceAll('"','""')+'"';
    return s;
  }).join(','));
}
