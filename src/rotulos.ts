// Rótulos oficiais em PT, copiados do i18n da wiki (/_i18n/{hash}/pt/messages.json) em 22/09/2026.
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
