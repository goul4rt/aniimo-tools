// Extrai do planejador do Hideout Guides (https://www.hideoutgacha.com/games/aniimo/homeland-layout) o que o aniimax
// não tem: grade de lotes, tamanho real das 26 construções, clima gradual, equipe dos prédios de clima e as habilidades
// de trabalho de cada Aniimo. Uso com permissão dos mantenedores do Hideout (informada em 23/09/2026; ver ADR).
// Uso: node scripts/homeland-hideout.cjs   (baixa a página, acha o chunk do planejador e grava data/homeland-hideout.json)
// Só lê literais de dados, avaliados num sandbox vazio (vm), sem executar o código deles.
const fs = require('fs'), vm = require('vm');
const BASE = 'https://www.hideoutgacha.com';
const UA = { 'User-Agent': 'aniimo.ogoulart.dev data bot (+https://aniimo.ogoulart.dev/creditos)' };

(async () => {
  const html = await (await fetch(`${BASE}/games/aniimo/homeland-layout`, { headers: UA })).text();
  const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[^"]+\.js/g))];
  let s = '';
  for (const c of chunks) {
    const js = await (await fetch(BASE + c, { headers: UA })).text();
    if (js.includes('g=[{slug:"aniipod-maker"') || js.includes('{slug:"aniipod-maker"')) { s = js; break; }
  }
  if (!s) throw new Error('chunk do planejador não encontrado: o site mudou?');

  const literal = (inicio) => {
    const abre = s[inicio], fecha = abre === '[' ? ']' : '}';
    let n = 0, str = null;
    for (let i = inicio; i < s.length; i++) {
      const ch = s[i];
      if (str) { if (ch === '\\') { i++; continue; } if (ch === str) str = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
      if (ch === '[' || ch === '{') n++;
      if (ch === ']' || ch === '}') { n--; if (n === 0) return s.slice(inicio, i + 1); }
    }
    throw new Error('literal sem fim');
  };
  const avalia = (txt) => vm.runInNewContext('(' + txt + ')', Object.create(null), { timeout: 1000 });
  const depoisDe = (marca, desde = 0) => { const i = s.indexOf(marca, desde); if (i < 0) throw new Error(`não achei ${marca}`); return avalia(literal(i + marca.search(/[[{]/))); };

  const iG = s.indexOf('{slug:"aniipod-maker"');
  const instalacoes = avalia(literal(s.lastIndexOf('[', iG)));
  const antes = s.lastIndexOf('n=[0,2e3', iG);
  const habilidades = avalia(literal(s.lastIndexOf('=[{id:', antes) + 1));
  const iClima = s.indexOf('let c={"heat-furnace":');

  const saida = {
    fonte: {
      site: `${BASE}/games/aniimo/homeland-layout`,
      extraidoEm: new Date().toISOString().slice(0, 10),
      permissao: 'Uso permitido pelos mantenedores do Hideout Guides (informado ao projeto em 23/09/2026).',
    },
    lote: depoisDe('s={w:', antes),
    grade: depoisDe('c=[{col:', antes),
    custoLote: depoisDe('n=[', antes),
    liberaLote: depoisDe('d=[', antes),
    instalacoes: instalacoes.map((f) => ({
      slug: f.slug, nome: f.name, categoria: f.categoryName, tamanho: f.footprint, gira: !!f.canRotate,
      ...(f.influence && { influencia: f.influence }),
    })),
    clima: {
      modos: depoisDe('let c={', iClima - 1),
      escala: depoisDe('y={Freeze', iClima),
      razao: depoisDe('d=[1,', iClima),
      equipe: depoisDe('m={"heat-furnace"', iClima),
    },
    habilidades: habilidades.map((h) => ({
      nome: h.name, habilidades: h.abilities,
      ...(h.variants && { variantes: h.variants.map((v) => ({ habilidades: v.abilities, chance: v.geneticProb })) }),
    })),
  };
  fs.writeFileSync('data/homeland-hideout.json', JSON.stringify(saida, null, 1) + '\n');
  console.log(`${saida.instalacoes.length} construções, ${saida.habilidades.length} Aniimo, ${saida.grade.length} lotes`);
})();
