// Registro das páginas: fonte única para imagem OG, sitemap e breadcrumbs.
// Base.astro quebra a build se uma página não estiver aqui, então página nova sem OG não passa.
import { aniimos } from './data.ts';

export type Pagina = { nome: string; titulo: string; sub: string };

export const PAGINAS: Record<string, Pagina> = {
  '/': { nome: 'Início', titulo: 'Tudo de Aniimo, em português', sub: 'Aniilog, tipos, times, tier list e códigos, com dados da wiki oficial todo dia.' },
  '/aniilog/': { nome: 'Aniilog', titulo: 'Aniilog', sub: `Os ${aniimos.length} Aniimo com stats, skills, formas e onde encontrar.` },
  '/tipos/': { nome: 'Tipos', titulo: 'Tabela de tipos', sub: 'Quem ataca bem, quem resiste e os 81 confrontos entre os 9 elementos.' },
  '/guias/': { nome: 'Guias', titulo: 'Guias rápidos', sub: 'Onde achar cada Aniimo, formas e variantes, caça, o que conferir depois e o diagrama de elementos.' },
  '/codigos/': { nome: 'Códigos', titulo: 'Códigos de resgate', sub: 'Códigos ativos conferidos, com botão de copiar.' },
  '/colecao/': { nome: 'Coleção', titulo: 'Minha coleção', sub: 'Marque os Aniimo e formas que você já tem, incluindo Prismana.' },
  '/time/': { nome: 'Time', titulo: 'Montador de time', sub: 'Cobertura de elementos, fraquezas em comum, times prontos e sugestão automática.' },
  '/times/': { nome: 'Times prontos', titulo: 'Times prontos', sub: 'Composições da comunidade do iniciante ao endgame, prontas para abrir no montador.' },
  '/comparar/': { nome: 'Comparar', titulo: 'Comparar stats', sub: 'Até 3 Aniimo ou formas lado a lado.' },
  '/tier/': { nome: 'Tier list', titulo: 'Tier list', sub: 'Monte sua tier list de SSS a D, com filtro de Prismana.' },
  '/homeland/': { nome: 'Homeland', titulo: 'Otimizador de Homeland', sub: 'O que cada instalação deve produzir, a equipe certa e o layout de clima, com link para compartilhar.' },
  '/blog/': { nome: 'Blog', titulo: 'Blog', sub: 'Guias e novidades de Aniimo escritos pela comunidade.' },
  '/evolucao/': { nome: 'Resonance', titulo: 'Planejador de Resonance', sub: 'Quanto Dewdrop, pedras e Cristal de Onifonte até o estágio que você quer.' },
  '/api/': { nome: 'API', titulo: 'API pública', sub: 'Todos os dados de Aniimo em JSON aberto, para bots e sites.' },
  '/creditos/': { nome: 'Créditos', titulo: 'Créditos e dados', sub: 'De onde vêm os dados do Aniimo Tools e como falar com a gente.' },
};

export const rotas = [...Object.keys(PAGINAS), ...aniimos.map((a) => `/aniilog/${a.slug}/`)];

/** "/aniilog/brasim/" → "/og/aniilog/brasim.png"; "/" → "/og/inicio.png". */
export const ogDe = (rota: string) => `/og/${rota.replace(/^\/|\/$/g, '') || 'inicio'}.png`;
