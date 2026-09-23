// Interface do Otimizador de Homeland. Estado inteiro no link (?rv=…&l=…), para compartilhar o Homeland.
import dadosBrutos from '../../data/homeland.json';
import { bloqueio, ciclo, melhorias, otimiza, padrao, type Config, type Dados, type Objetivo, type Plano, type Receita } from './otimizador.ts';
import { ALTURA, LARGURA, LOTE, LOTES, TIPOS, cabe, climas, cobertos, cobertura, codifica, decodifica, ehClima, lados, lotesAbertos, montaAuto, type Peca } from './layout.ts';
import { candidatos, equipeClima } from './equipe.ts';
import { chip } from '../scripts/seletor.ts';
import { iconeInst, iconeNoMapa } from './icones.ts';
import { evento, umaVez } from '../scripts/evento.ts';

const d = dadosBrutos as unknown as Dados;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('config');
const fmt = (n: number, casas = 0) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
const tempo = (s: number) => {
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  const h = s / 3600;
  return h < 48 ? `${fmt(h, 1)} h` : `${fmt(h / 24, 1)} dias`;
};

// Rótulos em PT. Habilidades de elemento usam os chips do site; as de ofício ganham nome nosso.
const ELEM: Record<string, string> = { Fire: 'fire', Grass: 'grass', Water: 'water', Earth: 'rock', Lightning: 'electric', Ice: 'ice', Wind: 'wind', Dark: 'dark', Light: 'holy' };
const OFICIO: Record<string, string> = { Artisanship: 'Artesanato', Leisure: 'Lazer', Perfumery: 'Perfumaria', Hauling: 'Transporte' };
const habilidade = (h: string) => ELEM[h] ? chip(ELEM[h]) : `<span class="rounded-full bg-casal-50 px-2 py-px text-[11px] font-semibold text-casal">${OFICIO[h] ?? h}</span>`;
const CLIMA: Record<string, [string, string]> = {
  Warm: ['Quente', '#FFB37A'], Scorching: ['Escaldante', '#E8603C'], Cool: ['Fresco', '#7FD6F5'], Freeze: ['Congelante', '#A7B8F7'], Adequate: ['Adequado', '#8CC63F'],
};
const climaTag = (c: string) => `<span class="rounded-full px-2 py-px text-[11px] font-semibold text-ink" style="background:${CLIMA[c]?.[1] ?? '#E3EEF7'}">${CLIMA[c]?.[0] ?? c}</span>`;
const MODULO: Record<string, string> = { ecological_module: 'Módulo Ecológico', kitchen_module: 'Módulo de Cozinha', resource_detector: 'Detector de Recursos', crafting_module: 'Módulo de Criação' };
const CATEGORIA: Record<string, string> = { Materials: 'Materiais', 'Aniimo Materials': 'Materiais de Aniimo', 'Materials Processing': 'Processamento', Environment: 'Clima' };
const MOEDA: Record<Objetivo, string> = { coins: 'Home Coin', aniipods: 'Aniipods', aniimo_exp: 'EXP de Aniimo' };
const nomeItem = (id: string) => d.receitas.find((r) => r.id === id)?.nome ?? id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const porNome = new Map(d.instalacoes.map((f) => [f.nome, f]));
/** Item → instalação que o produz (para o ícone). */
const origem = new Map(d.receitas.map((r) => [r.produz ?? r.id, r.instalacao]));
const porSlugInst = new Map(d.instalacoes.map((f) => [f.slug, f]));
/** Nome EN → [nome oficial em PT, id], gerado no build a partir do Aniilog. */
const NOMES_PT = JSON.parse($('nomes-pt').textContent!) as Record<string, [string, string]>;
/** Coleção do jogador (mesma chave de /colecao/): "id/forma". Sem coleção salva, fica vazia. */
const colecao = (() => { try { return new Set<string>(JSON.parse(localStorage.getItem('aniimo-colecao-v1') ?? '[]')); } catch { return new Set<string>(); } })();

// ---------- estado <-> link ----------
let cfg: Config = padrao(d, 5);
let pecas: Peca[] = [];
let aba = 'plano';

function lerLink() {
  const q = new URLSearchParams(location.search);
  const rv = Math.min(20, Math.max(1, Number(q.get('rv')) || 5));
  cfg = padrao(d, rv);
  if (q.has('n')) cfg.nivelAniimo = Math.min(4, Math.max(0, Number(q.get('n')) || 0));
  if (q.has('p')) cfg.personalidade = q.get('p') === '1';
  if (q.get('o') === 'aniipods' || q.get('o') === 'aniimo_exp') cfg.objetivo = q.get('o') as Objetivo;
  cfg.especiais = q.get('x') === '1';
  cfg.naoVerificadas = q.get('u') === '1';
  // f=farmland:12.4_mine:2.3 → quantidade.nível de quem difere do máximo do RV (nunca acima do teto).
  for (const parte of (q.get('f') ?? '').split('_')) {
    const m = parte.match(/^([a-z-]+):(\d+)\.(\d+)$/);
    const f = m && porSlugInst.get(m[1]);
    if (!f) continue;
    const teto = padrao(d, rv).instalacoes[f.nome];
    cfg.instalacoes[f.nome] = { qtd: Math.min(teto.qtd, Number(m![2])), nivel: Math.max(1, Math.min(teto.nivel, Number(m![3]))) };
  }
  for (const parte of (q.get('m') ?? '').split('_')) {
    const m = parte.match(/^([a-z_]+)\.(\d+)$/);
    if (m && m[1] in cfg.modulos) cfg.modulos[m[1]] = Math.min(Number(m[2]), padrao(d, rv).modulos[m[1]]);
  }
  pecas = decodifica(q.get('l') ?? '', rv);
  aba = ['plano', 'layout', 'receitas', 'rv'].includes(q.get('a') ?? '') ? q.get('a')! : 'plano';
}

function gravarLink() {
  const teto = padrao(d, cfg.rv);
  const q = new URLSearchParams({ rv: String(cfg.rv) });
  if (cfg.nivelAniimo !== 3) q.set('n', String(cfg.nivelAniimo));
  if (!cfg.personalidade) q.set('p', '0');
  if (cfg.objetivo !== 'coins') q.set('o', cfg.objetivo);
  if (cfg.especiais) q.set('x', '1');
  if (cfg.naoVerificadas) q.set('u', '1');
  const f = d.instalacoes.filter((i) => {
    const a = cfg.instalacoes[i.nome], t = teto.instalacoes[i.nome];
    return a.qtd !== t.qtd || (a.qtd > 0 && a.nivel !== t.nivel);
  }).map((i) => `${i.slug}:${cfg.instalacoes[i.nome].qtd}.${cfg.instalacoes[i.nome].nivel}`);
  if (f.length) q.set('f', f.join('_'));
  const m = Object.entries(cfg.modulos).filter(([k, v]) => v !== teto.modulos[k]).map(([k, v]) => `${k}.${v}`);
  if (m.length) q.set('m', m.join('_'));
  if (pecas.length) q.set('l', codifica(pecas));
  if (aba !== 'plano') q.set('a', aba);
  history.replaceState(null, '', `?${q.toString().replace(/%3A/g, ':')}`);
}

