// Coleta os itens do Aniidex (aniidex.com/items/), usado com permissão dos mantenedores, e grava data/itens.json.
// Uso: node scripts/fetch-aniidex.ts   (roda toda semana pelo workflow update-itens)
// O site entrega os itens já renderizados no HTML (sem JSON no payload), então o parse é por classe CSS.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://aniidex.com';
const UA = 'aniimo.ogoulart.dev data bot (+https://aniimo.ogoulart.dev/creditos)';
const CONCURRENCY = 2;
const DELAY_MS = 400;
const MAX_FALHAS = 0.05; // mais que isso = o site mudou ou caiu: aborta sem tocar em data/itens.json

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, tries = 3): Promise<string> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } }).catch((e) => e as Error);
    if (res instanceof Response && res.ok) return res.text();
    if (i >= tries) throw new Error(`${url}: ${res instanceof Response ? res.status : res.message}`);
    await sleep(1000 * 2 ** i);
  }
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#160': ' ', nbsp: ' ' };
/** HTML → texto: tira tags e comentários, decodifica entidades, mantém quebras de linha do texto do jogo. */
export const texto = (html: string) => html
  .replace(/<!--.*?-->/gs, '').replace(/<[^>]+>/g, '')
  .replace(/&(#?\w+);/g, (m, e) => ENT[e] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : m))
  .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
/** Texto de cada pedaço (tag) separado por " · ": em linhas como "Egg Hatch · Hatchable Aniimos · Bolty" os pedaços não têm espaço entre si. */
const partes = (html: string) => html.replace(/<!--.*?-->/gs, '').split(/<[^>]+>/).map(texto).filter(Boolean).join(' · ');
const um = (html: string, re: RegExp) => { const m = html.match(re); return m ? texto(m[1]) : null; };
const todos = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => texto(m[1]));
const numero = (s: string) => Number(s.replace(/[^\d]/g, ''));

export type Fonte = { tipo: string | null; onde: string; custo: { qtd: number; moeda: string }[] };
export type Item = {
  slug: string; id: number | null; nome: string; raridade: number; raridadeNome: string; categoria: string;
  funcao: string | null; descricao: string | null; info: Record<string, string>;
  fontes: Fonte[]; outras: { titulo: string; linhas: string[] }[];
};

/** Extrai um item do HTML da página /items/{slug}/. Lança erro se faltar o essencial (nome/raridade). */
export function parse(slug: string, html: string): Item {
  const ini = html.indexOf('class="content-layout"');
  if (ini < 0) throw new Error('sem content-layout');
  const h = html.slice(ini, html.indexOf('<footer', ini));
  const nome = um(h, /<h1 class="item-title"[^>]*>(.*?)<\/h1>/s);
  const q = h.match(/class="qp-(\d) quality-pill"[^>]*>([^<]+)/);
  if (!nome || !q) throw new Error('sem nome ou raridade');

  // "Overview": pares rótulo/valor (Sells for, etc.).
  const info: Record<string, string> = {};
  for (const m of h.matchAll(/class="stat-label"[^>]*>(.*?)<\/span><span class="stat-value"[^>]*>(.*?)<\/span>/gs)) info[texto(m[1])] = texto(m[2]);

  const fontes: Fonte[] = [];
  const outras: Item['outras'] = [];
  for (const sec of h.split(/<section class="info-section"/).slice(1)) {
    if (sec.startsWith(' item-overview')) continue;
    const titulo = um(sec, /class="section-title"[^>]*>(.*?)<\/h2>/s) ?? '';
    const linhas = sec.split(/<div class="obtain-row"/).slice(1);
    if (titulo.startsWith('How to Obtain')) {
      for (const l of linhas) fontes.push({
        tipo: um(l, /type-badge"[^>]*>(.*?)<\/span>/s),
        onde: todos(l, /class="obtain-detail"[^>]*>(.*?)<\/span>/gs).join(' · '),
        custo: [...l.matchAll(/class="cost-amount"[^>]*>(.*?)<\/span>.*?class="cost-label"[^>]*>(.*?)<\/span>/gs)].map((m) => ({ qtd: numero(texto(m[1])), moeda: texto(m[2]) })),
      });
    } else {
      // Seção de outro formato: guarda o texto de cada linha, sem assumir estrutura.
      const corpo = sec.slice(sec.indexOf('section-body'));
      outras.push({ titulo, linhas: (linhas.length ? linhas : corpo.split(/<div class="[a-z-]+-row"/).slice(1)).map((l) => partes(`<div${l}`)).filter(Boolean) });
    }
  }

  // Só a imagem do cabeçalho: as outras ui_item_* da página são moedas de custo e itens relacionados.
  const id = h.slice(0, h.indexOf('hero-info')).match(/\/images\/items\/ui_item_(\d+)/);
  return {
    slug, id: id ? Number(id[1]) : null, nome, raridade: Number(q[1]), raridadeNome: texto(q[2]),
    categoria: um(h, /class="category-pill"[^>]*>(.*?)<\/span>/s) ?? '',
    funcao: um(h, /<p class="func-rep-description"[^>]*>(.*?)<\/p>/s),
    descricao: um(h, /<p class="item-description"[^>]*>(.*?)<\/p>/s),
    info, fontes, outras,
  };
}

if (import.meta.main) {
  const sitemap = await get(`${BASE}/sitemap.xml`);
  // O sitemap vem com alguns slugs codificados duas vezes (%255b = "["): decodifica até estabilizar.
  const slugs = [...new Set([...sitemap.matchAll(/<loc>https:\/\/aniidex\.com\/items\/([^<]+?)\/<\/loc>/g)].map((m) => {
    let s = m[1];
    for (let d = decodeURIComponent(s); d !== s; s = d, d = decodeURIComponent(s));
    return s;
  }))];
  if (slugs.length < 100) throw new Error(`sitemap com só ${slugs.length} itens: formato mudou?`);

  const fila = [...slugs];
  const itens: Item[] = [];
  const falhas: string[] = [];
  async function worker() {
    while (fila.length) {
      const slug = fila.shift()!;
      try {
        itens.push(parse(slug, await get(`${BASE}/items/${encodeURIComponent(slug)}/`)));
      } catch (e) {
        falhas.push(`${slug}: ${(e as Error).message}`);
      }
      const n = itens.length + falhas.length;
      if (n % 250 === 0) console.log(`${n}/${slugs.length}`);
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (falhas.length) console.warn(`${falhas.length} falhas:\n${falhas.slice(0, 20).join('\n')}`);
  if (falhas.length > slugs.length * MAX_FALHAS) throw new Error(`${falhas.length} de ${slugs.length} itens falharam: abortando sem gravar`);

  itens.sort((a, b) => a.slug.localeCompare(b.slug));
  // Sem data de coleta no arquivo: assim o commit semanal só acontece quando algum item mudou de fato.
  await writeFile('data/itens.json', JSON.stringify({ fonte: `${BASE}/items/`, itens }, null, 1) + '\n');
  console.log(`ok: ${itens.length} itens em data/itens.json (${falhas.length} falhas)`);
}
