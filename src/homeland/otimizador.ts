// Otimizador de Homeland: escolhe o que cada instalação produz para maximizar o ganho por hora.
// Programação linear inteira (YALPS): cada lote/máquina fica numa receita só, e o que um processador
// consome precisa ser produzido pelas outras instalações do plano.
// Regras de eficiência e dados: aniimax (MIT, https://github.com/ae-bii/aniimax), conferidos no jogo por eles.
import { solve, type Coefficients } from 'yalps';

export type Receita = {
  id: string; nome: string; instalacao: string; tipo: 'lavoura' | 'coleta' | 'processador';
  nivel: number; modulo?: string; nivelModulo?: number; clima?: string;
  moeda: string; preco: number; custo: number; tempo?: number; workload?: number; rendimento: number;
  subproduto?: [string, number]; insumos: [string, number][];
  /** Item que a receita põe no estoque, quando é outro (variante quick_ produz o item normal). */
  produz?: string;
  requisito?: { habilidade: string; nivel: number };
  passos?: { passo: string; habilidade: string; nivel: number; workload: number }[];
  especial?: boolean; naoVerificada?: boolean;
};
export type Instalacao = {
  nome: string; slug: string; categoria: string; tipo: 'lavoura' | 'coleta' | 'processador' | 'clima';
  habilidade?: string; personalidade?: string; niveis: Record<string, number>; quantidade: number[]; tamanho?: number;
};
export type Dados = {
  instalacoes: Instalacao[]; receitas: Receita[]; custosRV: Record<string, { coins: number; items: [string, number][] }>;
  modulos: Record<string, number[]>; aniimoMax: (number | null)[]; semPersonalidade: string[];
};

export type Objetivo = 'coins' | 'aniipods' | 'aniimo_exp';
export type Config = {
  rv: number;
  /** Por instalação: quantas você tem e o nível delas. */
  instalacoes: Record<string, { qtd: number; nivel: number }>;
  modulos: Record<string, number>;
  /** Nível de habilidade dos Aniimo que trabalham (1–4), ou 0 = exatamente o mínimo de cada receita. */
  nivelAniimo: number;
  personalidade: boolean;
  especiais: boolean;
  naoVerificadas: boolean;
  /** Unidades cobertas por clima: "Farmland|Warm" → quantos lotes de Farmland ficam nesse clima. */
  cobertos: Record<string, number>;
  objetivo: Objetivo;
};

const noRV = <T,>(lista: T[], rv: number) => lista[Math.min(rv, lista.length) - 1];

/** Tudo o que um RV permite: cada instalação no nível máximo liberado e na quantidade máxima, módulos no teto. */
export function padrao(d: Dados, rv: number): Config {
  const instalacoes: Config['instalacoes'] = {};
  for (const f of d.instalacoes) {
    const niveis = Object.entries(f.niveis).filter(([, precisa]) => precisa <= rv).map(([n]) => Number(n));
    instalacoes[f.nome] = niveis.length ? { qtd: noRV(f.quantidade, rv) ?? 0, nivel: Math.max(...niveis) } : { qtd: 0, nivel: 1 };
  }
  const modulos = Object.fromEntries(Object.entries(d.modulos).map(([m, tetos]) => [m, noRV(tetos, rv)]));
  return { rv, instalacoes, modulos, nivelAniimo: 3, personalidade: true, especiais: false, naoVerificadas: false, cobertos: {}, objetivo: 'coins' };
}

/** Eficiência (1 = 100%) de um Aniimo de nível `nivel` numa receita que pede `req`. */
export function eficiencia(r: Receita, nivel: number, personalidade: boolean, semPersonalidade: string[]) {
  const req = Math.max(1, r.requisito?.nivel ?? 1);
  const acima = Math.max(nivel, req) - req;
  if (semPersonalidade.includes(r.instalacao)) return 1 + 0.4 * acima;
  const base = r.tipo === 'coleta' ? 1 + (req === 1 ? 0.5 : 0.4) * acima : acima === 0 ? 1 : 2 + acima;
  return base * (personalidade ? 1.2 : 1);
}

/** Segundos por ciclo de uma unidade (lote ou máquina) na receita, e a eficiência usada. */
export function ciclo(d: Dados, r: Receita, cfg: Config) {
  if (r.tipo === 'lavoura') return { segundos: r.tempo!, eficiencia: 1, nivel: 0 };
  const req = Math.max(1, r.requisito?.nivel ?? 1);
  const nivel = cfg.nivelAniimo === 0 ? req : cfg.nivelAniimo;
  const semPers = d.semPersonalidade.includes(r.instalacao);
  const ef = eficiencia(r, nivel, cfg.personalidade && !semPers, d.semPersonalidade);
  // Coleta e instalações sem personalidade rendem 1 + 0,25 de workload/s por nível exigido (medido no jogo).
  const base = r.tipo === 'coleta' || semPers ? 1 + 0.25 * (req - 1) : 1;
  return { segundos: r.workload! / (ef * base), eficiencia: ef, nivel };
}