// ---------- configuração ----------
function montarConfig() {
  const el = form.elements as unknown as Record<string, HTMLInputElement & HTMLSelectElement>;
  el.rv.value = String(cfg.rv);
  el.nivel.value = String(cfg.nivelAniimo);
  el.objetivo.value = cfg.objetivo;
  el.personalidade.checked = cfg.personalidade;
  el.especiais.checked = cfg.especiais;
  el.naoVerificadas.checked = cfg.naoVerificadas;
  const teto = padrao(d, cfg.rv);
  $('tabela-instalacoes').innerHTML = d.instalacoes.map((f) => {
    const t = teto.instalacoes[f.nome], a = cfg.instalacoes[f.nome];
    const libera = Object.values(f.niveis)[0];
    const travada = t.qtd === 0;
    const niveis = Object.keys(f.niveis).map(Number).filter((n) => n <= t.nivel);
    return `<div class="flex items-center gap-2 rounded-xl border border-line px-3 py-2 ${travada ? 'opacity-50' : ''}">
      <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-casal-50 text-casal">${iconeInst(f.nome)}</span>
      <span class="min-w-0 flex-1 leading-tight"><span class="block truncate text-sm font-semibold">${f.nome}</span>
        <span class="block text-[11px] text-muted">${travada ? `libera no RV ${libera}` : CATEGORIA[f.categoria] ?? f.categoria}</span></span>
      <input type="number" min="0" max="${t.qtd}" value="${a.qtd}" data-qtd="${f.nome}" aria-label="Quantidade de ${f.nome}" ${travada ? 'disabled' : ''}
        class="campo h-9 w-16 px-2 text-center font-mono" />
      ${niveis.length > 1 ? `<select data-nivel="${f.nome}" aria-label="Nível de ${f.nome}" class="campo h-9 px-2 text-sm" ${travada ? 'disabled' : ''}>
        ${niveis.map((n) => `<option value="${n}" ${n === a.nivel ? 'selected' : ''}>Nv. ${n}</option>`).join('')}</select>` : ''}
    </div>`;
  }).join('');
  $('tabela-modulos').innerHTML = Object.entries(cfg.modulos).map(([k, v]) => `
    <label class="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold">${MODULO[k] ?? k}
      <select data-modulo="${k}" class="campo ml-auto h-9 px-2 text-sm">${Array.from({ length: teto.modulos[k] + 1 }, (_, n) => `<option value="${n}" ${n === v ? 'selected' : ''}>Nv. ${n}</option>`).join('')}</select>
    </label>`).join('');
}

form.addEventListener('change', (ev) => {
  const alvo = ev.target as HTMLInputElement & HTMLSelectElement;
  if (alvo.name === 'rv') {
    const velho = cfg;
    cfg = { ...padrao(d, Number(alvo.value)), nivelAniimo: velho.nivelAniimo, personalidade: velho.personalidade, especiais: velho.especiais, naoVerificadas: velho.naoVerificadas, objetivo: velho.objetivo };
    pecas = decodifica(codifica(pecas), cfg.rv); // o que não cabe mais no terreno do novo RV sai
    selecionada = null;
    montarConfig();
    montarPaleta();
    evento('homeland_rv', { rv: cfg.rv });
  } else if (alvo.name === 'nivel') cfg.nivelAniimo = Number(alvo.value);
  else if (alvo.name === 'objetivo') { cfg.objetivo = alvo.value as Objetivo; evento('homeland_objetivo', { objetivo: cfg.objetivo }); }
  else if (alvo.name) (cfg as unknown as Record<string, boolean>)[alvo.name] = alvo.checked;
  else if (alvo.dataset.qtd) {
    const max = Number(alvo.max);
    cfg.instalacoes[alvo.dataset.qtd] = { ...cfg.instalacoes[alvo.dataset.qtd], qtd: Math.max(0, Math.min(max, Math.round(Number(alvo.value) || 0))) };
    alvo.value = String(cfg.instalacoes[alvo.dataset.qtd].qtd);
    umaVez('homeland_ajuste_manual');
  } else if (alvo.dataset.nivel) cfg.instalacoes[alvo.dataset.nivel] = { ...cfg.instalacoes[alvo.dataset.nivel], nivel: Number(alvo.value) };
  else if (alvo.dataset.modulo) cfg.modulos[alvo.dataset.modulo] = Number(alvo.value);
  atualizar();
});
$('restaurar').addEventListener('click', () => {
  cfg = { ...padrao(d, cfg.rv), nivelAniimo: cfg.nivelAniimo, personalidade: cfg.personalidade, especiais: cfg.especiais, naoVerificadas: cfg.naoVerificadas, objetivo: cfg.objetivo };
  montarConfig();
  atualizar();
});

// ---------- plano ----------
const card = (titulo: string, valor: string, nota = '') =>
  `<div class="card p-4"><span class="rotulo text-xs">${titulo}</span><div class="mt-1 font-display text-3xl font-semibold text-ink">${valor}</div>${nota ? `<p class="mt-1 text-xs text-muted">${nota}</p>` : ''}</div>`;

