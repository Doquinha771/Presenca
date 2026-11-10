import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

test('keepalive usa somente RPC mínima e chave publicável', () => {
  const script = read('../scripts/supabase-keepalive.mjs');
  assert.match(script, /\/rest\/v1\/rpc\/project_keepalive/);
  assert.match(script, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(script, /service_role\s*[:=]|sb_secret_[A-Za-z0-9_-]+/i);
  assert.match(script, /attempt <= 3/);
});

test('workflow do Supabase roda diariamente e pode ser disparado manualmente', () => {
  const workflow = read('../.github/workflows/supabase-keepalive.yml');
  assert.match(workflow, /cron:\s*'17 10 \* \* \*'/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /node scripts\/supabase-keepalive\.mjs/);
  assert.doesNotMatch(workflow, /service_role|sb_secret_/i);
});

test('RPC de keepalive não lê nem altera dados escolares', () => {
  const sql = read('../sql/11_keepalive_supabase.sql');
  assert.match(sql, /security invoker/i);
  assert.match(sql, /clock_timestamp\(\)/i);
  assert.match(sql, /grant execute on function public\.project_keepalive\(\) to anon, authenticated/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|drop)\b/i);
});
