import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';

const baseUrl = (process.env.SUPABASE_URL || SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY || '';
const endpoint = `${baseUrl}/rest/v1/rpc/project_keepalive`;

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(baseUrl)) {
  throw new Error('SUPABASE_URL inválida para o keepalive.');
}
if (!publishableKey || /service_role|sb_secret_/i.test(publishableKey)) {
  throw new Error('Use somente a chave publicável do Supabase no keepalive.');
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let successful = 0;
const errors = [];

for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-store',
      },
      body: '{}',
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 180)}`);
    }
    successful += 1;
    console.log(`Keepalive ${attempt}/3 concluído.`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    console.error(`Keepalive ${attempt}/3 falhou.`);
  }
  if (attempt < 3) await wait(4_000);
}

if (successful < 2) {
  throw new Error(`Keepalive insuficiente: ${successful}/3. ${errors.join(' | ')}`);
}
console.log(`Supabase recebeu ${successful} consultas leves de atividade.`);
