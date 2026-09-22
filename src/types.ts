// Esquema de data/aniimos.json. Chaves de elemento e papel são as da wiki oficial, sem o prefixo.
export type Elemento = 'fire' | 'water' | 'grass' | 'electric' | 'ice' | 'rock' | 'wind' | 'holy' | 'dark';
export type Papel = 'dps' | 'break' | 'sup' | 'heal' | 'energy';
export type Texto = { pt: string; en: string };

export type Habilidade = {
  id: string;     // extraído do nome do ícone: {prefixo}_Skill_{id}_Icon.png / {prefixo}_Feature_{id}_Icon.png
  nome: Texto;
  desc: Texto;
  icone: string;  // URL do CDN oficial (hotlink, D5)
  grupo: string;  // aba/seção da wiki em EN, minúsculo: "combat", "innate", "mobility", "trait"
  poder?: number;
  custo?: number;
};

export type Forma = {
  chave: string;  // segmento da rota na wiki: "basic-form", "highland-form"
  nome: Texto;
  estagio: number; // 1–4 como na wiki; varia entre formas do mesmo id
  elementos: Elemento[];
  papeis: Papel[];
  stats: { hp: number; patk: number; matk: number; pdef: number; mdef: number; haste: number; total: number };
  skills: Habilidade[];
  traits: Habilidade[];
  imagem: string;
};

export type Aniimo = {
  id: string;      // "001"
  slug: string;    // do nome PT, congelado na primeira atribuição
  nome: Texto;
  desc: Texto;     // da forma básica (ou da primeira forma)
  evoluiPara: string[]; // slugs
  formas: Forma[];
  coletadoEm: string;   // ISO 8601; só muda quando o registro muda
};
