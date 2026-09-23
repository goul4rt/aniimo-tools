// Converte os dados de Homeland do aniimax (MIT, https://github.com/ae-bii/aniimax) em data/homeland.json.
// Uso: git clone https://github.com/ae-bii/aniimax /tmp/aniimax && node scripts/homeland.ts /tmp/aniimax
// Os dados vêm do jogo, conferidos pela comunidade do aniimax; aqui só mudamos o formato.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = process.argv[2];
if (!raiz) throw new Error('uso: node scripts/homeland.ts <clone do aniimax>');
const cfg = await import(pathToFileURL(join(raiz, 'web/facility-config.js')).href);
const commit = execSync('git rev-parse HEAD', { cwd: raiz }).toString().trim();

type Linha = Record<string, string>;
const csv = (arq: string): Linha[] => {
  const [cab, ...linhas] = readFileSync(join(raiz, 'data', arq), 'utf8').trim().split('\n');
  const cols = cab.split(',').map((c) => c.trim());
  return linhas.filter((l) => l.trim()).map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.trim()])));
};
const num = (v?: string) => (v === undefined || v === '' ? undefined : Number(v));
const nome = (id: string) => id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// Arquivo → instalação e tipo. Lavoura cresce sozinha (tempo fixo); coleta e processador são workload de um Aniimo.
const COLETA = new Set(['Mine', 'Well', 'Tidewhisper Sandcastle', 'Dewy House', 'Nimbus Bed', 'Starfall Hammock', 'Floral Windmill']);
const SUBPRODUTO: Record<string, string> = { Woodland: 'wood_block', Mine: 'mineral_sand' };
const porSlug = new Map(cfg.FACILITIES.map((f: { slug: string; name: string }) => [f.slug.replace(/-/g, '_'), f.name]));
// Tamanho (lado, em tiles) das instalações que dependem de clima; os prédios de clima são 2×2 e cobrem 9×9.
const TAMANHO: Record<string, number> = {
  Farmland: 2, Woodland: 4, 'Starfall Hammock': 5, 'Tidewhisper Sandcastle': 5, 'Floral Windmill': 5, 'Dewy House': 2,
  'Heat Furnace': 2, 'Cooling Unit': 2, Sunlamp: 2,
};

const requisito = new Map(csv('aniimo_requirements.csv').map((r) => [`${r.facility}/${r.name}`, { habilidade: r.ability, nivel: Number(r.min_level) }]));
const naoVerificado = new Set(csv('unverified.csv').map((r) => `${r.facility}/${r.name}`));
const especiais = new Set(cfg.SPECIAL_RECIPES.map((r: { name: string; facility: string }) => `${r.facility}/${r.name}`));
const passos = csv('grower_steps.csv');

const receitas = readdirSync(join(raiz, 'data'))
  .filter((a) => a.endsWith('.csv') && porSlug.has(a.replace('.csv', '')))
  .flatMap((arq) => {
    const instalacao = porSlug.get(arq.replace('.csv', '')) as string;
    const tipo = instalacao === 'Farmland' || instalacao === 'Woodland' ? 'lavoura' : COLETA.has(instalacao) ? 'coleta' : 'processador';
    return csv(arq).map((r) => {
      const chave = `${instalacao}/${r.name}`;
      const [modulo, nivelModulo] = (r.module_requirement || '').split(':');
      const insumos = r.raw_materials ? r.raw_materials.split(';').map((m, i) => [m, Number(r.required_amount.split(';')[i])]) : [];
      return {
        id: r.name,
        nome: nome(r.name),
        instalacao,
        tipo,
        nivel: Number(r.facility_level),
        ...(modulo && { modulo, nivelModulo: Number(nivelModulo) }),
        ...(r.environment && { clima: r.environment }),
        moeda: r.sell_currency || 'coins',
        preco: num(r.sell_value) ?? 0,
        custo: num(r.cost) ?? 0,
        // lavoura: segundos de crescimento; coleta/processador: workload (1 por segundo a 100%).
        ...(tipo === 'lavoura' ? { tempo: num(r.production_time) } : { workload: num(r.workload) ?? num(r.production_time) }),
        rendimento: num(r.yield) ?? 1,
        ...(SUBPRODUTO[instalacao] && num(r.byproduct_yield) && { subproduto: [SUBPRODUTO[instalacao], num(r.byproduct_yield)] }),
        insumos,
        ...(requisito.get(chave) && { requisito: requisito.get(chave) }),
        ...(tipo === 'lavoura' && { passos: passos.filter((p) => p.name === r.name).map((p) => ({ passo: p.step, habilidade: p.ability, nivel: Number(p.min_level), workload: Number(p.workload) })) }),
        ...(especiais.has(chave) && { especial: true }),
        ...(naoVerificado.has(chave) && { naoVerificada: true }),
      };
    });
  });

// Variante "quick_" (semente/módulo mais rápido) produz o item normal: quick_lemon vira lemon no estoque (aniimax, exact.rs).
const ids = new Set(receitas.map((r) => r.id));
for (const r of receitas as Record<string, unknown>[]) {
  const base = (r.id as string).replace(/^quick_/, '');
  if (base !== r.id && ids.has(base)) r.produz = base;
}

const instalacoes = cfg.FACILITIES.map((f: Record<string, unknown>) => ({
  nome: f.name,
  slug: f.slug,
  categoria: f.category,
  tipo: f.category === 'Environment' ? 'clima' : f.name === 'Farmland' || f.name === 'Woodland' ? 'lavoura' : COLETA.has(f.name as string) ? 'coleta' : 'processador',
  ...(f.ability && { habilidade: f.ability }),
  ...(f.personality && { personalidade: f.personality }),
  niveis: f.hasLevels === false ? { 1: (f.unlocks as Record<string, number>)[1] } : f.unlocks,
  quantidade: f.counts,
  ...(TAMANHO[f.name as string] && { tamanho: TAMANHO[f.name as string] }),
}));

const saida = {
  // MIT pede o aviso de copyright e a licença junto de cópias substanciais: vão no próprio JSON (e na API) e em data/homeland.LICENSE.
  fonte: { repo: 'https://github.com/ae-bii/aniimax', commit, licenca: readFileSync(join(raiz, 'LICENSE'), 'utf8').trim() },
  instalacoes,
  receitas,
  custosRV: cfg.LEVEL_UP_COSTS,
  modulos: cfg.MODULE_MAX_LEVELS,
  aniimoMax: cfg.ANIIMO_MAX,
  semPersonalidade: ['Dance Pad Polisher', 'Aniipod Maker'],
};
writeFileSync('data/homeland.json', JSON.stringify(saida, null, 1) + '\n');
writeFileSync('data/homeland.LICENSE', readFileSync(join(raiz, 'LICENSE'), 'utf8'));
console.log(`${instalacoes.length} instalações, ${receitas.length} receitas (commit ${commit.slice(0, 7)})`);
