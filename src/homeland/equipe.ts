// Quais Aniimo servem para cada trabalho do Homeland: habilidade + nível mínimo.
// Habilidades de trabalho por Aniimo: Hideout Guides (com permissão; ver data/homeland-hideout.json).
import hideout from '../../data/homeland-hideout.json' with { type: 'json' };

export type Candidato = { nome: string; nivel: number; variante: boolean; chance?: number };

type Linha = { nome: string; habilidades: Record<string, number>; variantes?: { habilidades: Record<string, number>; chance: number }[] };
const LISTA = hideout.habilidades as Linha[];

/**
 * Aniimo com `habilidade` no nível `nivel` ou mais. Formas normais antes das variantes raras; entre iguais,
 * o nível mais próximo do pedido primeiro (não gasta um Nv. 4 onde um Nv. 3 resolve).
 */
export function candidatos(habilidade: string, nivel: number): Candidato[] {
  const saida: Candidato[] = [];
  for (const a of LISTA) {
    const base = a.habilidades[habilidade] ?? 0;
    if (base >= nivel) { saida.push({ nome: a.nome, nivel: base, variante: false }); continue; }
    // Só a melhor variante que resolve (e só se a forma normal não resolve).
    const v = (a.variantes ?? []).filter((x) => (x.habilidades[habilidade] ?? 0) >= nivel).sort((x, y) => y.chance - x.chance)[0];
    if (v) saida.push({ nome: a.nome, nivel: v.habilidades[habilidade], variante: true, chance: v.chance });
  }
  return saida.sort((a, b) => Number(a.variante) - Number(b.variante) || a.nivel - b.nivel || a.nome.localeCompare(b.nome));
}

/** Trabalhador que cada prédio de clima exige, conforme o modo (ex.: Cooling Unit em Congelante pede Gelo Nv. 2). */
export const equipeClima = hideout.clima.equipe as Record<string, Record<string, { ability: string; level: number }>>;
