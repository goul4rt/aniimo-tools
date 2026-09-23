// Planejador de layout do Homeland: onde ficam as lavouras e os prédios de clima, e quem fica coberto.
// Geometria (aniimax, medido no jogo): prédio de clima 2×2 cobre um quadrado 9×9 centrado nele; uma instalação
// conta como coberta se o seu quadrado se sobrepõe à cobertura com área real (encostar na quina não vale).

export type Peca = { tipo: string; x: number; y: number; modo?: string };

/** Tipos que o planejador conhece: código curto (para o link), nome no jogo, lado em tiles, climas possíveis. */
export const TIPOS: Record<string, { nome: string; lado: number; climas?: string[] }> = {
  fa: { nome: 'Farmland', lado: 2 },
  wo: { nome: 'Woodland', lado: 4 },
  dh: { nome: 'Dewy House', lado: 2 },
  ts: { nome: 'Tidewhisper Sandcastle', lado: 5 },
  sh: { nome: 'Starfall Hammock', lado: 5 },
  fw: { nome: 'Floral Windmill', lado: 5 },
  hf: { nome: 'Heat Furnace', lado: 2, climas: ['Warm', 'Scorching'] },
  cu: { nome: 'Cooling Unit', lado: 2, climas: ['Cool', 'Freeze'] },
  sl: { nome: 'Sunlamp', lado: 2, climas: ['Adequate'] },
};
export const CODIGO_DO_NOME = Object.fromEntries(Object.entries(TIPOS).map(([c, t]) => [t.nome, c]));
const MODO: Record<string, string> = { Warm: 'w', Scorching: 's', Cool: 'c', Freeze: 'z', Adequate: 'a' };
const MODO_DE = Object.fromEntries(Object.entries(MODO).map(([k, v]) => [v, k]));

export const RAIO = 4.5;
export const LARGURA = 48;
export const ALTURA = 32;

type Ret = { x1: number; y1: number; x2: number; y2: number };
const ret = (p: Peca): Ret => ({ x1: p.x, y1: p.y, x2: p.x + TIPOS[p.tipo].lado, y2: p.y + TIPOS[p.tipo].lado });
const sobrepoe = (a: Ret, b: Ret) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
export const cobertura = (p: Peca): Ret => {
  const cx = p.x + TIPOS[p.tipo].lado / 2, cy = p.y + TIPOS[p.tipo].lado / 2;
  return { x1: cx - RAIO, y1: cy - RAIO, x2: cx + RAIO, y2: cy + RAIO };
};
export const ehClima = (p: Peca) => !!TIPOS[p.tipo].climas;

/** A peça cabe na área e não bate em nenhuma outra (menos a `ignorar`, que é ela mesma sendo movida)? */
export function cabe(pecas: Peca[], p: Peca, ignorar?: Peca) {
  const r = ret(p);
  if (r.x1 < 0 || r.y1 < 0 || r.x2 > LARGURA || r.y2 > ALTURA) return false;
  return !pecas.some((o) => o !== ignorar && sobrepoe(r, ret(o)));
}

/** Clima de cada peça que não é prédio de clima: um clima, 'misto' (dois climas diferentes) ou undefined. */
export function climas(pecas: Peca[]) {
  const predios = pecas.filter(ehClima);
  return new Map(pecas.filter((p) => !ehClima(p)).map((p) => {
    const r = ret(p);
    const achados = new Set(predios.filter((b) => sobrepoe(r, cobertura(b))).map((b) => b.modo ?? TIPOS[b.tipo].climas![0]));
    return [p, achados.size === 0 ? undefined : achados.size === 1 ? [...achados][0] : 'misto'] as const;
  }));
}

/** Para o otimizador: "Farmland|Warm" → quantos lotes de Farmland estão nesse clima. Misto não conta. */
export function cobertos(pecas: Peca[]) {
  const saida: Record<string, number> = {};
  for (const [p, c] of climas(pecas)) if (c && c !== 'misto') saida[`${TIPOS[p.tipo].nome}|${c}`] = (saida[`${TIPOS[p.tipo].nome}|${c}`] ?? 0) + 1;
  return saida;
}