function mostrarPlano(p: Plano) {
  const moeda = MOEDA[cfg.objetivo];
  const max = d.aniimoMax[cfg.rv - 1];
  const prox = d.custosRV[String(cfg.rv + 1)];
  const eta = prox && cfg.objetivo === 'coins' && p.ganhoHora > 0 ? tempo((prox.coins / p.ganhoHora) * 3600) : null;
  $('resumo').innerHTML = [
    card(`${moeda} por hora`, fmt(p.ganhoHora), cfg.objetivo === 'coins' && p.custoSementesHora > 0 ? `já descontadas ${fmt(p.custoSementesHora)} em sementes` : ''),
    card('Por dia', fmt(p.ganhoHora * 24), 'coletando a tempo, sem pausas'),
    card('Aniimo trabalhando', `${p.aniimoTotal + pecas.filter(ehClima).length}${max ? ` <span class="text-lg text-muted">/ ${max}</span>` : ''}`, max && p.aniimoTotal + pecas.filter(ehClima).length > max ? 'mais do que seu RV comporta: priorize as linhas de cima' : 'que o seu Homeland comporta'),
    prox ? card(`Próximo: RV ${cfg.rv + 1}`, `${fmt(prox.coins)}`, `Home Coin + ${prox.items.map(([i, n]) => `${fmt(n)} ${nomeItem(i)}`).join(' e ')}${eta ? ` · ~${eta} de moedas neste ritmo` : ''}`)
      : card('RV máximo', '20', 'você já está no topo'),
  ].join('');

  $('plano').innerHTML = p.linhas.length ? `<table class="w-full text-sm">
    <thead class="text-left"><tr class="rotulo text-[11px]"><th class="px-4 py-2">Instalação</th><th class="px-2 py-2">Produzir</th><th class="px-2 py-2 text-right">Por hora</th><th class="px-2 py-2 text-right">Ciclo</th><th class="px-4 py-2 text-right">Eficiência</th></tr></thead>
    <tbody>${p.linhas.map((l) => `<tr class="border-t border-line align-top">
      <td class="px-4 py-2.5"><span class="flex items-center gap-2"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-casal-50 text-casal">${iconeInst(l.r.instalacao)}</span>
        <span><span class="font-semibold">${l.r.instalacao}</span> <span class="font-mono text-xs text-danube-700">×${l.unidades}</span></span></span></td>
      <td class="px-2 py-2.5"><span class="font-semibold text-ink">${l.r.nome}</span> ${l.r.clima ? climaTag(l.r.clima) : ''}
        ${l.r.insumos.length ? `<span class="block text-xs text-muted">usa ${l.r.insumos.map(([i, n]) => `${n} ${nomeItem(i)}`).join(' + ')}</span>` : ''}</td>
      <td class="px-2 py-2.5 text-right font-mono">${fmt(l.porHora, 1)}</td>
      <td class="px-2 py-2.5 text-right font-mono text-muted">${tempo(l.segundos)}${l.uso < 0.98 ? `<span class="block text-[11px]" title="O resto do tempo a máquina espera insumo">usa ${fmt(l.uso * 100)}%</span>` : ''}</td>
      <td class="px-4 py-2.5 text-right font-mono ${l.eficiencia > 1 ? 'text-ok' : 'text-muted'}">${l.r.tipo === 'lavoura' ? '—' : `${fmt(l.eficiencia * 100)}%`}</td></tr>`).join('')}</tbody></table>`
    : '<p class="p-4 text-sm text-muted">Nada para produzir com essa configuração. Confira as instalações ou o objetivo.</p>';

  // Prédios de clima colocados no mapa também ocupam um Aniimo (Heat Furnace: Fogo; Cooling Unit: Gelo; Sunlamp: Sagrado).
  const deClima = pecas.filter(ehClima).map((pc) => {
    const e = equipeClima[TIPOS[pc.tipo].slug][pc.modo!];
    return { habilidade: e.ability, nivel: e.level, instalacao: `${TIPOS[pc.tipo].nome} (${CLIMA[pc.modo!][0]})`, quantos: 1, personalidade: undefined as string | undefined };
  });
  const equipe = [...p.equipe, ...deClima];
  $('equipe').innerHTML = equipe.length ? `<ul class="space-y-3">${equipe.map((e) => {
    const cands = candidatos(e.habilidade, e.nivel);
    const nomes = cands.slice(0, 4).map((c) => {
      const [pt, id] = NOMES_PT[c.nome] ?? [c.nome, ''];
      const tem = id && [...colecao].some((k) => k.startsWith(`${id}/`));
      return `<span class="${tem ? 'font-semibold text-ok' : ''}" title="${c.nome}${c.variante ? ` · variante rara (${fmt((c.chance ?? 0) * 100)}%)` : ''} · Nv. ${c.nivel}">${tem ? '✓ ' : ''}${pt}${c.variante ? '*' : ''}</span>`;
    });
    return `<li class="text-sm"><div class="flex items-center gap-2"><span class="font-mono font-semibold text-casal">×${e.quantos}</span>${habilidade(e.habilidade)}
      <span class="font-semibold">Nv. ${e.nivel}</span><span class="min-w-0 flex-1 truncate text-xs text-muted" title="${e.instalacao}">${e.instalacao}${e.personalidade && cfg.personalidade ? ` · ${e.personalidade}` : ''}</span></div>
      <p class="mt-0.5 pl-7 text-xs text-muted">${nomes.length ? `${nomes.join(', ')}${cands.length > 4 ? ` e mais ${cands.length - 4}` : ''}` : 'nenhum Aniimo conhecido com esse nível'}</p></li>`;
  }).join('')}</ul>
    <p class="mt-3 text-xs text-muted">Abaixo de cada linha, Aniimo que servem (✓ = está na sua <a class="underline" href="/colecao/">coleção</a>; * = só a variante rara). Habilidades de trabalho: Hideout Guides.</p>`
    : '<p class="text-sm text-muted">Nenhum Aniimo necessário.</p>';

  const mel = melhorias(d, cfg, p.ganhoHora).slice(0, 6);
  $('melhorias').innerHTML = mel.length ? `<ol class="space-y-2">${mel.map((m, i) => `
    <li class="flex items-start gap-2 text-sm"><span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-casal-50 text-[11px] font-bold text-casal">${i + 1}</span>
      <span class="min-w-0 flex-1">${m.oque}</span><span class="shrink-0 font-mono font-semibold text-ok">+${fmt(m.ganho)}/h</span></li>`).join('')}</ol>`
    : '<p class="text-sm text-muted">Você já está no máximo deste RV.</p>';

  const sub = Object.entries(p.subprodutos).filter(([, v]) => v > 0);
  $('vendas').innerHTML = (p.vendas.length ? `<div class="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">${p.vendas.map((v) => `
    <div class="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-sm"><span class="flex min-w-0 items-center gap-1.5 font-semibold"><span class="text-danube">${iconeInst(origem.get(v.item) ?? '')}</span><span class="truncate">${nomeItem(v.item)}</span></span>
      <span class="shrink-0 font-mono text-muted">${fmt(v.qtdHora, 1)}/h · <span class="font-semibold text-ink">${fmt(v.valorHora)}</span></span></div>`).join('')}</div>`
    : '<p class="text-sm text-muted">Nada à venda neste plano.</p>')
    + (sub.length ? `<p class="mt-3 text-xs text-muted">De brinde, para subir de RV: ${sub.map(([k, v]) => `<strong>${fmt(v, 1)}/h de ${nomeItem(k)}</strong>`).join(' e ')}.</p>` : '');
}

// ---------- layout ----------
const svg = $('mapa') as unknown as SVGSVGElement;
let ferramenta: string | null = 'fa';
let selecionada: Peca | null = null;
let fantasma: Peca | null = null;
let arrasto: { p: Peca; dx: number; dy: number; moveu: boolean; antes: string } | null = null;
let visao: 'abertos' | 'tudo' | 'lote' = 'abertos';
let loteFoco = 1;
let historico: string[] = [];
let futuro: string[] = [];
let caixa = { x: 0, y: 0, w: LARGURA, h: ALTURA };

