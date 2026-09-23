import dados from '../data/aniimos.json';
import type { Aniimo, Elemento, Forma, Papel } from './types.ts';

export const aniimos = dados as Aniimo[];
export const porSlug = new Map(aniimos.map((a) => [a.slug, a]));

// União das formas: um Aniimo "é" de fogo se alguma forma for.
export const elementos = (a: Aniimo) => [...new Set(a.formas.flatMap((f) => f.elementos))] as Elemento[];
export const papeis = (a: Aniimo) => [...new Set(a.formas.flatMap((f) => f.papeis))] as Papel[];
export const estagios = (a: Aniimo) => [...new Set(a.formas.map((f) => f.estagio))];
export const base = (a: Aniimo): Forma => a.formas.find((f) => f.chave === 'basic-form') ?? a.formas[0];
