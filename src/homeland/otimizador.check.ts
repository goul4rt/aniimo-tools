// Checagem do otimizador de Homeland: node src/homeland/otimizador.check.ts
import assert from 'node:assert/strict';
import dados from '../../data/homeland.json' with { type: 'json' };
import { ciclo, eficiencia, melhorias, otimiza, padrao, type Dados, type Receita } from './otimizador.ts';

const d = dados as unknown as Dados;
const r = (id: string) => d.receitas.find((x) => x.id === id)! as Receita;
const perto = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

// Eficiências medidas no jogo (doc do aniimax): processador 100/300/400/500%, coleta +50%/+40% por nível.
perto(eficiencia(r('milled_rice'), 1, false, d.semPersonalidade), 1);
perto(eficiencia(r('milled_rice'), 2, false, d.semPersonalidade), 3);
perto(eficiencia(r('milled_rice'), 4, false, d.semPersonalidade), 5);
perto(eficiencia(r('well_water'), 3, false, d.semPersonalidade), 2);
perto(eficiencia(r('clay'), 3, false, d.semPersonalidade), 1.4);
perto(eficiencia(r('milled_rice'), 2, true, d.semPersonalidade), 3.6);
perto(eficiencia(r('growth_flower'), 3, false, d.semPersonalidade), 1.4); // Dance Pad: +40%/nível, sem personalidade
// Clay: 2250 de workload, Nv. 2, Aniimo Nv. 3 sem personalidade → 21m26s no jogo.
const argila = ciclo(d, r('clay'), { ...padrao(d, 5), nivelAniimo: 3, personalidade: false });
assert.ok(Math.abs(argila.segundos - (21 * 60 + 26)) < 2, `clay ${argila.segundos}s`);

// Planos: sempre viáveis, sem consumir o que não produz, e crescendo com o RV.
let anterior = 0;
for (const rv of [1, 3, 5, 8, 12, 16, 20]) {
  const t = performance.now();
  const p = otimiza(d, padrao(d, rv));
  const ms = performance.now() - t;
  assert.ok(p.ok, `RV ${rv} sem solução`);
  assert.ok(p.ganhoHora >= anterior - 1, `RV ${rv} caiu: ${p.ganhoHora} < ${anterior}`);
  const cfg = padrao(d, rv);
  for (const l of p.linhas) assert.ok(l.unidades <= cfg.instalacoes[l.r.instalacao].qtd, `RV ${rv}: ${l.r.instalacao} acima do limite`);
  anterior = p.ganhoHora;
  console.log(`RV ${String(rv).padStart(2)}: ${Math.round(p.ganhoHora).toLocaleString('pt-BR').padStart(8)} coins/h  ${p.linhas.length} linhas  ${p.aniimoTotal} Aniimo  ${ms.toFixed(0)} ms`);
}
// Regressões: máquina pode esperar insumo (senão processador nunca entra) e quick_lemon abastece quem pede lemon.
const rv12 = otimiza(d, padrao(d, 12));
assert.ok(rv12.linhas.some((l) => l.r.tipo === 'processador'), 'RV 12 sem processador');
assert.ok(rv12.linhas.some((l) => l.r.insumos.some(([i]) => i === 'lemon')) && rv12.linhas.some((l) => l.r.id === 'quick_lemon'), 'quick_lemon não abastece lemon');
for (const l of rv12.linhas) assert.ok(l.uso > 0 && l.uso <= 1 + 1e-9, `uso fora de 0–1: ${l.r.id}`);

// Tempo: o RV 10 com layout de clima levava ~2 s por plano e o layout automático travava o navegador (14 s).
import { cobertos as cobre, montaAuto } from './layout.ts';
const c10 = { ...padrao(d, 10), cobertos: cobre(montaAuto([{ tipo: 'hf', modo: 'Scorching' }, { tipo: 'cu', modo: 'Cool' }, { tipo: 'sl', modo: 'Adequate' }], { fa: 20, wo: 10, ts: 1, sh: 1, fw: 0 }, [1 / 3, 1 / 3, 1 / 3])) };
const t10 = performance.now();
const p10 = otimiza(d, c10);
melhorias(d, c10, p10.ganhoHora);
assert.ok(performance.now() - t10 < 1000, `RV 10 lento: ${(performance.now() - t10).toFixed(0)} ms`);

// Melhorias: com tudo no teto do RV só sobra subir de RV; tirando uma Farmland, ela volta como sugestão.
const cheio = padrao(d, 8);
const m1 = melhorias(d, cheio, otimiza(d, cheio).ganhoHora);
assert.deepEqual(m1.map((m) => m.tipo), ['rv']);
const menos = { ...cheio, instalacoes: { ...cheio.instalacoes, Farmland: { ...cheio.instalacoes.Farmland, qtd: cheio.instalacoes.Farmland.qtd - 4 } } };
assert.ok(melhorias(d, menos, otimiza(d, menos).ganhoHora).some((m) => m.instalacao === 'Farmland' && m.tipo === 'qtd'));
console.log('ok');
