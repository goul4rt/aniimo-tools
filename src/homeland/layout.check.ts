// Checagem do planejador de layout: node src/homeland/layout.check.ts
import assert from 'node:assert/strict';
import { LOTES, TIPOS, cabe, climas, cobertos, codifica, decodifica, lados, montaAuto, noTerreno, type Peca } from './layout.ts';

// Grade: 16 lotes de 20×15; o lote 1 fica na coluna 2 da linha 0 (x 40–60, y 0–15) e o lote N abre no RV N.
assert.equal(LOTES.length, 16);
assert.deepEqual([LOTES[0].x, LOTES[0].y, LOTES[0].rv], [40, 0, 1]);
assert.equal(noTerreno({ tipo: 'fa', x: 41, y: 1 }, 1), true);
assert.equal(noTerreno({ tipo: 'fa', x: 21, y: 1 }, 1), false);      // lote 2 (x 20–40) só abre no RV 2
assert.equal(noTerreno({ tipo: 'fa', x: 21, y: 1 }, 2), true);
assert.equal(noTerreno({ tipo: 'fa', x: 39, y: 1 }, 2), true);       // atravessa lote 2 → lote 1, ambos abertos
assert.equal(noTerreno({ tipo: 'fa', x: 59, y: 1 }, 1), false);       // 60–61 já é o lote 5 (x 60–80), fechado no RV 1
assert.equal(noTerreno({ tipo: 'fa', x: 59, y: 1 }, 5), true);

// Tamanhos reais e giro: Blazing Stove 2,5×1,75 vira 1,75×2,5; Well não gira.
assert.deepEqual(lados({ tipo: 'bs', x: 0, y: 0 }), { w: 2.5, h: 1.75 });
assert.deepEqual(lados({ tipo: 'bs', x: 0, y: 0, r: true }), { w: 1.75, h: 2.5 });
assert.deepEqual(lados({ tipo: 'we', x: 0, y: 0, r: true }), { w: 2, h: 2 });
assert.equal(TIPOS.hf.w, 1);

// Cobertura: forno 1×1 em (50,7) → centro 50,5 → zona 46–55 × 3–12. Farmland em (54,7) entra; em (55,7) só encosta.
const forno: Peca = { tipo: 'hf', x: 50, y: 7, modo: 'Scorching' };
const dentro: Peca = { tipo: 'fa', x: 54, y: 7 };
const encosta: Peca = { tipo: 'fa', x: 55, y: 7 };
const c = climas([forno, dentro, encosta]);
assert.deepEqual(c.get(dentro), ['Scorching']);
assert.deepEqual(c.get(encosta), []);
assert.deepEqual(cobertos([forno, dentro, encosta]), { 'Farmland|Scorching': 1 });

// Duas zonas na mesma lavoura: ela recebe os dois climas (o otimizador usa o melhor para cada colheita).
const gelo: Peca = { tipo: 'cu', x: 57, y: 7, modo: 'Cool' };
assert.deepEqual(climas([forno, gelo, dentro]).get(dentro), ['Cool', 'Scorching']);
assert.deepEqual(cobertos([forno, gelo, dentro]), { 'Farmland|Cool+Scorching': 1 });

// Colisão.
assert.equal(cabe([dentro], { tipo: 'fa', x: 55, y: 8 }, 20), false);
assert.equal(cabe([dentro], { tipo: 'fa', x: 56, y: 7 }, 20), true);

// Link: ida e volta com giro e modo; link antigo (sem "r") ainda lê; o que não cabe no RV é ignorado.
const pecas: Peca[] = [forno, dentro, { tipo: 'bs', x: 42, y: 2, r: true }];
const link = codifica(pecas);
assert.equal(link, 'hf1e07s.fa1i07.bs1602r');
assert.deepEqual(decodifica(link, 5), pecas);
assert.equal(decodifica('hf1e07s.fa1i07', 1).length, 2);
assert.equal(decodifica('fa0l01', 1).length, 0); // x=21: lote 2, fechado no RV 1

// Layout automático no RV 12: um prédio por lote, nada fora do terreno, nada sobreposto, todo mundo com clima.
const auto = montaAuto([{ tipo: 'hf', modo: 'Scorching' }, { tipo: 'cu', modo: 'Cool' }, { tipo: 'sl', modo: 'Adequate' }], { fa: 26, wo: 13, sh: 1, fw: 1, ts: 1 }, [1 / 3, 1 / 3, 1 / 3], 12);
for (const p of auto) assert.ok(cabe(auto.filter((o) => o !== p), p, 12), `peça fora ou sobreposta: ${JSON.stringify(p)}`);
assert.ok([...climas(auto).values()].every((m) => m.length > 0), 'lavoura sem clima no automático');
assert.ok(auto.filter((p) => p.tipo === 'fa').length <= 26 && auto.filter((p) => p.tipo === 'wo').length <= 13);
const tot = Object.values(cobertos(auto)).reduce((a, b) => a + b, 0);
console.log('automático RV 12:', cobertos(auto), 'total', tot);
assert.ok(tot >= 30, `cobriu pouco: ${tot}`);
// Peças fixas (processadores) ficam onde estão.
const fixa: Peca = { tipo: 'cm', x: 41, y: 1 };
assert.ok(montaAuto([{ tipo: 'hf', modo: 'Warm' }], { fa: 4 }, [1], 7, [fixa]).includes(fixa));
console.log('ok');
