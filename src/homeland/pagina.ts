// Interface do Otimizador de Homeland. Estado inteiro no link (?rv=…&l=…), para compartilhar o Homeland.
import dadosBrutos from '../../data/homeland.json';
import { bloqueio, ciclo, melhorias, otimiza, padrao, type Config, type Dados, type Objetivo, type Plano, type Receita } from './otimizador.ts';
import { ALTURA, LARGURA, TIPOS, cabe, climas, cobertos, cobertura, codifica, decodifica, ehClima, montaAuto, type Peca } from './layout.ts';
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
  pecas = decodifica(q.get('l') ?? '');
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
    montarConfig();
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
    card('Aniimo trabalhando', `${p.aniimoTotal}${max ? ` <span class="text-lg text-muted">/ ${max}</span>` : ''}`, max && p.aniimoTotal > max ? 'mais do que seu RV comporta: priorize as linhas de cima' : 'que o seu Homeland comporta'),
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

  $('equipe').innerHTML = p.equipe.length ? `<ul class="space-y-2">${p.equipe.map((e) => `
    <li class="flex items-center gap-2 text-sm"><span class="font-mono font-semibold text-casal">×${e.quantos}</span>${habilidade(e.habilidade)}
      <span class="font-semibold">Nv. ${e.nivel}</span><span class="min-w-0 flex-1 truncate text-xs text-muted" title="${e.instalacao}">${e.instalacao}${e.personalidade && cfg.personalidade ? ` · ${e.personalidade}` : ''}</span></li>`).join('')}</ul>
    <p class="mt-3 text-xs text-muted">Nível = o que o plano assume. Nome da personalidade como aparece nos dados (em inglês). Um mesmo Aniimo pode cobrir mais de uma linha se tiver as duas habilidades.</p>`
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
const NS = 'http://www.w3.org/2000/svg';
let ferramenta: string | null = 'fa';
let fantasma: Peca | null = null;
let arrasto: { p: Peca; dx: number; dy: number; moveu: boolean; ox: number; oy: number } | null = null;

const limite = (tipo: string) => cfg.instalacoes[TIPOS[tipo].nome]?.qtd ?? 0;
const usadas = (tipo: string) => pecas.filter((p) => p.tipo === tipo).length;
const ponto = (ev: PointerEvent) => {
  const r = svg.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * LARGURA, y: ((ev.clientY - r.top) / r.height) * ALTURA };
};
const pecaEm = (x: number, y: number) => [...pecas].reverse().find((p) => x >= p.x && x < p.x + TIPOS[p.tipo].lado && y >= p.y && y < p.y + TIPOS[p.tipo].lado);

function montarPaleta() {
  $('paleta').innerHTML = Object.entries(TIPOS).map(([cod, t]) => {
    const lim = limite(cod), n = usadas(cod);
    const libera = Object.values(porNome.get(t.nome)?.niveis ?? {})[0];
    return `<button type="button" data-ferramenta="${cod}" aria-pressed="${ferramenta === cod}" ${lim === 0 ? 'disabled' : ''}
      data-umami-event="homeland_layout_ferramenta" data-umami-event-peca="${cod}"
      class="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-casal aria-pressed:bg-casal aria-pressed:text-white border-danube-100 bg-white text-casal"
      title="${t.lado}×${t.lado} tiles${lim === 0 ? ` · libera no RV ${libera}` : ''}"><span class="inline-flex items-center gap-1.5">${iconeInst(t.nome, 'h-3.5 w-3.5')}${t.nome} <span class="font-mono">${n}/${lim}</span></span></button>`;
  }).join('') + `<button type="button" data-ferramenta="apagar" aria-pressed="${ferramenta === 'apagar'}" data-umami-event="homeland_layout_ferramenta" data-umami-event-peca="apagar"
    class="cursor-pointer rounded-full border border-[#F2C4CC] bg-white px-3 py-1.5 text-xs font-semibold text-[#8A2F3E] aria-pressed:bg-[#FBEDEF]">Apagar</button>`;
}
$('paleta').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-ferramenta]');
  if (!b || b.disabled) return;
  ferramenta = ferramenta === b.dataset.ferramenta ? null : b.dataset.ferramenta!;
  montarPaleta();
});

