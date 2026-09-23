// Imagem OG (1200×630) de cada página, gerada na build: satori desenha o layout em SVG, resvg converte para PNG.
// Sem arte do jogo de propósito: o site não hospeda assets da Pawprint (ver /creditos).
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { aniimos } from '../../data.ts';
import { PAGINAS, ogDe, type Pagina } from '../../paginas.ts';
import { ELEMENTO, ESTAGIO, PAPEL, STAT } from '../../rotulos.ts';
import type { Aniimo, Elemento } from '../../types.ts';

// Caminhos a partir da raiz do projeto: na build este arquivo roda empacotado, longe de src/.
const fonte = (f: string) => readFileSync(`src/og/fontes/${f}.woff`);
const FONTES = [
  { name: 'Fredoka', data: fonte('fredoka-latin-600-normal'), weight: 600 as const },
  { name: 'Jakarta', data: fonte('plus-jakarta-sans-latin-500-normal'), weight: 500 as const },
  { name: 'Jakarta', data: fonte('plus-jakarta-sans-latin-700-normal'), weight: 700 as const },
];
const LOGO = `data:image/svg+xml;base64,${readFileSync('public/favicon.svg').toString('base64')}`;
// Mascote: fan-art em pixel art (não é asset oficial), fundo removido.
const MASCOTE = `data:image/png;base64,${readFileSync('src/og/mascote.png').toString('base64')}`;
const TWINING = 'linear-gradient(135deg, #7FD6F5, #A7B8F7 45%, #F48DB8 80%, #FFB37A)';
// Mesmas cores dos chips de elemento do site (rotulos.ts), em hex.
const COR: Record<Elemento, [string, string]> = {
  fire: ['#EA580C', '#fff'], water: ['#0284C7', '#fff'], grass: ['#16A34A', '#fff'], electric: ['#EAB308', '#15393A'],
  ice: ['#22D3EE', '#15393A'], rock: ['#92400E', '#fff'], wind: ['#14B8A6', '#15393A'], holy: ['#FDE68A', '#15393A'], dark: ['#5B21B6', '#fff'],
};

// Mini-hyperscript para os nós do satori (sem JSX num endpoint .ts).
type No = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (No | string | false)[]): No =>
  ({ type, props: { style: { display: 'flex', ...style }, children: children.filter((c) => c !== false) } });

// Brilho rosa/azul desfocado no canto superior direito (acento Twining).
const brilho = h('div', {
  position: 'absolute', right: -220, top: -260, width: 800, height: 800, borderRadius: 9999,
  backgroundImage: 'radial-gradient(circle, rgba(244,141,184,.5) 0%, rgba(167,184,247,.3) 40%, rgba(40,100,100,0) 70%)',
});
const mascote = h('div', { position: 'absolute', right: 56, bottom: 40 },
  { type: 'img', props: { src: MASCOTE, width: 437, height: 480 } });

const cabecalho = h('div', { alignItems: 'center', gap: 16 },
  { type: 'img', props: { src: LOGO, width: 56, height: 56 } },
  h('div', { fontFamily: 'Fredoka', fontSize: 34, color: '#fff' }, 'Aniimo Tools'));

const rodape = h('div', { fontFamily: 'Jakarta', fontWeight: 700, fontSize: 24, color: '#A9CAE6' }, 'aniimo.ogoulart.dev');
const moldura = (...filhos: No[]) =>
  h('div', { width: 1200, height: 630, position: 'relative', backgroundColor: '#286464', fontFamily: 'Jakarta', overflow: 'hidden' },
    ...filhos,
    h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, backgroundImage: TWINING }));

function paginaOg(p: Pagina, rota: string) {
  return moldura(
    brilho,
    mascote,
    h('div', { position: 'absolute', top: 0, left: 0, width: 720, height: 630, padding: '64px 72px 72px', flexDirection: 'column', justifyContent: 'space-between' },
      cabecalho,
      h('div', { flexDirection: 'column', gap: 20 },
        h('div', { fontWeight: 700, fontSize: 22, letterSpacing: 3, color: '#A9CAE6' }, rota === '/' ? 'PARA A COMUNIDADE BR' : 'FERRAMENTA'),
        h('div', { fontFamily: 'Fredoka', fontSize: p.titulo.length > 12 ? 72 : 92, lineHeight: 1.02, color: '#fff' }, p.titulo),
        h('div', { fontSize: 30, lineHeight: 1.35, color: '#EDF7FF' }, p.sub)),
      rodape));
}