const CATEGORIAS: [string, string, string][] = [
  ['Materials Production', 'Produção de materiais', '#FFE3C2'],
  ['Materials Processing', 'Processamento', '#DCE7FF'],
  ['Item Production', 'Produção de itens', '#E9E2FB'],
  ['Auxiliary Facilities', 'Clima', '#D9F2DF'],
];
const COR_CATEGORIA = Object.fromEntries(CATEGORIAS.map(([k, , c]) => [k, c]));
const limite = (tipo: string) => cfg.instalacoes[TIPOS[tipo].nome]?.qtd ?? 0;
const usadas = (tipo: string) => pecas.filter((p) => p.tipo === tipo).length;
const libera = (tipo: string) => Object.values(porNome.get(TIPOS[tipo].nome)?.niveis ?? {})[0];
const loteDe = (p: Peca) => LOTES.find((l) => p.x >= l.x && p.x < l.x + l.w && p.y >= l.y && p.y < l.y + l.h);
const ponto = (ev: PointerEvent) => {
  const r = svg.getBoundingClientRect();
  return { x: caixa.x + ((ev.clientX - r.left) / r.width) * caixa.w, y: caixa.y + ((ev.clientY - r.top) / r.height) * caixa.h };
};
const pecaEm = (x: number, y: number) => [...pecas].reverse().find((p) => { const { w, h } = lados(p); return x >= p.x && x < p.x + w && y >= p.y && y < p.y + h; });

// Mudança no layout sempre passa por aqui: guarda o estado anterior para o Desfazer.
function mudar(fn: () => void) {
  historico.push(codifica(pecas));
  if (historico.length > 100) historico.shift();
  futuro = [];
  fn();
  mudouLayout();
}
function voltar(de: string[], para: string[]) {
  if (!de.length) return;
  para.push(codifica(pecas));
  pecas = decodifica(de.pop()!, cfg.rv);
  selecionada = null;
  mudouLayout();
}
function mudouLayout() {
  montarPaleta();
  atualizar();
  umaVez('homeland_layout_usado');
}

