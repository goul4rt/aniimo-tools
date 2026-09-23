// Planejador de layout do Homeland na grade real do jogo: 16 lotes de 20×15 tiles numa grade 4×4, o lote N libera no RV N,
// e cada construção no tamanho de verdade (dados do Hideout Guides, com permissão; ver data/homeland-hideout.json).
// Prédio de clima cobre 9×9 centrado nele; uma construção conta como coberta se o seu retângulo encosta na zona com área real.
import hideout from '../../data/homeland-hideout.json' with { type: 'json' };

export type Peca = { tipo: string; x: number; y: number; r?: boolean; modo?: string };
type Tipo = { slug: string; nome: string; w: number; h: number; gira: boolean; categoria: string; climas?: string[]; influencia?: { w: number; h: number } };

// Código de 2 letras de cada construção no link. Os 9 primeiros já existiam antes da grade real: não mudar.
const CODIGO: Record<string, string> = {
  farmland: 'fa', woodland: 'wo', 'dewy-house': 'dh', 'tidewhisper-sandcastle': 'ts', 'starfall-hammock': 'sh', 'floral-windmill': 'fw',
  'heat-furnace': 'hf', 'cooling-unit': 'cu', sunlamp: 'sl',
  mine: 'mi', well: 'we', 'nimbus-bed': 'nb', 'carousel-mill': 'cm', 'crafting-table': 'ct', 'claw-game-cooker': 'cg', 'jukebox-dryer': 'jd',
  'simmering-pot': 'sp', 'phonolfactory-table': 'pt', 'bouncy-brew-keg': 'bk', 'blazing-stove': 'bs', 'pickling-jar': 'pj',
  'joy-wheel-loom': 'jl', 'dance-pad-polisher': 'dp', 'aniipod-maker': 'am', 'woodworking-bench': 'wb', 'chimney-kiln': 'ck',
};
const MODOS = hideout.clima.modos as Record<string, string[]>;
export const TIPOS: Record<string, Tipo> = Object.fromEntries(hideout.instalacoes.map((f) => [CODIGO[f.slug], {
  slug: f.slug, nome: f.nome, w: f.tamanho.w, h: f.tamanho.h, gira: f.gira, categoria: f.categoria,
  ...(MODOS[f.slug] && { climas: MODOS[f.slug] }),
  ...('influencia' in f && { influencia: f.influencia as { w: number; h: number } }),
}]));
export const CODIGO_DO_NOME = Object.fromEntries(Object.entries(TIPOS).map(([c, t]) => [t.nome, c]));

export const LOTE = hideout.lote;
export const LARGURA = LOTE.w * 4;
export const ALTURA = LOTE.h * 4;
/** Retângulo (em tiles) de cada lote, na ordem do jogo (lote 1 primeiro). */
export const LOTES = hideout.grade.map((g, i) => ({ n: i + 1, x: g.col * LOTE.w, y: g.row * LOTE.h, w: LOTE.w, h: LOTE.h, rv: hideout.liberaLote[i], custo: hideout.custoLote[i] }));
export const lotesAbertos = (rv: number) => LOTES.filter((l) => l.rv <= rv);

export const ehClima = (p: Peca) => !!TIPOS[p.tipo]?.climas;
/** Largura e altura da peça, já girada. */
export const lados = (p: Peca) => { const t = TIPOS[p.tipo]; return p.r && t.gira ? { w: t.h, h: t.w } : { w: t.w, h: t.h }; };

type Ret = { x1: number; y1: number; x2: number; y2: number };
const EPS = 1e-9;
export const ret = (p: Peca): Ret => { const { w, h } = lados(p); return { x1: p.x, y1: p.y, x2: p.x + w, y2: p.y + h }; };
const sobrepoe = (a: Ret, b: Ret) => a.x1 < b.x2 - EPS && a.x2 > b.x1 + EPS && a.y1 < b.y2 - EPS && a.y2 > b.y1 + EPS;
export const cobertura = (p: Peca): Ret => {
  const { w, h } = lados(p), inf = TIPOS[p.tipo].influencia ?? { w: 9, h: 9 };
  const cx = p.x + w / 2, cy = p.y + h / 2;
  return { x1: cx - inf.w / 2, y1: cy - inf.h / 2, x2: cx + inf.w / 2, y2: cy + inf.h / 2 };
};

/** Todo tile que a peça toca está num lote aberto neste RV? */
export function noTerreno(p: Peca, rv: number) {
  const r = ret(p);
  if (r.x1 < 0 || r.y1 < 0 || r.x2 > LARGURA + EPS || r.y2 > ALTURA + EPS) return false;
  const abertos = lotesAbertos(rv);
  for (let y = Math.floor(r.y1); y < r.y2 - EPS; y++)
    for (let x = Math.floor(r.x1); x < r.x2 - EPS; x++)
      if (!abertos.some((l) => x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h)) return false;
  return true;
}

/** Cabe no terreno aberto e não bate em nenhuma outra (menos `ignorar`, que é ela mesma sendo movida). */
export function cabe(pecas: Peca[], p: Peca, rv: number, ignorar?: Peca) {
  if (!noTerreno(p, rv)) return false;
  const r = ret(p);
  return !pecas.some((o) => o !== ignorar && sobrepoe(r, ret(o)));
}

/** Climas que chegam a cada peça (lista ordenada; vazia = nenhum). Dentro de duas zonas, vale o melhor dos dois. */
export function climas(pecas: Peca[]) {
  const predios = pecas.filter(ehClima);
  return new Map(pecas.filter((p) => !ehClima(p)).map((p) => {
    const r = ret(p);
    const modos = new Set(predios.filter((b) => sobrepoe(r, cobertura(b))).map((b) => b.modo ?? TIPOS[b.tipo].climas![0]));
    return [p, [...modos].sort()] as const;
  }));
}

