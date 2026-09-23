// Lista de ferramentas usada pelo menu (Base.astro) e pela home: um lugar só para nome, descrição curta e ícone (Lucide, ISC).
import { ArrowLeftRight, BookOpen, Bookmark, CircleCheck, Gift, House, LayoutGrid, Library, ListOrdered, Sparkles, Users } from 'lucide-static';

export type Link = [href: string, nome: string, desc: string, icone: string];

export const principais: Link[] = [
  ['/aniilog/', 'Aniilog', 'Todos os Aniimo, stats e formas', Library],
  ['/tipos/', 'Tipos', 'Quem bate forte em quem', LayoutGrid],
  ['/time/', 'Time', 'Cobertura, fraquezas e sugestão', Users],
];
export const codigos: Link = ['/codigos/', 'Códigos', 'Códigos de resgate ativos', Gift];

export const grupos: [string, Link[]][] = [
  ['Batalha', [['/time/', 'Montar time', 'Cobertura e sugestão', Users], ['/times/', 'Times prontos', 'Da comunidade, prontos', Bookmark], ['/comparar/', 'Comparar', 'Stats lado a lado', ArrowLeftRight]]],
  ['Coleção', [['/colecao/', 'Minha coleção', 'Marque o que você já tem', CircleCheck], ['/tier/', 'Tier list', 'Monte do SSS ao D', ListOrdered]]],
  ['Guias e progresso', [['/guias/', 'Guias rápidos', 'Formas, caça e elementos', BookOpen], ['/homeland/', 'Homeland', 'Produção, equipe e layout', House], ['/evolucao/', 'Resonance', 'Custo até cada estágio', Sparkles]]],
];

/** Só os <path> de um ícone do lucide-static, para montar o <svg> em volta. */
export const miolo = (svg: string) => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