function montarPaleta() {
  const q = semAcento($<HTMLInputElement>('busca-peca').value.trim());
  $('paleta').innerHTML = CATEGORIAS.map(([cat, nome, cor]) => {
    const itens = Object.entries(TIPOS).filter(([, t]) => t.categoria === cat && (!q || semAcento(t.nome).includes(q)));
    if (!itens.length) return '';
    return `<div><div class="mb-1.5 flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-sm" style="background:${cor}"></span><span class="rotulo text-[11px]">${nome}</span></div>
      <ul class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-1">${itens.map(([cod, t]) => {
        const lim = limite(cod), n = usadas(cod);
        const motivo = lim === 0 ? `libera no RV ${libera(cod)}` : n >= lim ? `no máximo do RV ${cfg.rv}` : `${fmt(t.w, 2)}×${fmt(t.h, 2)} tiles`;
        return `<li><button type="button" data-ferramenta="${cod}" aria-pressed="${ferramenta === cod}" ${lim === 0 || n >= lim ? 'disabled' : ''}
          data-umami-event="homeland_layout_ferramenta" data-umami-event-peca="${cod}"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-line px-2 py-1.5 text-left transition-colors hover:border-danube disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:border-casal aria-pressed:bg-casal-50">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink" style="background:${cor}">${iconeInst(t.nome)}</span>
          <span class="min-w-0 flex-1 leading-tight"><span class="block truncate text-[13px] font-semibold">${t.nome}</span><span class="block text-[11px] text-muted">${motivo}</span></span>
          <span class="shrink-0 font-mono text-[11px] ${n >= lim && lim ? 'text-ink' : 'text-muted'}">${n}/${lim}</span></button></li>`;
      }).join('')}</ul></div>`;
  }).join('') || '<p class="text-sm text-muted">Nenhuma construção com esse nome.</p>';
  $<HTMLButtonElement>('desfazer').disabled = !historico.length;
  $<HTMLButtonElement>('refazer').disabled = !futuro.length;
}
$('paleta').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-ferramenta]');
  if (!b || b.disabled) return;
  ferramenta = ferramenta === b.dataset.ferramenta ? null : b.dataset.ferramenta!;
  selecionada = null;
  montarPaleta();
  desenhar();
});
$('busca-peca').addEventListener('input', montarPaleta);
$('desfazer').addEventListener('click', () => voltar(historico, futuro));
$('refazer').addEventListener('click', () => voltar(futuro, historico));
$<HTMLSelectElement>('lote-foco').addEventListener('change', (ev) => {
  const v = (ev.target as HTMLSelectElement).value;
  visao = v ? 'lote' : 'abertos';
  if (v) loteFoco = Number(v);
  document.querySelectorAll('[data-visao]').forEach((x) => x.setAttribute('aria-pressed', String(!v && (x as HTMLElement).dataset.visao === 'abertos')));
  desenhar();
});
document.querySelectorAll<HTMLElement>('[data-visao]').forEach((b) => b.addEventListener('click', () => {
  visao = b.dataset.visao as typeof visao;
  document.querySelectorAll('[data-visao]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  desenhar();
}));

/** O que cada peça faz no plano: lavoura coberta recebe as colheitas de clima do grupo dela; o resto, na ordem. */
function rotulosDoPlano(): Map<Peca, string> {
  const saida = new Map<Peca, string>();
  const cl = climas(pecas);
  const fila = new Map<string, string[]>();
  for (const l of ultimoPlano?.linhas ?? []) {
    const k = `${l.r.instalacao}|${l.grupo ?? ''}`;
    fila.set(k, [...(fila.get(k) ?? []), ...Array(l.unidades).fill(l.r.nome)]);
  }
  const ordem = [...pecas].sort((a, b) => (cl.get(b)?.length ?? 0) - (cl.get(a)?.length ?? 0));
  for (const p of ordem) {
    if (ehClima(p)) continue;
    const nome = TIPOS[p.tipo].nome, grupo = (cl.get(p) ?? []).join('+');
    const receita = fila.get(`${nome}|${grupo}`)?.shift() ?? fila.get(`${nome}|`)?.shift();
    if (receita) saida.set(p, receita);
  }
  return saida;
}

function desenhar() {
  const abertos = lotesAbertos(cfg.rv);
  const foco = LOTES[loteFoco - 1];
  const selLote = $<HTMLSelectElement>('lote-foco');
  selLote.innerHTML = `<option value="">Ver um lote de perto…</option>${abertos.map((l) => `<option value="${l.n}" ${visao === 'lote' && l.n === loteFoco ? 'selected' : ''}>Lote ${l.n}</option>`).join('')}`;
  if (visao === 'lote' && foco && foco.rv <= cfg.rv) caixa = { x: foco.x - 0.5, y: foco.y - 0.5, w: foco.w + 1, h: foco.h + 1 };
  else if (visao === 'tudo' || !abertos.length) caixa = { x: 0, y: 0, w: LARGURA, h: ALTURA };
  else {
    const x1 = Math.min(...abertos.map((l) => l.x)), y1 = Math.min(...abertos.map((l) => l.y));
    const x2 = Math.max(...abertos.map((l) => l.x + l.w)), y2 = Math.max(...abertos.map((l) => l.y + l.h));
    caixa = { x: x1 - 0.5, y: y1 - 0.5, w: x2 - x1 + 1, h: y2 - y1 + 1 };
  }
  svg.setAttribute('viewBox', `${caixa.x} ${caixa.y} ${caixa.w} ${caixa.h}`);
  const cl = climas(pecas);
  const rotulos = rotulosDoPlano();
  const partes: string[] = [`<defs>
    <pattern id="grade" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#D4E6F4" stroke-width="0.04"/></pattern>
    <pattern id="fechado" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="1.2" fill="#EDF3F8"/><line x1="0" y1="0" x2="0" y2="1.2" stroke="#D4E6F4" stroke-width="0.35"/></pattern></defs>`];
  for (const l of LOTES) {
    const aberto = l.rv <= cfg.rv;
    partes.push(`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="${aberto ? '#F8FCFF' : 'url(#fechado)'}"/>`);
    if (aberto) partes.push(`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="url(#grade)"/>`);
    partes.push(`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="none" stroke="${aberto ? '#A9CAE6' : '#D4E6F4'}" stroke-width="0.12"/>`);
    partes.push(`<text x="${l.x + 0.5}" y="${l.y + 1.1}" font-size="0.75" font-weight="700" fill="${aberto ? '#6195C3' : '#A9CAE6'}" font-family="Plus Jakarta Sans, sans-serif">Lote ${l.n}${aberto ? '' : ` · RV ${l.rv}`}</text>`);
  }
  for (const p of pecas.filter(ehClima)) {
    const c = cobertura(p), cor = CLIMA[p.modo!]?.[1] ?? '#ccc';
    partes.push(`<rect x="${c.x1}" y="${c.y1}" width="${c.x2 - c.x1}" height="${c.y2 - c.y1}" fill="${cor}" fill-opacity="0.16" stroke="${cor}" stroke-width="0.08" stroke-dasharray="0.3 0.2" pointer-events="none"/>`);
  }
  for (const p of pecas) {
    const t = TIPOS[p.tipo], { w, h } = lados(p);
    const modos = ehClima(p) ? [p.modo!] : cl.get(p) ?? [];
    const cor = modos.length ? CLIMA[modos[0]][1] : COR_CATEGORIA[t.categoria] ?? '#fff';
    const lado = Math.min(w, h);
    const icone = Math.min(lado * 0.55, 2.2);
    const rot = rotulos.get(p);
    const cabeTexto = w >= 1.9 && h >= 1.9 && rot;
    const iy = cabeTexto ? p.y + h / 2 - icone * 0.72 : p.y + (h - icone) / 2;
    partes.push(`<g data-peca class="cursor-grab">
      <rect x="${p.x + 0.05}" y="${p.y + 0.05}" width="${w - 0.1}" height="${h - 0.1}" rx="0.3" fill="${cor}" stroke="#286464" stroke-width="0.08"/>
      ${modos.length > 1 ? `<rect x="${p.x + w - 0.75}" y="${p.y + 0.2}" width="0.5" height="0.5" rx="0.1" fill="${CLIMA[modos[1]][1]}" stroke="#286464" stroke-width="0.05"/>` : ''}
      ${iconeNoMapa(t.nome, p.x + (w - icone) / 2, iy, icone, '#15393A')}
      ${cabeTexto ? `<text x="${p.x + w / 2}" y="${p.y + h / 2 + icone * 0.62}" text-anchor="middle" font-size="${Math.min(0.5, w / 6)}" font-weight="700" fill="#15393A" font-family="Plus Jakarta Sans, sans-serif" pointer-events="none">${rot!.length > w * 3.4 ? `${rot!.slice(0, Math.floor(w * 3.4) - 1)}…` : rot}</text>` : ''}
      <title>${t.nome}${p.modo ? ` · ${CLIMA[p.modo][0]}` : ''}${rot ? ` · produz ${rot}` : ''}</title></g>`);
    if (p === selecionada) partes.push(`<rect x="${p.x - 0.18}" y="${p.y - 0.18}" width="${w + 0.36}" height="${h + 0.36}" rx="0.4" fill="none" stroke="#15393A" stroke-width="0.14" stroke-dasharray="0.45 0.3" pointer-events="none"/>`);
  }
  if (fantasma) {
    const { w, h } = lados(fantasma), ok = cabe(pecas, fantasma, cfg.rv) && usadas(fantasma.tipo) < limite(fantasma.tipo);
    partes.push(`<rect x="${fantasma.x}" y="${fantasma.y}" width="${w}" height="${h}" rx="0.3" fill="${ok ? '#2F8F6B' : '#C94B5F'}" fill-opacity="0.25" stroke="${ok ? '#2F8F6B' : '#C94B5F'}" stroke-width="0.1" pointer-events="none"/>`);
  }
  svg.innerHTML = partes.join('');
  svg.setAttribute('aria-label', `Mapa do Homeland: ${abertos.length} lotes abertos, ${pecas.length} construções`);

  // Números do layout.
  const area = abertos.length * LOTE.w * LOTE.h;
  const usada = pecas.reduce((s, p) => { const { w, h } = lados(p); return s + w * h; }, 0);
  const custo = abertos.reduce((s, l) => s + l.custo, 0);
  $('numeros-layout').innerHTML = [
    card('Lotes abertos', `${abertos.length}<span class="text-lg text-muted"> / 16</span>`, abertos.length < 16 ? `o lote ${abertos.length + 1} abre no RV ${abertos.length + 1}` : 'todos abertos'),
    card('Construções', String(pecas.length), `${pecas.filter(ehClima).length} de clima`),
    card('Área usada', `${fmt((usada / Math.max(1, area)) * 100)}%`, `${fmt(usada, 1)} de ${fmt(area)} tiles`),
    card('Custo dos lotes', fmt(custo), 'Home Coin, somando os abertos'),
  ].join('');
  $('legenda').innerHTML = CATEGORIAS.map(([, nome, cor]) => `<li class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm border border-casal/30" style="background:${cor}"></span>${nome}</li>`).join('')
    + Object.entries(CLIMA).map(([, [nome, cor]]) => `<li class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" style="background:${cor}"></span>${nome}</li>`).join('');

  // Peça selecionada.
  const sel = $('selecionada');
  sel.hidden = !selecionada;
  if (selecionada) {
    const p = selecionada, t = TIPOS[p.tipo], { w, h } = lados(p), lote = loteDe(p);
    const modos = cl.get(p) ?? [];
    sel.innerHTML = `<div class="flex flex-wrap items-center gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink" style="background:${COR_CATEGORIA[t.categoria]}">${iconeInst(t.nome, 'h-5 w-5')}</span>
      <div class="min-w-0 flex-1"><p class="font-display text-lg font-semibold leading-tight">${t.nome}</p>
        <p class="text-xs text-muted">${fmt(w, 2)}×${fmt(h, 2)} tiles${lote ? ` · lote ${lote.n}` : ''}${rotulos.get(p) ? ` · produz <strong class="text-ink">${rotulos.get(p)}</strong>` : ''}${modos.length ? ` · clima ${modos.map((m) => CLIMA[m][0]).join(' + ')}` : ''}</p></div>
      <div class="flex flex-wrap gap-2">
        ${t.climas ? t.climas.map((m) => `<button type="button" data-acao="modo" data-modo="${m}" aria-pressed="${p.modo === m}" class="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold text-ink aria-pressed:ring-2 aria-pressed:ring-casal" style="background:${CLIMA[m][1]}">${CLIMA[m][0]}</button>`).join('') : ''}
        ${t.gira ? '<button type="button" data-acao="girar" class="btn h-9 px-4 text-sm">Girar (R)</button>' : ''}
        <button type="button" data-acao="duplicar" class="btn h-9 px-4 text-sm">Duplicar (D)</button>
        <button type="button" data-acao="remover" class="btn h-9 px-4 text-sm text-err">Remover</button>
      </div></div>`;
  }

  // Cobertura e lista.
  const cob = cobertos(pecas);
  const semClima = [...cl.entries()].filter(([p, m]) => !m.length && ['fa', 'wo', 'ts', 'sh', 'fw'].includes(p.tipo)).length;
  $('cobertura').innerHTML = (Object.keys(cob).length
    ? `<ul class="space-y-1.5 text-sm">${Object.entries(cob).map(([k, n]) => { const [inst, c] = k.split('|'); return `<li class="flex items-center gap-2">${c.split('+').map(climaTag).join('')} <span class="text-danube">${iconeInst(inst)}</span><span class="font-semibold">${n}× ${inst}</span></li>`; }).join('')}</ul>`
    : '<p class="text-sm text-muted">Nenhuma construção coberta por clima ainda. Coloque um prédio de clima e lavouras dentro do quadrado pontilhado, ou use o layout automático.</p>')
    + (semClima ? `<p class="mt-2 text-xs text-muted">${semClima} lavoura(s) fora de qualquer clima: plantam só o que não pede clima.</p>` : '')
    + `<p class="mt-3 border-t border-line pt-3 text-sm">Com este layout o plano rende <strong class="font-mono">${fmt(ultimoGanho)}</strong> ${MOEDA[cfg.objetivo]}/h. Construções que você não colocou continuam no plano, só sem clima.</p>`;
  $('pecas').innerHTML = pecas.length ? pecas.map((p, i) => `<li class="flex items-center gap-2"><button type="button" data-escolher="${i}" class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-1 text-left hover:bg-danube-50 ${p === selecionada ? 'bg-casal-50' : ''}">
      <span class="text-danube">${iconeInst(TIPOS[p.tipo].nome)}</span><span class="min-w-0 flex-1 truncate">${TIPOS[p.tipo].nome}${p.modo ? ` · ${CLIMA[p.modo][0]}` : ''}${rotulos.get(p) ? ` · <span class="text-muted">${rotulos.get(p)}</span>` : ''}</span>
      <span class="font-mono text-xs text-muted">lote ${loteDe(p)?.n ?? '?'}</span></button>
    <button type="button" data-remover="${i}" class="cursor-pointer rounded-full px-2 text-xs font-semibold text-err hover:bg-[#FBEDEF]" aria-label="Remover ${TIPOS[p.tipo].nome}">remover</button></li>`).join('')
    : '<li class="text-muted">Nenhuma peça.</li>';
}

// Primeira posição livre perto de `p` (para duplicar e para colar ao lado).
function vagaPerto(p: Peca): Peca | null {
  for (let raio = 1; raio < 30; raio++)
    for (const [dx, dy] of [[raio, 0], [0, raio], [-raio, 0], [0, -raio], [raio, raio], [-raio, raio], [raio, -raio], [-raio, -raio]]) {
      const q = { ...p, x: p.x + dx * Math.ceil(lados(p).w), y: p.y + dy * Math.ceil(lados(p).h) };
      if (cabe(pecas, q, cfg.rv)) return q;
    }
  return null;
}
function acao(nome: string, extra?: string) {
  const p = selecionada;
  if (!p) return;
  if (nome === 'remover') mudar(() => { pecas = pecas.filter((x) => x !== p); selecionada = null; });
  else if (nome === 'girar' && TIPOS[p.tipo].gira) {
    const girada = { ...p, r: !p.r };
    if (cabe(pecas, girada, cfg.rv, p)) mudar(() => { p.r = !p.r; if (!p.r) delete p.r; });
    else $('auto-msg').textContent = 'Não dá para girar aqui: bate em outra construção ou sai do terreno.';
  } else if (nome === 'duplicar') {
    if (usadas(p.tipo) >= limite(p.tipo)) { $('auto-msg').textContent = `Já tem ${usadas(p.tipo)}/${limite(p.tipo)} ${TIPOS[p.tipo].nome} no RV ${cfg.rv}.`; return; }
    const q = vagaPerto(p);
    if (q) mudar(() => { pecas.push(q); selecionada = q; });
  } else if (nome === 'modo' && extra) mudar(() => { p.modo = extra; });
}
$('selecionada').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-acao]');
  if (b) acao(b.dataset.acao!, b.dataset.modo);
});