function aniimoOg(a: Aniimo) {
  const f = a.formas[0];
  const els = [...new Set(a.formas.flatMap((x) => x.elementos))];
  const chip = (txt: string, [bg, fg]: [string, string]) =>
    h('div', { padding: '8px 20px', borderRadius: 9999, backgroundColor: bg, color: fg, fontWeight: 700, fontSize: 24 }, txt);
  const barra = (k: keyof typeof STAT) =>
    h('div', { alignItems: 'center', gap: 16 },
      h('div', { width: 110, fontWeight: 700, fontSize: 20, letterSpacing: 1, color: '#286464' }, STAT[k]),
      h('div', { width: 56, fontWeight: 700, fontSize: 24, color: '#15393A', justifyContent: 'flex-end' }, String(f.stats[k])),
      h('div', { flex: 1, height: 14, borderRadius: 9999, backgroundColor: '#E3EEF7' },
        h('div', { width: `${Math.min(100, (f.stats[k] / 160) * 100)}%`, height: 14, borderRadius: 9999, backgroundColor: '#6195C3' })));
  return moldura(
    brilho,
    h('div', { position: 'absolute', top: 0, left: 0, width: 1200, height: 630, padding: '64px 72px 72px', gap: 48 },
      h('div', { width: 564, flexDirection: 'column', justifyContent: 'space-between' },
        cabecalho,
        h('div', { flexDirection: 'column', gap: 18 },
          h('div', { fontWeight: 700, fontSize: 22, letterSpacing: 3, color: '#A9CAE6' },
            `ANIILOG · #${a.id} · ${(ESTAGIO[f.estagio] ?? `Estágio ${f.estagio}`).toUpperCase()}`),
          h('div', { fontFamily: 'Fredoka', fontSize: a.nome.pt.length > 16 ? 64 : a.nome.pt.length > 11 ? 80 : 96, lineHeight: 1, color: '#fff' }, a.nome.pt),
          h('div', { fontSize: 30, color: '#EDF7FF' }, `${a.nome.en}${a.formas.length > 1 ? ` · ${a.formas.length} formas` : ''}`),
          h('div', { gap: 10, flexWrap: 'wrap', marginTop: 6 },
            ...els.map((e) => chip(ELEMENTO[e], COR[e])),
            ...f.papeis.map((p) => chip(PAPEL[p], ['#E3F1F0', '#286464'])))),
        rodape),
      h('div', { width: 440, alignSelf: 'center', flexDirection: 'column', gap: 18, padding: 36, borderRadius: 32, backgroundColor: '#fff' },
        h('div', { fontFamily: 'Fredoka', fontSize: 30, color: '#15393A' }, 'Stats base'),
        ...(['hp', 'atk', 'brk', 'pdef', 'mdef', 'regen'] as const).map(barra),
        h('div', { justifyContent: 'space-between', borderTop: '2px solid #E3EEF7', paddingTop: 16, fontWeight: 700, fontSize: 24, color: '#15393A' },
          h('div', {}, 'Total'), h('div', {}, String(f.stats.total))))));
}

export const getStaticPaths = (() => [
  ...Object.entries(PAGINAS).map(([rota, p]) => ({ params: { rota: ogDe(rota).slice(4, -4) }, props: { no: paginaOg(p, rota) } })),
  ...aniimos.map((a) => ({ params: { rota: ogDe(`/aniilog/${a.slug}/`).slice(4, -4) }, props: { no: aniimoOg(a) } })),
]) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(props.no as never, { width: 1200, height: 630, fonts: FONTES });
  return new Response(new Resvg(svg).render().asPng(), { headers: { 'Content-Type': 'image/png' } });
};