/** Por que uma receita não entra no plano (ou null se entra). */
export function bloqueio(d: Dados, r: Receita, cfg: Config): string | null {
  const f = cfg.instalacoes[r.instalacao];
  if (!f || f.qtd <= 0) return 'sem a instalação';
  if (r.nivel > f.nivel) return `instalação Nv. ${r.nivel}`;
  if (r.modulo && (cfg.modulos[r.modulo] ?? 0) < r.nivelModulo!) return `${r.modulo.replace(/_/g, ' ')} Nv. ${r.nivelModulo}`;
  if (r.especial && !cfg.especiais) return 'receita especial';
  if (r.naoVerificada && !cfg.naoVerificadas) return 'dado não verificado';
  if (cfg.nivelAniimo && r.requisito && r.requisito.nivel > cfg.nivelAniimo) return `Aniimo ${r.requisito.habilidade} Nv. ${r.requisito.nivel}`;
  if (r.clima && !Object.entries(cfg.cobertos).some(([k, n]) => k === `${r.instalacao}|${r.clima}` && n > 0)) return `clima ${r.clima}`;
  return null;
}

/** `uso`: fração do tempo que as máquinas trabalham (o resto é espera por insumo). */
export type Linha = { r: Receita; unidades: number; porHora: number; uso: number; segundos: number; eficiencia: number; nivel: number };
export type Plano = {
  ok: boolean;
  ganhoHora: number;
  custoSementesHora: number;
  linhas: Linha[];
  vendas: { item: string; qtdHora: number; valorHora: number }[];
  subprodutos: Record<string, number>;
  equipe: { habilidade: string; nivel: number; personalidade?: string; instalacao: string; quantos: number }[];
  aniimoTotal: number;
};

const itemMoeda = (r: Receita) => r.moeda;

export function otimiza(d: Dados, cfg: Config): Plano {
  const variaveis = new Map<string, Coefficients>();
  const usaveis = d.receitas.filter((r) => !bloqueio(d, r, cfg));
  const porId = new Map(d.receitas.map((r) => [r.id, r]));

  // Duas variáveis por receita: x = máquinas/lotes dedicados (inteiro) e y = ciclos por hora (contínuo, até x × velocidade).
  // A máquina pode ficar ociosa esperando insumo, como no jogo; o que ela não pode é passar da própria velocidade.
  for (const r of usaveis) {
    const { segundos } = ciclo(d, r, cfg);
    const cx: Record<string, number> = { [`fac:${r.instalacao}`]: 1, [`cap:${r.instalacao}/${r.id}`]: -3600 / segundos };
    if (r.clima) cx[`clima:${r.instalacao}|${r.clima}`] = 1;
    variaveis.set(`x:${r.instalacao}/${r.id}`, cx);
    const cy: Record<string, number> = { [`cap:${r.instalacao}/${r.id}`]: 1, [`item:${r.produz ?? r.id}`]: r.rendimento };
    for (const [ins, qtd] of r.insumos) cy[`item:${ins}`] = (cy[`item:${ins}`] ?? 0) - qtd;
    if (r.subproduto) cy[`item:${r.subproduto[0]}`] = (cy[`item:${r.subproduto[0]}`] ?? 0) + r.subproduto[1];
    // Semente só pesa quando o objetivo é moeda; nos outros objetivos o custo não entra na conta.
    if (r.custo && cfg.objetivo === 'coins') cy.ganho = -r.custo;
    variaveis.set(`y:${r.instalacao}/${r.id}`, cy);
  }
  // Vender: tira do estoque do item e soma no objetivo (na moeda escolhida).
  for (const r of usaveis) {
    const item = r.produz ?? r.id;
    if (itemMoeda(r) !== cfg.objetivo || r.preco <= 0 || variaveis.has(`v:${item}`)) continue;
    variaveis.set(`v:${item}`, { [`item:${item}`]: -1, ganho: r.preco });
  }

  const restricoes: Record<string, { min?: number; max?: number }> = {};
  for (const [nome, { qtd }] of Object.entries(cfg.instalacoes)) restricoes[`fac:${nome}`] = { max: qtd };
  for (const [k, n] of Object.entries(cfg.cobertos)) restricoes[`clima:${k}`] = { max: n };
  for (const c of variaveis.values()) for (const k of Object.keys(c)) {
    if (k.startsWith('item:')) restricoes[k] = { min: 0 };
    if (k.startsWith('cap:')) restricoes[k] = { max: 0 };
  }

  const sol = solve(
    { direction: 'maximize', objective: 'ganho', constraints: restricoes, variables: variaveis, integers: [...variaveis.keys()].filter((k) => k.startsWith('x:')) },
    { timeout: 4000 },
  );
  const valores = new Map(sol.variables);
  const linhas: Linha[] = [];
  const subprodutos: Record<string, number> = {};
  let custoSementesHora = 0;
  for (const r of usaveis) {
    const u = Math.round(valores.get(`x:${r.instalacao}/${r.id}`) ?? 0);
    const ciclosHora = valores.get(`y:${r.instalacao}/${r.id}`) ?? 0;
    if (!u || ciclosHora < 1e-6) continue;
    const cl = ciclo(d, r, cfg);
    linhas.push({ r, unidades: u, porHora: ciclosHora * r.rendimento, uso: Math.min(1, (ciclosHora * cl.segundos) / (3600 * u)), ...cl });
    if (r.subproduto) subprodutos[r.subproduto[0]] = (subprodutos[r.subproduto[0]] ?? 0) + ciclosHora * r.subproduto[1];
    custoSementesHora += r.custo * ciclosHora;
  }
  const vendas = [...valores].filter(([k, v]) => k.startsWith('v:') && v > 1e-6).map(([k, v]) => {
    const r = porId.get(k.slice(2))!;
    return { item: r.id, qtdHora: v, valorHora: v * r.preco };
  }).sort((a, b) => b.valorHora - a.valorHora);

  // Equipe: um Aniimo por máquina/lote de coleta ocupado; lavouras precisam de quem semeia e colhe.
  const equipe = new Map<string, { habilidade: string; nivel: number; personalidade?: string; instalacao: string; quantos: number }>();
  const fac = new Map(d.instalacoes.map((f) => [f.nome, f]));
  for (const l of linhas) {
    if (l.r.tipo === 'lavoura') {
      for (const p of l.r.passos ?? []) {
        const chave = `${l.r.instalacao}|${p.habilidade}|${p.passo}`;
        const carga = ((l.porHora / l.r.rendimento) * p.workload) / 3600; // Aniimo ocupados em média
        const e = equipe.get(chave) ?? { habilidade: p.habilidade, nivel: p.nivel, instalacao: `${l.r.instalacao} (${p.passo === 'Sowing' ? 'semear' : 'colher'})`, quantos: 0 };
        e.nivel = Math.max(e.nivel, p.nivel);
        e.quantos += carga;
        equipe.set(chave, e);
      }
    } else {
      const f = fac.get(l.r.instalacao)!;
      const chave = `${l.r.instalacao}|${l.r.requisito!.habilidade}`;
      const e = equipe.get(chave) ?? { habilidade: l.r.requisito!.habilidade, nivel: 0, personalidade: d.semPersonalidade.includes(f.nome) ? undefined : f.personalidade, instalacao: l.r.instalacao, quantos: 0 };
      e.nivel = Math.max(e.nivel, l.nivel);
      e.quantos += l.unidades;
      equipe.set(chave, e);
    }
  }
  const lista = [...equipe.values()].map((e) => ({ ...e, quantos: Math.max(1, Math.ceil(e.quantos - 1e-9)) }));
  return {
    ok: sol.status === 'optimal' || sol.status === 'timedout',
    ganhoHora: sol.result ?? 0,
    custoSementesHora,
    linhas: linhas.sort((a, b) => a.r.instalacao.localeCompare(b.r.instalacao)),
    vendas,
    subprodutos,
    equipe: lista.sort((a, b) => a.habilidade.localeCompare(b.habilidade)),
    aniimoTotal: lista.reduce((s, e) => s + e.quantos, 0),
  };
}