// Link: cada peça vira código(2) + x(2) + y(2) em base 36 (+ letra do modo de clima), separadas por ".". Ex.: "fa0a05.hf0c0cs".
const b36 = (n: number) => n.toString(36).padStart(2, '0');
export const codifica = (pecas: Peca[]) =>
  pecas.map((p) => p.tipo + b36(p.x) + b36(p.y) + (p.modo && TIPOS[p.tipo].climas!.length > 1 ? MODO[p.modo] : '')).join('.');

export function decodifica(txt: string): Peca[] {
  const saida: Peca[] = [];
  for (const parte of txt.split('.')) {
    const m = parte.match(/^([a-z]{2})([0-9a-z]{2})([0-9a-z]{2})([wscz]?)$/);
    if (!m) continue;
    const [, tipo, x, y, modo] = m;
    if (!TIPOS[tipo]) continue;
    const p: Peca = { tipo, x: parseInt(x, 36), y: parseInt(y, 36) };
    if (TIPOS[tipo].climas) p.modo = MODO_DE[modo] ?? TIPOS[tipo].climas![0];
    if (cabe(saida, p)) saida.push(p); // link adulterado ou antigo: ignora o que não cabe
  }
  return saida;
}

// ---------- layout automático ----------
// Cada prédio de clima ganha uma área própria (as zonas não se tocam, então nada fica "misto").
const ANCORAS: [number, number][] = [[6, 6], [22, 6], [38, 6]];
/** Instalação especial que só rende naquele clima: Castelo de Areia (pérola, Quente), Rede (estrela, Fresco), Moinho (escamas, Adequado). */
const ESPECIAL: Record<string, string> = { hf: 'ts', cu: 'sh', sl: 'fw' };

/** Encaixa até `n` peças do `tipo` dentro da cobertura do prédio, do centro para fora. Devolve quantas couberam. */
function encaixa(pecas: Peca[], predio: Peca, tipo: string, n: number) {
  const lado = TIPOS[tipo].lado, zona = cobertura(predio);
  const cx = predio.x + 1, cy = predio.y + 1;
  const vagas: [number, number][] = [];
  for (let x = Math.ceil(zona.x1 - lado + 0.01); x < zona.x2; x++)
    for (let y = Math.ceil(zona.y1 - lado + 0.01); y < zona.y2; y++) vagas.push([x, y]);
  vagas.sort(([ax, ay], [bx, by]) => Math.hypot(ax + lado / 2 - cx, ay + lado / 2 - cy) - Math.hypot(bx + lado / 2 - cx, by + lado / 2 - cy));
  let postas = 0;
  for (const [x, y] of vagas) {
    if (postas >= n) break;
    const p = { tipo, x, y };
    if (cabe(pecas, p)) { pecas.push(p); postas++; }
  }
  return postas;
}

/**
 * Monta um layout com os prédios de clima dados (tipo + modo) e as lavouras divididas entre eles.
 * `fatias[i]` é a fração de Farmland e Woodland que vai para o prédio i (o que não couber sobra).
 */
export function montaAuto(predios: { tipo: string; modo: string }[], quantos: Record<string, number>, fatias: number[]): Peca[] {
  const pecas: Peca[] = [];
  const restam = { ...quantos };
  const lugares = predios.map((b, i) => {
    const p: Peca = { tipo: b.tipo, x: ANCORAS[i][0], y: ANCORAS[i][1], modo: b.modo };
    pecas.push(p);
    return p;
  });
  lugares.forEach((p, i) => {
    const esp = ESPECIAL[p.tipo];
    if (esp && (restam[esp] ?? 0) > 0) restam[esp] -= encaixa(pecas, p, esp, restam[esp]);
    for (const tipo of ['wo', 'fa']) {
      const cota = i === lugares.length - 1 ? restam[tipo] ?? 0 : Math.round((quantos[tipo] ?? 0) * fatias[i]);
      restam[tipo] = (restam[tipo] ?? 0) - encaixa(pecas, p, tipo, Math.min(cota, restam[tipo] ?? 0));
    }
  });
  return pecas;
}
