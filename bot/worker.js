// Bot de Discord do Aniimo Tools via HTTP interactions: o Discord chama este Worker a cada /aniimo.
// Sem servidor nem gateway; os dados vêm da API pública do site.
// Segredos (wrangler secret put): DISCORD_PUBLIC_KEY. Registro do comando: bot/registrar.sh.
const API = 'https://aniimo-tools.pages.dev/api/v1/aniimos.json'; // pages.dev direto: evita passar pelo proxy
const SITE = 'https://aniimo.ogoulart.dev';
const ELEMENTO = { fire: 'Fogo', water: 'Água', grass: 'Grama', electric: 'Elétrico', ice: 'Gelo', rock: 'Rocha', wind: 'Vento', holy: 'Sagrado', dark: 'Trevas' };
const PAPEL = { dps: 'DPS', break: 'QUEBRA', sup: 'Suporte', heal: 'Cura', energy: 'REGEN.' };
const ESTAGIO = { 1: 'Lumin', 2: 'Gamma', 3: 'Nova' };

const hex = (s) => new Uint8Array(s.match(/../g).map((b) => parseInt(b, 16)));
const semAcento = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const json = (body) => Response.json(body);

async function valida(req, body, chave) {
  const sig = req.headers.get('x-signature-ed25519');
  const ts = req.headers.get('x-signature-timestamp');
  if (!sig || !ts) return false;
  const key = await crypto.subtle.importKey('raw', hex(chave), { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify('Ed25519', key, hex(sig), new TextEncoder().encode(ts + body));
}

async function aniimos() {
  // Cache da edge por 1 h: a API muda no máximo uma vez por dia.
  const r = await fetch(API, { cf: { cacheTtl: 3600, cacheEverything: true } });
  return r.json();
}

function embed(a) {
  const f = a.formas.find((x) => x.chave === 'basic-form') ?? a.formas[0];
  const s = f.stats;
  const formas = a.formas.map((x) => x.nome.pt).join(', ');
  const locais = [...new Set(a.formas.flatMap((x) => x.locais.map((l) => l.pt)))].join(', ');
  return {
    title: `#${a.id} ${a.nome.pt} (${a.nome.en})`,
    url: `${SITE}/aniilog/${a.slug}/`,
    description: a.desc.pt,
    thumbnail: { url: f.imagem },
    fields: [
      { name: 'Elementos', value: f.elementos.map((e) => ELEMENTO[e]).join(', '), inline: true },
      { name: 'Função', value: f.papeis.map((p) => PAPEL[p]).join(', '), inline: true },
      { name: 'Estágio', value: ESTAGIO[f.estagio] ?? String(f.estagio), inline: true },
      { name: 'Stats', value: `PV ${s.hp} · ATQ ${s.atk} · QUEBRA ${s.brk} · DEF F. ${s.pdef} · DEF M. ${s.mdef} · REGEN. ${s.regen} · **Total ${s.total}**` },
      ...(a.formas.length > 1 ? [{ name: 'Formas', value: formas }] : []),
      ...(locais ? [{ name: 'Onde encontrar', value: locais.slice(0, 1024) }] : []),
    ],
    footer: { text: 'aniimo.ogoulart.dev · fan-site não-oficial · © Pawprint Studio' },
  };
}

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return Response.redirect(SITE, 302);
    if (!env.DISCORD_PUBLIC_KEY) return new Response('bot não configurado: falta DISCORD_PUBLIC_KEY', { status: 503 });
    const body = await req.text();
    if (!(await valida(req, body, env.DISCORD_PUBLIC_KEY))) return new Response('assinatura inválida', { status: 401 });
    const i = JSON.parse(body);

    if (i.type === 1) return json({ type: 1 }); // PING do Discord ao salvar o endpoint

    const opcao = i.data?.options?.find((o) => o.name === 'nome');
    const lista = await aniimos();

    if (i.type === 4) { // autocomplete enquanto digita
      const q = semAcento(opcao?.value ?? '');
      const achados = lista.filter((a) => !q || semAcento(`${a.nome.pt} ${a.nome.en}`).includes(q)).slice(0, 25);
      return json({ type: 8, data: { choices: achados.map((a) => ({ name: `${a.nome.pt} (${a.nome.en})`, value: a.slug })) } });
    }

    if (i.type === 2 && i.data.name === 'aniimo') {
      const q = semAcento(opcao?.value ?? '');
      const a = lista.find((x) => x.slug === q) ?? lista.find((x) => [x.nome.pt, x.nome.en, x.id].some((n) => semAcento(n) === q))
        ?? lista.find((x) => semAcento(`${x.nome.pt} ${x.nome.en}`).includes(q));
      if (!a) return json({ type: 4, data: { content: `Não achei "${opcao?.value}". Tente o nome em português ou inglês.`, flags: 64 } });
      return json({ type: 4, data: { embeds: [embed(a)] } });
    }

    return json({ type: 4, data: { content: 'Comando desconhecido.', flags: 64 } });
  },
};
