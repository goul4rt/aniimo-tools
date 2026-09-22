// Baixa os payloads Nuxt da wiki oficial (EN + PT) e grava o bloco "aniimo-detail" decodificado em raw/.
// Uso: node scripts/fetch-wiki.ts
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { unflatten } from 'devalue';

const BASE = 'https://wiki.aniimo.com';
const UA = 'aniimo.ogoulart.dev data bot (+https://aniimo.ogoulart.dev/creditos)';
const LANGS = { en: '', pt: '/pt' } as const;
const CONCURRENCY = 2;
const DELAY_MS = 250;

// Tipos customizados que o Nuxt serializa no payload; sem eles o devalue lança "Unknown type".
const revivers = {
  ShallowReactive: (v: unknown) => v,
  Reactive: (v: unknown) => v,
  Ref: (v: unknown) => v,
  ShallowRef: (v: unknown) => v,
  EmptyRef: () => null,
  EmptyShallowRef: () => null,
  NuxtError: (v: unknown) => v,
  Island: (v: unknown) => v,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, tries = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } }).catch((e) => e as Error);
    if (res instanceof Response && res.ok) return res;
    if (i >= tries) throw new Error(`${url}: ${res instanceof Response ? res.status : res.message}`);
    await sleep(1000 * 2 ** i);
  }
}

// O sitemap EN é o índice; a rota PT é a mesma com prefixo /pt.
const sitemap = await (await get(`${BASE}/__sitemap__/en-US.xml`)).text();
const paths = [...sitemap.matchAll(/<loc>https:\/\/wiki\.aniimo\.com(\/item\/[^<]+)<\/loc>/g)].map((m) => m[1]);
if (paths.length === 0) throw new Error('sitemap sem /item/: formato mudou?');

const jobs = paths.flatMap((path) => Object.entries(LANGS).map(([lang, prefix]) => ({ lang, url: `${BASE}${prefix}${path}/_payload.json`, path })));

await rm('raw', { recursive: true, force: true });
for (const lang of Object.keys(LANGS)) await mkdir(`raw/${lang}`, { recursive: true });

let done = 0;
async function worker() {
  while (jobs.length) {
    const { lang, url, path } = jobs.shift()!;
    const data = unflatten(await (await get(url)).json(), revivers).data as Record<string, unknown>;
    const key = Object.keys(data).find((k) => k.startsWith('aniimo-detail'));
    if (!key) throw new Error(`${url}: sem aniimo-detail no payload`);
    // Tabela tagKey (EN) → nome traduzido das formas; é a única fonte do nome PT da forma.
    const tags = Object.keys(data).find((k) => k.startsWith('morphology-tags'));
    if (tags) await writeFile(`raw/${lang}/_formas.json`, JSON.stringify(data[tags]));
    // path = /item/{id}/{forma}
    const [, , id, forma] = path.split('/');
    await writeFile(`raw/${lang}/${id}__${forma}.json`, JSON.stringify(data[key]));
    if (++done % 50 === 0) console.log(`${done} payloads`);
    await sleep(DELAY_MS);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`ok: ${done} payloads de ${paths.length} formas em raw/`);
