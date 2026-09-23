// Rótulos oficiais em PT, copiados do i18n da wiki (/_i18n/{hash}/pt/messages.json) em 22/09/2026.
import { Droplet, Flame, Leaf, Moon, Mountain, Snowflake, Sun, Wind, Zap } from 'lucide-static';
import type { Elemento, Papel } from './types.ts';

export const ELEMENTO: Record<Elemento, string> = {
  fire: 'Fogo', water: 'Água', grass: 'Grama', electric: 'Elétrico', ice: 'Gelo',
  rock: 'Rocha', wind: 'Vento', holy: 'Sagrado', dark: 'Trevas',
};

export const PAPEL: Record<Papel, string> = {
  dps: 'DPS', break: 'QUEBRA', sup: 'Suporte', heal: 'Cura', energy: 'REGEN.',
};

export const ESTAGIO: Record<number, string> = { 1: 'Lumin', 2: 'Gamma', 3: 'Nova', 4: 'Estágio 4' };

export const STAT = { hp: 'PV', atk: 'ATQ', brk: 'QUEBRA', pdef: 'DEF F.', mdef: 'DEF M.', regen: 'REGEN.', total: 'Total' } as const;

// Cor por elemento, só para os chips da interface.
export const COR: Record<Elemento, string> = {
  fire: 'bg-orange-600 text-white', water: 'bg-sky-600 text-white', grass: 'bg-green-600 text-white', electric: 'bg-yellow-500 text-ink',
  ice: 'bg-cyan-400 text-ink', rock: 'bg-amber-800 text-white', wind: 'bg-teal-500 text-ink',
  holy: 'bg-amber-200 text-ink', dark: 'bg-violet-800 text-white',
};

// As mesmas cores em hex [fundo, texto], para SVG e imagens OG.
export const COR_HEX: Record<Elemento, [string, string]> = {
  fire: ['#EA580C', '#fff'], water: ['#0284C7', '#fff'], grass: ['#16A34A', '#fff'], electric: ['#EAB308', '#15393A'],
  ice: ['#22D3EE', '#15393A'], rock: ['#92400E', '#fff'], wind: ['#14B8A6', '#15393A'], holy: ['#FDE68A', '#15393A'], dark: ['#5B21B6', '#fff'],
};

// Ícone genérico (Lucide) de cada elemento: o site não hospeda os ícones do jogo.
export const ICONE: Record<Elemento, string> = { holy: Sun, dark: Moon, wind: Wind, grass: Leaf, fire: Flame, ice: Snowflake, electric: Zap, water: Droplet, rock: Mountain };
/** Só os <path> do ícone, para montar o <svg> em volta do jeito que cada lugar precisa. */
export const mioloIcone = (e: Elemento) => ICONE[e].slice(ICONE[e].indexOf('>') + 1, ICONE[e].lastIndexOf('</svg>'));
