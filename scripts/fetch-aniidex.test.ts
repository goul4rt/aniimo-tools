// Confere o parser do Aniidex num HTML mínimo com o mesmo formato do site. Uso: node scripts/fetch-aniidex.test.ts
import assert from 'node:assert/strict';
import { parse } from './fetch-aniidex.ts';

const html = `<div class="content-layout"><div class="quality-5 hero-card"><img src="/_ipx/s_112x112/images/items/ui_item_4040075.webp">
<div class="hero-info"><span class="qp-5 quality-pill" data-v-1>Legendary</span><span class="category-pill" data-v-1>Buff</span>
<h1 class="item-title" data-v-1>[Mk III] Energizing Bracer</h1>
<p class="func-rep-description"><span class="" style="">+25% skill damage
Every 6 casts &amp; more.</span></p></div>
<section class="info-section item-overview"><div class="stat-chip"><span class="stat-label">Sells for</span><span class="stat-value">1,573</span></div></section>
<section class="info-section"><h2 class="section-title">How to Obtain X</h2>
<div class="obtain-row"><div class="obtain-info"><span class="obtain-detail">Shop</span><div class="cost-chip"><span class="cost-amount">2,000</span><img src="/images/items/ui_item_1001.webp"><span class="cost-label">Training Coin</span></div></div></div>
<div class="obtain-row"><span class="badge-gathering type-badge">Gathering</span><div class="obtain-info"><span class="obtain-detail">Gather: Green Raspberry</span></div></div>
</section><section class="info-section"><h2 class="section-title">Used In</h2><div class="section-body"><div class="recipe-row"><span class="type-badge">Egg Hatch</span><span>Hatchable</span><p class="pet-name">Bolty</p></div></div></section>
</div><footer></footer>`;

const it = parse('mk-iii', html);
assert.equal(it.nome, '[Mk III] Energizing Bracer');
assert.equal(it.id, 4040075);
assert.deepEqual([it.raridade, it.raridadeNome, it.categoria], [5, 'Legendary', 'Buff']);
assert.equal(it.funcao, '+25% skill damage\nEvery 6 casts & more.');
assert.deepEqual(it.info, { 'Sells for': '1,573' });
assert.deepEqual(it.fontes, [
  { tipo: null, onde: 'Shop', custo: [{ qtd: 2000, moeda: 'Training Coin' }] },
  { tipo: 'Gathering', onde: 'Gather: Green Raspberry', custo: [] },
]);
assert.deepEqual(it.outras, [{ titulo: 'Used In', linhas: ['Egg Hatch · Hatchable · Bolty'] }]);
assert.throws(() => parse('x', '<div>nada</div>'));
console.log('ok');
