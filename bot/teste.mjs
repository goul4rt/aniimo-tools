// Checagem do bot sem Discord: assina requisições com uma chave Ed25519 gerada aqui. Uso: node bot/teste.mjs
import assert from 'node:assert';
import worker from './worker.js';

const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const pub = Buffer.from(await crypto.subtle.exportKey('raw', kp.publicKey)).toString('hex');
const env = { DISCORD_PUBLIC_KEY: pub };

async function chama(payload, assinar = true) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = Buffer.from(await crypto.subtle.sign('Ed25519', kp.privateKey, new TextEncoder().encode(ts + body))).toString('hex');
  const headers = { 'x-signature-timestamp': ts, 'x-signature-ed25519': assinar ? sig : '00'.repeat(64) };
  return worker.fetch(new Request('https://x/', { method: 'POST', body, headers }), env);
}

assert.equal((await chama({ type: 1 }, false)).status, 401);
assert.deepEqual(await (await chama({ type: 1 })).json(), { type: 1 });
const auto = await (await chama({ type: 4, data: { name: 'aniimo', options: [{ name: 'nome', value: 'ember' }] } })).json();
assert.equal(auto.data.choices[0].value, 'brasim');
const cmd = await (await chama({ type: 2, data: { name: 'aniimo', options: [{ name: 'nome', value: 'Emberpup' }] } })).json();
assert.match(cmd.data.embeds[0].title, /Brasim \(Emberpup\)/);
const nada = await (await chama({ type: 2, data: { name: 'aniimo', options: [{ name: 'nome', value: 'xyzzy' }] } })).json();
assert.equal(nada.data.flags, 64);
console.log('ok:', cmd.data.embeds[0].title, '|', cmd.data.embeds[0].fields.map((f) => f.name).join(', '));
