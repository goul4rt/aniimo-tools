// Ícones PNG (iOS e manifest) gerados do favicon.svg na build.
// Fundo cheio, sem cantos arredondados: iOS e Android aplicam a própria máscara, e canto transparente vira preto no iOS.
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const TAMANHOS = { 'apple-touch-icon': 180, 'icone-192': 192, 'icone-512': 512 };

export const getStaticPaths = (() =>
  Object.entries(TAMANHOS).map(([icone, px]) => ({ params: { icone }, props: { px } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const svg = readFileSync('public/favicon.svg', 'utf8').replace('rx="18"', 'rx="0"');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: props.px as number } }).render().asPng();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
