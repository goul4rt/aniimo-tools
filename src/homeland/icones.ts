// Ícones próprios do Homeland (Lucide, ISC). Não há ícones oficiais de Homeland no CDN da Pawprint, e o ADR (D5)
// não permite usar assets extraídos do jogo; então cada instalação ganha um ícone genérico que diz o que ela faz.
import {
  Apple, Axe, Castle, CircleDot, Cloud, Cog, Container, Cookie, CookingPot, CupSoda, Droplets, Factory, Flame, FlaskConical,
  Flower2, Gem, Hammer, Music, Pickaxe, Scissors, Snowflake, Sparkles, Sprout, Star, Sun, Trees, Utensils,
} from 'lucide-static';

const POR_INSTALACAO: Record<string, string> = {
  Farmland: Sprout, Woodland: Trees, Mine: Pickaxe, Well: Droplets, 'Tidewhisper Sandcastle': Castle, 'Dewy House': Gem,
  'Nimbus Bed': Cloud, 'Starfall Hammock': Star, 'Floral Windmill': Flower2, 'Heat Furnace': Flame, 'Cooling Unit': Snowflake,
  Sunlamp: Sun, 'Carousel Mill': Cog, 'Crafting Table': Hammer, 'Claw Game Cooker': Cookie, 'Jukebox Dryer': Music,
  'Simmering Pot': CookingPot, 'Phonolfactory Table': FlaskConical, 'Bouncy Brew Keg': CupSoda, 'Blazing Stove': Utensils,
  'Pickling Jar': Container, 'Joy Wheel Loom': Scissors, 'Dance Pad Polisher': Sparkles, 'Aniipod Maker': CircleDot,
  'Woodworking Bench': Axe, 'Chimney Kiln': Factory,
};

// Só o miolo do SVG (os <path>): o <svg> em volta é montado aqui, do jeito que cada lugar precisa.
const miolo = (nome: string) => { const svg = POR_INSTALACAO[nome] ?? Apple; return svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')); };
const TRACO = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** Ícone da instalação como HTML (herda a cor do texto). */
export const iconeInst = (nome: string, cls = 'h-4 w-4') =>
  `<svg class="${cls} shrink-0" viewBox="0 0 24 24" ${TRACO} aria-hidden="true">${miolo(nome)}</svg>`;

/** O mesmo ícone dentro do SVG do mapa, posicionado e medido em tiles. */
export const iconeNoMapa = (nome: string, x: number, y: number, lado: number, cor: string) =>
  `<svg x="${x}" y="${y}" width="${lado}" height="${lado}" viewBox="0 0 24 24" ${TRACO} color="${cor}" pointer-events="none">${miolo(nome)}</svg>`;
