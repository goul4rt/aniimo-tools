// Checagem do planejador de layout: node src/homeland/layout.check.ts
import assert from 'node:assert/strict';
import { cabe, climas, cobertos, codifica, decodifica, type Peca } from './layout.ts';

// Estufa (Heat Furnace) em (10,10): cobre de 6,5 a 15,5. Farmland em (14,10) entra; em (15,15) só encosta... em 15,5 → sobreposição de 0,5: entra.
const forno: Peca = { tipo: 'hf', x: 10, y: 10, modo: 'Scorching' };
const dentro: Peca = { tipo: 'fa', x: 14, y: 10 };
const quina: Peca = { tipo: 'fa', x: 15, y: 15 };
const fora: Peca = { tipo: 'fa', x: 16, y: 10 };
const pecas = [forno, dentro, quina, fora];
const c = climas(pecas);
assert.equal(c.get(dentro), 'Scorching');
assert.equal(c.get(quina), 'Scorching'); // 15..17 x 15..17 contra 6,5..15,5: sobra 0,5×0,5 de área real
assert.equal(c.get(fora), undefined);   // 16 > 15,5: fora
assert.deepEqual(cobertos(pecas), { 'Farmland|Scorching': 2 });

// Dois climas diferentes na mesma lavoura: misto, não conta para nenhum.
const gelo: Peca = { tipo: 'cu', x: 18, y: 10, modo: 'Cool' };
const meio: Peca = { tipo: 'fa', x: 14, y: 13 };
assert.equal(climas([forno, gelo, meio]).get(meio), 'misto');

// Colisão e borda.
assert.equal(cabe(pecas, { tipo: 'fa', x: 14, y: 11 }), false);
assert.equal(cabe([], { tipo: 'wo', x: 45, y: 0 }), false);

// Ida e volta do link, incluindo o modo de clima e um pedaço inválido no meio.
const link = codifica(pecas);
assert.equal(link, 'hf0a0as.fa0e0a.fa0f0f.fa0g0a');
assert.deepEqual(decodifica(link), pecas);
assert.equal(decodifica('hf0a0as.xx0000.fa0e0a').length, 2);
assert.equal(decodifica('cu0101z.cu0101c')[0].modo, 'Freeze'); // o segundo bate no primeiro e é ignorado
// Layout automático: três prédios, zonas separadas, nada misto, tudo coberto e dentro do limite.
import { montaAuto } from './layout.ts';
const auto = montaAuto([{ tipo: 'hf', modo: 'Scorching' }, { tipo: 'cu', modo: 'Cool' }, { tipo: 'sl', modo: 'Adequate' }], { fa: 26, wo: 13, sh: 1, fw: 1, ts: 1 }, [1 / 3, 1 / 3, 1 / 3]);
const ca = climas(auto);
assert.ok(![...ca.values()].includes('misto'), 'misto no automático');
assert.ok([...ca.values()].every((c) => c), 'peça sem clima no automático');
assert.ok(auto.filter((p) => p.tipo === 'fa').length <= 26 && auto.filter((p) => p.tipo === 'wo').length <= 13);
for (const p of auto) assert.ok(cabe(auto.filter((o) => o !== p), p), 'sobreposição no automático');
const tot = Object.values(cobertos(auto)).reduce((a, b) => a + b, 0);
console.log('automático:', cobertos(auto), 'total', tot);
assert.ok(tot >= 30, `cobriu pouco: ${tot}`);
console.log('ok');
