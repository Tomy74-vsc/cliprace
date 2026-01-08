const fs = require('fs');
const path = require('path');

const idx = JSON.parse(fs.readFileSync(path.join('db_refonte','_audit_index.json'),'utf8'));

const allSql = Object.keys(idx.files).filter(f=>f.toLowerCase().endsWith('.sql'))
  .sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));

function typeOf(file){
  const f = idx.files[file];
  if(!f) return '';
  const types=[];
  if(file.startsWith('00_') && file.includes('extensions')) types.push('extensions');
  if(f.types && f.types.length) types.push('types/enums');
  if(f.tables && f.tables.length) types.push('schema/tables');
  if(f.functions && f.functions.length) types.push('functions');
  if(f.triggers && f.triggers.length) types.push('triggers');
  if(f.policies && f.policies.length) types.push('RLS/policies');
  if(f.views && f.views.length) types.push('views');
  if(f.materialized_views && f.materialized_views.length) types.push('mat_views');
  if(f.indexes && f.indexes.length) types.push('indexes');
  if(/storage/i.test(file)) types.push('storage');
  if(/seed/i.test(file)) types.push('seed/data');
  return Array.from(new Set(types)).join(', ');
}

function depsFor(file){
  const refs = (idx.files[file] && idx.files[file].references) ? idx.files[file].references : [];
  return Array.from(new Set(refs)).sort();
}

function executable(file){
  const broken = new Set([
    '00_platform_settings_readonly.sql',
    '51_admin_transactions.sql',
    '52_admin_kpi_materialized.sql',
    '53_admin_indexes_search.sql'
  ]);
  if(broken.has(file)) return 'NO';
  if(['12_storage_policies.sql','12a_create_contest_assets_bucket.sql','12b_create_invoices_bucket.sql','12c_fix_contest_assets_rls.sql','12e_verify_and_fix_contest_assets_rls.sql'].includes(file)) return 'YES (env-dependent)';
  return 'YES';
}

function remarks(file){
  if(file==='00_platform_settings_readonly.sql') return 'Conflicts with 39_admin_tables.sql; references profiles; should be a pure INSERT migration.';
  if(file==='51_admin_transactions.sql') return 'Uses invalid cashout statuses (rejected/on_hold); not compatible with cashout_status enum.';
  if(file==='52_admin_kpi_materialized.sql') return 'References missing columns (response_time_ms/webhook_endpoint_id) and invalid cashout status (approved).';
  if(file==='53_admin_indexes_search.sql') return 'References missing columns (admin_saved_views.module, webhook_endpoint_id).';
  if(file==='05_payments_cashouts_4eyes.sql') return 'Adds cashout_reviews + review_state; missing RLS policies for cashout_reviews in repo.';
  if(file==='57_admin_aal2_rls.sql') return 'Optional hardening: replaces admin policies for audit_logs/cashouts with AAL2 requirement.';
  if(file==='12c_fix_contest_assets_rls.sql' || file==='12e_verify_and_fix_contest_assets_rls.sql') return 'Hotfix scripts; consolidate into one stable migration.';
  return '';
}

function esc(s){
  return String(s||'').replaceAll('\n',' ').replaceAll('|','\\|');
}

let md = '';
md += '## File inventory (db_refonte/*.sql)\n\n';
md += '| File | Type | Key deps (FK REFERENCES) | Executable as-is? | Notes |\n';
md += '|---|---|---|---|---|\n';

for(const f of allSql){
  const deps = depsFor(f).join(', ');
  md += `| ${esc(f)} | ${esc(typeOf(f))} | ${esc(deps)} | ${esc(executable(f))} | ${esc(remarks(f))} |\n`;
}

fs.writeFileSync('FILE_INVENTORY.md', md, 'utf8');
console.log('Wrote FILE_INVENTORY.md');