function desenhar() {
  svg.setAttribute('viewBox', `0 0 ${LARGURA} ${ALTURA}`);
  const cl = climas(pecas);
  const partes: string[] = [
    `<defs><pattern id="grade" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#D4E6F4" stroke-width="0.04"/></pattern></defs>`,
    `<rect width="${LARGURA}" height="${ALTURA}" fill="#F5FAFF"/><rect width="${LARGURA}" height="${ALTURA}" fill="url(#grade)"/>`,
  ];
  for (const p of pecas.filter(ehClima)) {
    const c = cobertura(p), cor = CLIMA[p.modo!]?.[1] ?? '#ccc';
    partes.push(`<rect x="${c.x1}" y="${c.y1}" width="${c.x2 - c.x1}" height="${c.y2 - c.y1}" fill="${cor}" fill-opacity="0.16" stroke="${cor}" stroke-width="0.08" stroke-dasharray="0.3 0.2"/>`);
  }
  for (const p of pecas) {
    const t = TIPOS[p.tipo];
    const c = ehClima(p) ? p.modo! : cl.get(p);
    const cor = ehClima(p) ? CLIMA[p.modo!][1] : c === 'misto' ? '#FBEDEF' : c ? CLIMA[c][1] : '#FFFFFF';
    partes.push(`<g class="cursor-grab"><rect x="${p.x + 0.06}" y="${p.y + 0.06}" width="${t.lado - 0.12}" height="${t.lado - 0.12}" rx="0.3" fill="${cor}"
      stroke="${c === 'misto' ? '#C94B5F' : '#286464'}" stroke-width="0.1" ${ehClima(p) ? '' : 'fill-opacity="0.9"'}/>
      ${iconeNoMapa(t.nome, p.x + t.lado * 0.2, p.y + t.lado * 0.2, t.lado * 0.6, '#15393A')}<title>${t.nome}${p.modo ? ` · ${CLIMA[p.modo][0]}` : ''}</title></g>`);
  }
  if (fantasma) {
    const t = TIPOS[fantasma.tipo], ok = cabe(pecas, fantasma) && usadas(fantasma.tipo) < limite(fantasma.tipo);
    partes.push(`<rect x="${fantasma.x}" y="${fantasma.y}" width="${t.lado}" height="${t.lado}" rx="0.3" fill="${ok ? '#2F8F6B' : '#C94B5F'}" fill-opacity="0.25" stroke="${ok ? '#2F8F6B' : '#C94B5F'}" stroke-width="0.1" pointer-events="none"/>`);
  }
  svg.innerHTML = partes.join('');

  const cob = cobertos(pecas);
  const ganhoAtual = ultimoGanho;
  const mistos = [...cl.values()].filter((c) => c === 'misto').length;
  const semClima = [...cl.values()].filter((c) => !c).length;
  $('cobertura').innerHTML = (Object.keys(cob).length
    ? `<ul class="space-y-1.5 text-sm">${Object.entries(cob).map(([k, n]) => { const [inst, c] = k.split('|'); return `<li class="flex items-center gap-2">${climaTag(c)} <span class="text-danube">${iconeInst(inst)}</span><span class="font-semibold">${n}× ${inst}</span></li>`; }).join('')}</ul>`
    : '<p class="text-sm text-muted">Nenhuma lavoura coberta por clima ainda. Coloque um prédio de clima e lavouras dentro do quadrado pontilhado.</p>')
    + (mistos ? `<p class="mt-2 text-xs font-semibold text-err">${mistos} lavoura(s) pegam dois climas ao mesmo tempo e não contam. Afaste um dos prédios.</p>` : '')
    + (semClima ? `<p class="mt-2 text-xs text-muted">${semClima} lavoura(s) fora de qualquer clima: plantam só o que não pede clima.</p>` : '')
    + `<p class="mt-3 border-t border-line pt-3 text-sm">Com este layout o plano rende <strong class="font-mono">${fmt(ganhoAtual)}</strong> ${MOEDA[cfg.objetivo]}/h. As lavouras que você não colocou aqui continuam no plano, só sem clima.</p>`;
  $('pecas').innerHTML = pecas.length ? pecas.map((p, i) => `<li class="flex items-center gap-2"><span class="text-danube">${iconeInst(TIPOS[p.tipo].nome)}</span><span class="flex-1">${TIPOS[p.tipo].nome}${p.modo ? ` · ${CLIMA[p.modo][0]}` : ''} <span class="font-mono text-xs text-muted">(${p.x}, ${p.y})</span></span>
    <button type="button" data-remover="${i}" class="cursor-pointer rounded-full px-2 text-xs font-semibold text-err hover:bg-[#FBEDEF]" aria-label="Remover">remover</button></li>`).join('')
    : '<li class="text-muted">Nenhuma peça.</li>';
}

function mudouLayout() {
  montarPaleta();
  atualizar();
  umaVez('homeland_layout_usado');
}