/** Para o otimizador: "Farmland|Cool+Scorching" → quantos lotes de Farmland pegam exatamente esses climas. */
export function cobertos(pecas: Peca[]) {
  const saida: Record<string, number> = {};
  for (const [p, c] of climas(pecas)) if (c.length) { const k = `${TIPOS[p.tipo].nome}|${c.join('+')}`; saida[k] = (saida[k] ?? 0) + 1; }
  return saida;
}

// Link: código(2) + x(2) + y(2) em base 36, "r" se girada, letra do modo de clima; peças separadas por ".".
const MODO: Record<string, string> = { Warm: 'w', Scorching: 's', Cool: 'c', Freeze: 'z', Adequate: 'a' };
const MODO_DE = Object.fromEntries(Object.entries(MODO).map(([k, v]) => [v, k]));
const b36 = (n: number) => n.toString(36).padStart(2, '0');
export const codifica = (pecas: Peca[]) =>
  pecas.map((p) => p.tipo + b36(p.x) + b36(p.y) + (p.r ? 'r' : '') + (p.modo && TIPOS[p.tipo].climas!.length > 1 ? MODO[p.modo] : '')).join('.');

export function decodifica(txt: string, rv: number): Peca[] {
  const saida: Peca[] = [];
  for (const parte of txt.split('.')) {
    const m = parte.match(/^([a-z]{2})([0-9a-z]{2})([0-9a-z]{2})(r?)([wscz]?)$/);
    if (!m || !TIPOS[m[1]]) continue;
    const [, tipo, x, y, r, modo] = m;
    const p: Peca = { tipo, x: parseInt(x, 36), y: parseInt(y, 36), ...(r && TIPOS[tipo].gira && { r: true }) };
    if (TIPOS[tipo].climas) p.modo = MODO_DE[modo] ?? TIPOS[tipo].climas![0];
    if (cabe(saida, p, rv)) saida.push(p); // link antigo, adulterado ou de RV maior: ignora o que não cabe
  }
  return saida;
}

// ---------- layout automático ----------
/** Instalação especial que só rende naquele clima: Castelo de Areia (pérola, Quente), Rede (estrela, Fresco), Moinho (escamas, Adequado). */
const ESPECIAL: Record<string, string> = { hf: 'ts', cu: 'sh', sl: 'fw' };

/** Encaixa até `n` peças do `tipo` dentro da zona do prédio, do centro para fora. Devolve quantas couberam. */
function encaixa(pecas: Peca[], predio: Peca, tipo: string, n: number, rv: number) {
  const { w, h } = lados({ tipo, x: 0, y: 0 }), zona = cobertura(predio);
  const cx = (zona.x1 + zona.x2) / 2, cy = (zona.y1 + zona.y2) / 2;
  const vagas: [number, number][] = [];
  for (let x = Math.ceil(zona.x1 - w + 0.01); x < zona.x2; x++)
    for (let y = Math.ceil(zona.y1 - h + 0.01); y < zona.y2; y++) vagas.push([x, y]);
  vagas.sort(([ax, ay], [bx, by]) => Math.hypot(ax + w / 2 - cx, ay + h / 2 - cy) - Math.hypot(bx + w / 2 - cx, by + h / 2 - cy));
  let postas = 0;
  for (const [x, y] of vagas) {
    if (postas >= n) break;
    const p = { tipo, x, y };
    if (cabe(pecas, p, rv)) { pecas.push(p); postas++; }
  }
  return postas;
}

/**
 * Monta um layout com os prédios de clima dados (tipo + modo), cada um no meio de um lote aberto diferente,
 * e as lavouras divididas entre eles (`fatias[i]` = fração de Farmland e Woodland do prédio i).
 * `fixas` são peças que ficam onde estão (processadores, mina… que o jogador já posicionou).
 */
export function montaAuto(predios: { tipo: string; modo: string }[], quantos: Record<string, number>, fatias: number[], rv: number, fixas: Peca[] = []): Peca[] {
  const pecas: Peca[] = [...fixas];
  const restam = { ...quantos };
  const lugares: Peca[] = [];
  for (const b of predios) {
    const { w, h } = lados({ tipo: b.tipo, x: 0, y: 0 });
    // Primeiro lote aberto (na ordem do jogo) onde o prédio cabe no centro sem a zona encostar na de outro.
    for (const l of lotesAbertos(rv)) {
      const p: Peca = { tipo: b.tipo, x: Math.round(l.x + l.w / 2 - w / 2), y: Math.round(l.y + l.h / 2 - h / 2), modo: b.modo };
      if (!lugares.some((o) => sobrepoe(cobertura(o), cobertura(p))) && cabe(pecas, p, rv)) { pecas.push(p); lugares.push(p); break; }
    }
  }
  lugares.forEach((p, i) => {
    const esp = ESPECIAL[p.tipo];
    if (esp && (restam[esp] ?? 0) > 0) restam[esp] -= encaixa(pecas, p, esp, restam[esp], rv);
    for (const tipo of ['wo', 'fa']) {
      const cota = i === lugares.length - 1 ? restam[tipo] ?? 0 : Math.round((quantos[tipo] ?? 0) * fatias[i]);
      restam[tipo] = (restam[tipo] ?? 0) - encaixa(pecas, p, tipo, Math.min(cota, restam[tipo] ?? 0), rv);
    }
  });
  return pecas;
}