svg.addEventListener('pointerdown', (ev) => {
  svg.focus({ preventScroll: true });
  const { x, y } = ponto(ev);
  const alvo = pecaEm(x, y);
  if (alvo) {
    selecionada = alvo;
    arrasto = { p: alvo, dx: x - alvo.x, dy: y - alvo.y, moveu: false, antes: codifica(pecas) };
    svg.setPointerCapture(ev.pointerId);
    desenhar();
    return;
  }
  if (ferramenta && fantasma && cabe(pecas, fantasma, cfg.rv) && usadas(ferramenta) < limite(ferramenta)) {
    const nova = { ...fantasma };
    mudar(() => { pecas.push(nova); selecionada = nova; });
    if (usadas(ferramenta) >= limite(ferramenta)) { ferramenta = null; fantasma = null; montarPaleta(); }
    return;
  }
  selecionada = null;
  desenhar();
});
svg.addEventListener('pointermove', (ev) => {
  const { x, y } = ponto(ev);
  if (arrasto) {
    const novo = { ...arrasto.p, x: Math.round(x - arrasto.dx), y: Math.round(y - arrasto.dy) };
    if ((novo.x !== arrasto.p.x || novo.y !== arrasto.p.y) && cabe(pecas, novo, cfg.rv, arrasto.p)) {
      arrasto.p.x = novo.x; arrasto.p.y = novo.y; arrasto.moveu = true;
      desenhar();
    }
    return;
  }
  if (ferramenta && !pecaEm(x, y)) {
    const t = TIPOS[ferramenta];
    fantasma = { tipo: ferramenta, x: Math.round(x - t.w / 2), y: Math.round(y - t.h / 2), ...(t.climas && { modo: t.climas[0] }) };
  } else fantasma = null;
  desenhar();
});
svg.addEventListener('pointerleave', () => { if (fantasma) { fantasma = null; desenhar(); } });
svg.addEventListener('pointerup', () => {
  if (!arrasto) return;
  const { moveu, antes } = arrasto;
  arrasto = null;
  if (moveu) { historico.push(antes); futuro = []; mudouLayout(); }
});

