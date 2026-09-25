// Categorias e helpers do blog: cores em hex (para estilo inline dos selos) e cálculos derivados dos posts.
import type { CollectionEntry } from 'astro:content';

export type Categoria = 'aviso' | 'guia' | 'time' | 'update';
type Post = CollectionEntry<'blog'>;

export const CATEGORIA: Record<Categoria, { nome: string; bg: string; fg: string; tinta: string }> = {
  aviso: { nome: 'Aviso', bg: '#F8E4EE', fg: '#8C3563', tinta: '#FCF1F6' },
  guia: { nome: 'Guia', bg: '#E3F1F0', fg: '#1D4B4B', tinta: '#EAF5F4' },
  time: { nome: 'Times', bg: '#DCEAF8', fg: '#1F568F', tinta: '#EDF4FC' },
  update: { nome: 'Novidade', bg: '#FBF0C8', fg: '#7A5A00', tinta: '#FDF8E6' },
};

/** ~200 palavras por minuto a partir do markdown cru, arredondado, mínimo 1 min. */
export const leitura = (corpo: string) => `${Math.max(1, Math.round(corpo.trim().split(/\s+/).length / 200))} min`;

export const porData = (a: Post, b: Post) => b.data.publicadoEm.getTime() - a.data.publicadoEm.getTime();

/** Post em destaque: o marcado com `destaque`, senão o mais recente. */
export const destacado = (posts: Post[]) => posts.find((p) => p.data.destaque) ?? [...posts].sort(porData)[0];

/** Mesma categoria primeiro, depois os mais recentes, até `n`. */
export const relacionados = (posts: Post[], atual: Post, n = 3) => {
  const outros = posts.filter((p) => p.id !== atual.id).sort(porData);
  const mesma = outros.filter((p) => p.data.categoria === atual.data.categoria);
  const resto = outros.filter((p) => p.data.categoria !== atual.data.categoria);
  return [...mesma, ...resto].slice(0, n);
};

export const temPostRecente = (posts: Post[], dias = 7) => posts.some((p) => Date.now() - p.data.publicadoEm.getTime() < dias * 86400000);
