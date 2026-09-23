// Checagem rápida da sugestão de time: node src/scripts/sugestao.check.ts
import assert from 'node:assert/strict';
import tabela from '../../data/elementos.json' with { type: 'json' };
import aniimos from '../../data/aniimos.json' with { type: 'json' };
import { nota, sugere, type Membro } from './sugestao.ts';

const ataque = tabela.ataque;
const opcoes: Membro[] = (aniimos as any[]).flatMap((a) =>
  a.formas.map((f: any) => ({ slug: a.slug, chave: f.chave, elementos: f.elementos, papeis: f.papeis, total: f.stats.total })));

// Time vazio: 3 sugestões de 4, sem espécie repetida dentro de uma sugestão nem sugestões iguais.
const vazio = sugere([], opcoes, 4, ataque);
assert.equal(vazio.length, 3);
for (const s of vazio) {
  assert.equal(s.length, 4);
  assert.equal(new Set(s.map((m) => m.slug)).size, 4);
}
// Variadas: duas sugestões de 4 dividem no máximo 2 espécies.
for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
  assert.ok(vazio[a].filter((m) => vazio[b].some((x) => x.slug === m.slug)).length <= 2);
}

// Com 1 no time: não sugere a mesma espécie, e completar melhora a nota em relação a um time só de Fogo.
const base = [opcoes.find((m) => m.elementos.join() === 'fire')!];
const [melhor] = sugere(base, opcoes, 3, ataque);
assert.ok(melhor.every((m) => m.slug !== base[0].slug));
const soFogo = opcoes.filter((m) => m.elementos.join() === 'fire' && m.slug !== base[0].slug).slice(0, 3);
assert.ok(nota([...base, ...melhor], ataque).valor > nota([...base, ...soFogo], ataque).valor);

// Time cheio: nada a sugerir.
assert.deepEqual(sugere(vazio[0], opcoes, 0, ataque), []);

console.log('ok', nota(vazio[0], ataque), vazio[0].map((m) => `${m.slug}:${m.chave}`));