// Teclado no mapa (e Ctrl+Z em qualquer lugar da aba, fora de campos de texto).
document.addEventListener('keydown', (ev) => {
  if (aba !== 'layout' || (ev.target as Element)?.closest?.('input, select, textarea')) return;
  const mod = ev.ctrlKey || ev.metaKey;
  if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? voltar(futuro, historico) : voltar(historico, futuro); return; }
  if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); voltar(futuro, historico); return; }
  if (ev.key === 'Escape') { selecionada = null; ferramenta = null; fantasma = null; montarPaleta(); desenhar(); return; }
  const p = selecionada;
  if (!p) return;
  const passo = ev.shiftKey ? 5 : 1;
  const d2 = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[ev.key];
  if (d2) {
    ev.preventDefault();
    const novo = { ...p, x: p.x + d2[0], y: p.y + d2[1] };
    if (cabe(pecas, novo, cfg.rv, p)) mudar(() => { p.x = novo.x; p.y = novo.y; });
  } else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); acao('remover'); }
  else if (ev.key.toLowerCase() === 'r') acao('girar');
  else if (ev.key.toLowerCase() === 'd') acao('duplicar');
});

$('pecas').addEventListener('click', (ev) => {
  const rem = (ev.target as HTMLElement).closest<HTMLElement>('[data-remover]');
  if (rem) { const alvo = pecas[Number(rem.dataset.remover)]; mudar(() => { pecas = pecas.filter((x) => x !== alvo); if (selecionada === alvo) selecionada = null; }); return; }
  const esc = (ev.target as HTMLElement).closest<HTMLElement>('[data-escolher]');
  if (esc) { selecionada = pecas[Number(esc.dataset.escolher)]; desenhar(); }
});
$('limpar-layout').addEventListener('click', () => { if (pecas.length) mudar(() => { pecas = []; selecionada = null; }); });

// Automático: testa cada combinação de modo de clima e de divisão das lavouras entre os prédios, fica com a que rende mais.
// Processadores, mina e o que mais você já posicionou ficam onde estão.
$('auto').addEventListener('click', () => {
  const botao = $<HTMLButtonElement>('auto');
  botao.disabled = true;
  $('auto-msg').textContent = 'Montando…';
  // Deixa o navegador pintar o "Montando…" antes da conta.
  setTimeout(() => { try { montarAutomatico(); } finally { botao.disabled = false; } }, 30);
});
const AUTO = ['fa', 'wo', 'ts', 'sh', 'fw', 'hf', 'cu', 'sl'];
function montarAutomatico() {
  const predios = (['hf', 'cu', 'sl'] as const).filter((t) => limite(t) > 0);
  if (!predios.length) {
    $('auto-msg').textContent = `Os prédios de clima liberam no RV ${libera('hf')}.`;
    return;
  }
  const fixas = pecas.filter((p) => !AUTO.includes(p.tipo));
  const quantos = Object.fromEntries(['fa', 'wo', 'ts', 'sh', 'fw'].map((t) => [t, limite(t)]));
  const modos = predios.reduce<string[][]>((acc, t) => acc.flatMap((m) => TIPOS[t].climas!.map((c) => [...m, c])), [[]]);
  const n = predios.length;
  const fatias = [Array(n).fill(1 / n), ...predios.map((_, i) => predios.map((__, j) => (j === i ? 1 : 0))),
    ...(n > 1 ? predios.map((_, i) => predios.map((__, j) => (j === i ? 0.5 : 0.5 / (n - 1)))) : [])];
  // Compara todas pela versão contínua (1 ms cada) e resolve exato só as 8 melhores: mesmo resultado que testar tudo, bem mais rápido.
  const tentativas = modos.flatMap((ms) => fatias.map((f) => montaAuto(predios.map((t, i) => ({ tipo: t, modo: ms[i] })), quantos, f, cfg.rv, fixas)))
    .map((pecasT) => ({ pecas: pecasT, estimativa: otimiza(d, { ...cfg, cobertos: cobertos(pecasT) }, { relaxado: true }).ganhoHora }))
    .sort((a, b) => b.estimativa - a.estimativa).slice(0, 8);
  let melhor: { pecas: Peca[]; ganho: number } | null = null;
  for (const t of tentativas) {
    const ganho = otimiza(d, { ...cfg, cobertos: cobertos(t.pecas) }).ganhoHora;
    if (!melhor || ganho > melhor.ganho + 0.5) melhor = { pecas: t.pecas, ganho };
  }
  const antes = otimiza(d, cfg).ganhoHora;
  mudar(() => { pecas = melhor!.pecas; selecionada = null; });
  $('auto-msg').textContent = `Testei ${modos.length * fatias.length} combinações. ${melhor!.ganho > antes + 0.5 ? `+${fmt(melhor!.ganho - antes)}/h em relação ao layout anterior.` : 'O layout anterior já era tão bom quanto.'}`;
}