/** Próximos passos: o quanto o ganho/h sobe com cada coisa que o seu RV ainda permite (+1 unidade ou +1 nível) e subindo de RV. */
export function melhorias(d: Dados, cfg: Config, base: number) {
  const teto = padrao(d, cfg.rv);
  const saida: { oque: string; tipo: 'qtd' | 'nivel' | 'rv'; instalacao?: string; ganho: number }[] = [];
  for (const f of d.instalacoes) {
    const atual = cfg.instalacoes[f.nome], max = teto.instalacoes[f.nome];
    if (!atual || !max) continue;
    if (atual.qtd < max.qtd) {
      const g = otimiza(d, { ...cfg, instalacoes: { ...cfg.instalacoes, [f.nome]: { qtd: atual.qtd + 1, nivel: Math.max(1, atual.nivel) } } }).ganhoHora - base;
      saida.push({ oque: atual.qtd === 0 ? `Construir ${f.nome}` : `Mais uma ${f.nome} (${atual.qtd + 1}/${max.qtd})`, tipo: 'qtd', instalacao: f.nome, ganho: g });
    }
    if (atual.qtd > 0 && atual.nivel < max.nivel) {
      const g = otimiza(d, { ...cfg, instalacoes: { ...cfg.instalacoes, [f.nome]: { ...atual, nivel: atual.nivel + 1 } } }).ganhoHora - base;
      saida.push({ oque: `${f.nome} para o Nv. ${atual.nivel + 1}`, tipo: 'nivel', instalacao: f.nome, ganho: g });
    }
  }
  if (cfg.rv < 20) {
    const prox = padrao(d, cfg.rv + 1);
    const g = otimiza(d, { ...prox, nivelAniimo: cfg.nivelAniimo, personalidade: cfg.personalidade, especiais: cfg.especiais, naoVerificadas: cfg.naoVerificadas, cobertos: cfg.cobertos, objetivo: cfg.objetivo }).ganhoHora - base;
    saida.push({ oque: `Subir para o RV ${cfg.rv + 1} (com tudo que ele libera)`, tipo: 'rv', ganho: g });
  }
  return saida.filter((m) => m.ganho > 0.5).sort((a, b) => b.ganho - a.ganho);
}
