// Ícones PNG (iOS e manifest) gerados na build a partir do mascote (fan-art em pixel art, src/og/mascote.png).
// Fundo cheio no verde do site, sem cantos arredondados: iOS e Android aplicam a própria máscara, e canto transparente vira preto no iOS.
// Margem de 14%: fica dentro da zona segura dos ícones "maskable" do Android.
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const TAMANHOS = { 'apple-touch-icon': 180, 'icone-192': 192, 'icone-512': 512 };
const MASCOTE = `data:image/png;base64,${readFileSync('src/og/mascote.png').toString('base64')}`;
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#286464"/><image href="${MASCOTE}" x="14" y="14" width="72" height="72" preserveAspectRatio="xMidYMid meet"/></svg>`;

export const getStaticPaths = (() =>
  Object.entries(TAMANHOS).map(([icone, px]) => ({ params: { icone }, props: { px } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const png = new Resvg(SVG, { fitTo: { mode: 'width', value: props.px as number } }).render().asPng();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