// ---------- receitas ----------
const filtroInst = $<HTMLSelectElement>('filtro-instalacao');
filtroInst.innerHTML = '<option value="">Todas as instalações</option>' + d.instalacoes.filter((f) => f.tipo !== 'clima').map((f) => `<option>${f.nome}</option>`).join('');
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function mostrarReceitas() {
  const q = semAcento($<HTMLInputElement>('busca-receita').value.trim());
  const inst = filtroInst.value;
  const so = $<HTMLInputElement>('so-liberadas').checked;
  const linhas = d.receitas.filter((r) => (!inst || r.instalacao === inst)
    && (!q || semAcento([r.nome, r.instalacao, ...r.insumos.map(([i]) => nomeItem(i))].join(' ')).includes(q))
    && (!so || !bloqueio(d, r, { ...cfg, cobertos: { ...cfg.cobertos, ...(r.clima ? { [`${r.instalacao}|${r.clima}`]: 1 } : {}) } })));
  const valor = (r: Receita) => (r.moeda === 'coins' ? `${fmt(r.preco)}` : r.moeda === 'none' ? '—' : `${fmt(r.preco)} ${r.moeda === 'aniipods' ? 'Aniipod' : 'EXP'}`);
  $('receitas').innerHTML = `<thead class="text-left"><tr class="rotulo text-[11px]"><th class="px-4 py-2">Receita</th><th class="px-2 py-2">Instalação</th><th class="px-2 py-2">Usa</th>
    <th class="px-2 py-2 text-right">Ciclo</th><th class="px-2 py-2 text-right">Rende</th><th class="px-2 py-2 text-right">Vende</th><th class="px-2 py-2">Aniimo</th><th class="px-4 py-2">Situação</th></tr></thead>
    <tbody>${linhas.map((r) => {
      const b = bloqueio(d, r, cfg);
      return `<tr class="border-t border-line align-top">
        <td class="px-4 py-2"><span class="font-semibold text-ink">${r.nome}</span> ${r.clima ? climaTag(r.clima) : ''}${r.especial ? ' <span class="text-[11px] font-semibold text-warn">especial</span>' : ''}${r.naoVerificada ? ' <span class="text-[11px] font-semibold text-muted">não verificado</span>' : ''}</td>
        <td class="px-2 py-2 whitespace-nowrap"><span class="inline-flex items-center gap-1.5"><span class="text-danube">${iconeInst(r.instalacao)}</span>${r.instalacao}</span> <span class="text-xs text-muted">Nv. ${r.nivel}</span></td>
        <td class="px-2 py-2 text-xs text-muted">${r.insumos.map(([i, n]) => `${n} ${nomeItem(i)}`).join(' + ') || (r.custo ? `semente: ${fmt(r.custo)}` : '—')}</td>
        <td class="px-2 py-2 text-right font-mono text-muted">${tempo(ciclo(d, r, cfg).segundos)}</td>
        <td class="px-2 py-2 text-right font-mono">${r.rendimento}${r.subproduto ? `<span class="block text-[11px] text-muted">+${r.subproduto[1]} ${nomeItem(r.subproduto[0])}</span>` : ''}</td>
        <td class="px-2 py-2 text-right font-mono">${valor(r)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${r.requisito ? `${habilidade(r.requisito.habilidade)} <span class="text-xs font-semibold">Nv. ${r.requisito.nivel}</span>` : (r.passos ?? []).map((p) => habilidade(p.habilidade)).join(' ')}</td>
        <td class="px-4 py-2 text-xs ${b ? 'text-muted' : 'font-semibold text-ok'}">${b ? `precisa: ${b}` : 'liberada'}</td></tr>`;
    }).join('')}</tbody>`;
  if (!linhas.length) $('receitas').innerHTML += '<tbody><tr><td class="p-4 text-sm text-muted">Nenhuma receita com esses filtros.</td></tr></tbody>';
}
$('busca-receita').addEventListener('input', () => { mostrarReceitas(); umaVez('homeland_receitas_busca'); });
filtroInst.addEventListener('change', mostrarReceitas);
$('so-liberadas').addEventListener('change', mostrarReceitas);

// ---------- níveis de RV ----------
function mostrarNiveis(ganhoHora: number) {
  $('niveis').innerHTML = `<thead class="text-left"><tr class="rotulo text-[11px]"><th class="px-4 py-2">RV</th><th class="px-2 py-2 text-right">Home Coin</th><th class="px-2 py-2">Materiais</th>
    <th class="px-2 py-2 text-right">Aniimo no Homeland</th><th class="px-4 py-2 text-right">Moedas no ritmo atual</th></tr></thead>
    <tbody>${Object.entries(d.custosRV).map(([rv, c]) => {
      const n = Number(rv), atual = n === cfg.rv + 1;
      return `<tr class="border-t border-line ${atual ? 'bg-casal-50' : n <= cfg.rv ? 'text-muted' : ''}">
        <td class="px-4 py-2 font-semibold">${n <= cfg.rv ? '✓ ' : ''}RV ${n}${atual ? ' <span class="text-[11px] text-casal">próximo</span>' : ''}</td>
        <td class="px-2 py-2 text-right font-mono">${fmt(c.coins)}</td>
        <td class="px-2 py-2 text-xs">${c.items.map(([i, q]) => `${fmt(q)} ${nomeItem(i)}`).join(' + ')}</td>
        <td class="px-2 py-2 text-right font-mono">${d.aniimoMax[n - 1] ?? '—'}</td>
        <td class="px-4 py-2 text-right font-mono text-muted">${n > cfg.rv && cfg.objetivo === 'coins' && ganhoHora > 0 ? tempo((c.coins / ganhoHora) * 3600) : '—'}</td></tr>`;
    }).join('')}</tbody>`;
}

// ---------- abas, compartilhar, ciclo principal ----------
function mostrarAba() {
  document.querySelectorAll<HTMLElement>('[data-aba]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
  document.querySelectorAll<HTMLElement>('[data-painel]').forEach((p) => (p.hidden = p.dataset.painel !== aba));
}
document.querySelectorAll<HTMLElement>('[data-aba]').forEach((b) => b.addEventListener('click', () => { aba = b.dataset.aba!; mostrarAba(); gravarLink(); }));

let rodando = 0;
let ultimoGanho = 0;
let ultimoPlano: Plano | null = null;
function atualizar() {
  cfg.cobertos = cobertos(pecas);
  cancelAnimationFrame(rodando);
  rodando = requestAnimationFrame(() => {
    const p = otimiza(d, cfg);
    ultimoGanho = p.ganhoHora;
    ultimoPlano = p;
    mostrarPlano(p);
    mostrarNiveis(p.ganhoHora);
    mostrarReceitas();
    desenhar();
    gravarLink();
  });
}

const rotuloCopiar = $('copiar');
async function copiarLink() {
  await navigator.clipboard.writeText(location.href);
  rotuloCopiar.textContent = 'Link copiado';
  setTimeout(() => (rotuloCopiar.textContent = 'Copiar link'), 1800);
}
rotuloCopiar.addEventListener('click', copiarLink);
$('compartilhar').addEventListener('click', async () => {
  const dados = { title: 'Meu Homeland no Aniimo Tools', text: `Meu Homeland no RV ${cfg.rv}`, url: location.href };
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share(dados); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  copiarLink();
});

lerLink();
montarConfig();
montarPaleta();
mostrarAba();
atualizar();