svg.addEventListener('pointerdown', (ev) => {
  const { x, y } = ponto(ev);
  const alvo = pecaEm(x, y);
  if (ferramenta === 'apagar') {
    if (alvo) { pecas = pecas.filter((p) => p !== alvo); mudouLayout(); }
    return;
  }
  if (alvo) {
    arrasto = { p: alvo, dx: x - alvo.x, dy: y - alvo.y, moveu: false, ox: alvo.x, oy: alvo.y };
    svg.setPointerCapture(ev.pointerId);
    return;
  }
  if (ferramenta && fantasma && cabe(pecas, fantasma) && usadas(ferramenta) < limite(ferramenta)) {
    pecas.push({ ...fantasma });
    mudouLayout();
  }
});
svg.addEventListener('pointermove', (ev) => {
  const { x, y } = ponto(ev);
  if (arrasto) {
    const lado = TIPOS[arrasto.p.tipo].lado;
    const nx = Math.round(x - arrasto.dx), ny = Math.round(y - arrasto.dy);
    const novo = { ...arrasto.p, x: Math.max(0, Math.min(LARGURA - lado, nx)), y: Math.max(0, Math.min(ALTURA - lado, ny)) };
    if ((novo.x !== arrasto.p.x || novo.y !== arrasto.p.y) && cabe(pecas, novo, arrasto.p)) {
      arrasto.p.x = novo.x; arrasto.p.y = novo.y; arrasto.moveu = true;
      desenhar();
    }
    return;
  }
  if (ferramenta && ferramenta !== 'apagar' && !pecaEm(x, y)) {
    const t = TIPOS[ferramenta];
    fantasma = { tipo: ferramenta, x: Math.max(0, Math.min(LARGURA - t.lado, Math.round(x - t.lado / 2))), y: Math.max(0, Math.min(ALTURA - t.lado, Math.round(y - t.lado / 2))), ...(t.climas && { modo: t.climas[0] }) };
  } else fantasma = null;
  desenhar();
});
svg.addEventListener('pointerleave', () => { fantasma = null; desenhar(); });
svg.addEventListener('pointerup', () => {
  if (!arrasto) return;
  const { p, moveu } = arrasto;
  arrasto = null;
  // Clique sem arrastar num prédio de clima: alterna o modo (Quente ⇄ Escaldante, Fresco ⇄ Congelante).
  if (!moveu && ehClima(p) && TIPOS[p.tipo].climas!.length > 1) {
    const ms = TIPOS[p.tipo].climas!;
    p.modo = ms[(ms.indexOf(p.modo!) + 1) % ms.length];
  }
  if (moveu || ehClima(p)) mudouLayout();
});
$('pecas').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-remover]');
  if (!b) return;
  pecas.splice(Number(b.dataset.remover), 1);
  mudouLayout();
});
$('limpar-layout').addEventListener('click', () => { pecas = []; mudouLayout(); });

// Automático: testa cada combinação de modo de clima e de divisão das lavouras entre os prédios, fica com a que rende mais.
$('auto').addEventListener('click', () => {
  const botao = $<HTMLButtonElement>('auto');
  botao.disabled = true;
  $('auto-msg').textContent = 'Montando…';
  // Deixa o navegador pintar o "Montando…" antes da conta.
  setTimeout(() => { try { montarAutomatico(); } finally { botao.disabled = false; } }, 30);
});
function montarAutomatico() {
  const predios = (['hf', 'cu', 'sl'] as const).filter((t) => limite(t) > 0);
  if (!predios.length) {
    $('auto-msg').textContent = `Os prédios de clima liberam no RV ${Object.values(porNome.get('Heat Furnace')!.niveis)[0]}.`;
    return;
  }
  const quantos = Object.fromEntries(['fa', 'wo', 'ts', 'sh', 'fw'].map((t) => [t, limite(t)]));
  const modos = predios.reduce<string[][]>((acc, t) => acc.flatMap((m) => TIPOS[t].climas!.map((c) => [...m, c])), [[]]);
  const n = predios.length;
  const fatias = [Array(n).fill(1 / n), ...predios.map((_, i) => predios.map((__, j) => (j === i ? 1 : 0))),
    ...(n > 1 ? predios.map((_, i) => predios.map((__, j) => (j === i ? 0.5 : 0.5 / (n - 1)))) : [])];
  // Compara todas pela versão contínua (1 ms cada) e resolve exato só as 8 melhores: mesmo resultado que testar tudo, bem mais rápido.
  const tentativas = modos.flatMap((ms) => fatias.map((f) => montaAuto(predios.map((t, i) => ({ tipo: t, modo: ms[i] })), quantos, f)))
    .map((pecasT) => ({ pecas: pecasT, estimativa: otimiza(d, { ...cfg, cobertos: cobertos(pecasT) }, { relaxado: true }).ganhoHora }))
    .sort((a, b) => b.estimativa - a.estimativa).slice(0, 8);
  let melhor: { pecas: Peca[]; ganho: number } | null = null;
  for (const t of tentativas) {
    const ganho = otimiza(d, { ...cfg, cobertos: cobertos(t.pecas) }).ganhoHora;
    if (!melhor || ganho > melhor.ganho + 0.5) melhor = { pecas: t.pecas, ganho };
  }
  const antes = otimiza(d, cfg).ganhoHora;
  pecas = melhor!.pecas;
  $('auto-msg').textContent = `Testei ${modos.length * fatias.length} combinações. ${melhor!.ganho > antes + 0.5 ? `+${fmt(melhor!.ganho - antes)}/h em relação ao layout anterior.` : 'O layout anterior já era tão bom quanto.'}`;
  mudouLayout();
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
function atualizar() {
  cfg.cobertos = cobertos(pecas);
  cancelAnimationFrame(rodando);
  rodando = requestAnimationFrame(() => {
    const p = otimiza(d, cfg);
    ultimoGanho = p.ganhoHora;
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
