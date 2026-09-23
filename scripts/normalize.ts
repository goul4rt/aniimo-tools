// Junta raw/en + raw/pt no esquema do site e grava data/aniimos.json.
// Aborta sem escrever se o resultado parecer quebrado (guarda contra mudança de formato da wiki).
// Uso: node scripts/normalize.ts
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Aniimo, Elemento, Forma, Habilidade, Papel, Texto } from '../src/types.ts';

const OUT = 'data/aniimos.json';
const ELEMENTOS: Elemento[] = ['fire', 'water', 'grass', 'electric', 'ice', 'rock', 'wind', 'holy', 'dark'];
const PAPEIS: Papel[] = ['dps', 'break', 'sup', 'heal', 'energy'];

// Payload da wiki: sem esquema publicado, então `any` aqui é honesto.
type Raw = any;
const read = (p: string): Raw => JSON.parse(readFileSync(p, 'utf8'));
const info = (d: Raw) => d.directories[0].components[0].props.formData;
const section = (d: Raw, title: string) => d.directories.find((x: Raw) => x.title === title);
const slugify = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (v: unknown) => (v === '' || v == null ? undefined : Number(v));

const formaPt = new Map<string, string>(read('raw/pt/_formas.json').map((t: Raw) => [t.tagKey, t.name]));

// Coleta os componentes "circle" (skill/trait) em ordem, com o título da seção/aba mais próxima.
function circles(nodes: Raw[] | null, grupo: string, out: { grupo: string; p: Raw }[] = []) {
  for (const n of nodes ?? []) {
    // ponytail: circles sem ícone são travessia (CLIMB/GLIDE "Lv.N"), fora do esquema por ora
    if (n.type === 'circle' && n.props.icon) out.push({ grupo, p: n.props });
    const g = n.type === 'crumbTitle' ? n.props.title : grupo;
    for (const t of n.props?.tabs ?? []) circles(t.children, t.title, out);
    circles(n.children, g, out);
  }
  return out;
}

function habilidades(en: Raw, pt: Raw, arquivo: string) {
  // As seções da página PT vêm traduzidas; o índice da seção EN vale para as duas.
  const i = en.directories.findIndex((x: Raw) => x.title === 'Aniimo Ability');
  const a = i < 0 ? [] : circles(en.directories[i].components, '');
  const b = i < 0 ? [] : circles(pt.directories[i].components, '');
  if (a.length !== b.length) throw new Error(`${arquivo}: EN tem ${a.length} habilidades, PT tem ${b.length}`);
  const skills: Habilidade[] = [];
  const traits: Habilidade[] = [];
  a.forEach(({ grupo, p }, k) => {
    const m = /_(Skill|Feature)_(\d+)_Icon/.exec(p.icon);
    if (!m) throw new Error(`${arquivo}: ícone sem id reconhecível: ${p.icon}`);
    if (!b[k].p.icon.includes(`_${m[1]}_${m[2]}_`)) throw new Error(`${arquivo}: EN e PT desalinhados na habilidade ${k}`);
    const h: Habilidade = {
      id: m[2],
      nome: { pt: b[k].p.descTitle, en: p.descTitle },
      desc: { pt: b[k].p.descContent, en: p.descContent },
      icone: p.icon,
      grupo: grupo.toLowerCase(),
      poder: num(p.source?.power),
      custo: num(p.source?.consume),
    };
    (m[1] === 'Feature' ? traits : skills).push(h);
  });
  return { skills, traits };
}

// Seção "Habitats" (nem toda página tem): lista de capsules com o nome da região, na mesma ordem em EN e PT.
function habitats(en: Raw, pt: Raw): Texto[] {
  const i = en.directories[0].components.findIndex((c: Raw) => c.props?.title === 'Habitats');
  if (i < 0) return [];
  const nomes = (d: Raw) => (d.directories[0].components[i].children ?? []).map((c: Raw) => c.props.title as string);
  const [a, b] = [nomes(en), nomes(pt)];
  return a.map((e: string, k: number) => ({ pt: b[k] ?? e, en: e }));
}

// Agrupa as formas por id.
const porId = new Map<string, { chave: string; en: Raw; pt: Raw }[]>();
for (const arquivo of readdirSync('raw/en').filter((f) => !f.startsWith('_'))) {
  const [id, chave] = arquivo.replace(/\.json$/, '').split('__');
  const lista = porId.get(id) ?? [];
  lista.push({ chave, en: read(`raw/en/${arquivo}`), pt: read(`raw/pt/${arquivo}`) });
  porId.set(id, lista);
}

const anterior: Aniimo[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const antes = new Map(anterior.map((a) => [a.id, a]));
const idPorNomeEn = new Map([...porId].map(([id, fs]) => [info(fs[0].en).name as string, id]));

const registros = [...porId].sort(([a], [b]) => a.localeCompare(b)).map(([id, lista]) => {
  // Ordem das formas = ordem da própria wiki.
  const ordem: string[] = lista[0].en.morphologyList.map((m: Raw) => m.currentMorphology);
  lista.sort((x, y) => ordem.indexOf(info(x.en).currentMorphology) - ordem.indexOf(info(y.en).currentMorphology));

  const formas: Forma[] = lista.map(({ chave, en, pt }) => {
    const f = info(en);
    return {
      chave,
      nome: { pt: formaPt.get(f.currentMorphology) ?? f.currentMorphology, en: f.currentMorphology },
      estagio: Number(f.currentStage),
      elementos: f.attributes.map((x: string) => x.replace('attributes-', '')),
      papeis: f.position.map((x: string) => x.replace('position-', '')),
      stats: {
        // Chaves internas da wiki ≠ nome exibido no jogo: magicAttack é BREAK e haste é REGEN.
        hp: f.hp, atk: f.physicalAttack, brk: f.magicAttack,
        pdef: f.physicalDefense, mdef: f.magicDefense, regen: f.haste, total: f.attributeValue,
      },
      ...habilidades(en, pt, `${id}/${chave}`),
      locais: habitats(en, pt),
      imagem: f.noGenderImage || f.maleImage,
    };
  });

  const base = lista.find((x) => x.chave === 'basic-form') ?? lista[0];
  const nome = { pt: info(base.pt).name, en: info(base.en).name };

  // A árvore de evolução só traz nomes EN; acha o próprio nó e resolve os filhos para id.
  const arvore = section(base.en, 'Basic Info').components
    .find((c: Raw) => c.props?.title === 'Evolution')?.children?.[0]?.props?.data;
  const acha = (n: Raw): Raw => (n?.name === nome.en ? n : n?.children?.map(acha).find(Boolean));
  const filhos: string[] = (acha(arvore)?.children ?? []).map((c: Raw) => idPorNomeEn.get(c.name)).filter(Boolean);

  return {
    id,
    slug: antes.get(id)?.slug ?? slugify(nome.pt), // ponytail: slug congelado; sem redirects porque ele nunca muda
    nome,
    desc: { pt: info(base.pt).desc, en: info(base.en).desc },
    evoluiPara: filhos, // ids por enquanto; viram slugs abaixo, quando todos os slugs existirem
    formas,
  };
});

const slugPorId = new Map(registros.map((r) => [r.id, r.slug]));
const agora = new Date().toISOString();
const aniimos: Aniimo[] = registros.map((r) => {
  const sem = { ...r, evoluiPara: r.evoluiPara.map((id) => slugPorId.get(id)!) };
  const velho = antes.get(r.id);
  // coletadoEm só avança quando o conteúdo muda; senão a Action commitaria todo dia.
  const igual = velho && JSON.stringify({ ...velho, coletadoEm: undefined }) === JSON.stringify({ ...sem, coletadoEm: undefined });
  return { ...sem, coletadoEm: igual ? velho.coletadoEm : agora };
});

// Guarda: melhor manter os dados de ontem do que publicar lixo.
const erros: string[] = [];
const total = (xs: Aniimo[]) => xs.reduce((n, a) => n + a.formas.length, 0);
if (total(aniimos) < total(anterior) * 0.9) erros.push(`formas caíram de ${total(anterior)} para ${total(aniimos)}`);
for (const id of antes.keys()) if (!slugPorId.has(id)) erros.push(`${id} sumiu`);
const slugs = new Set<string>();
for (const a of aniimos) {
  if (!a.nome.pt || !a.nome.en || !a.slug) erros.push(`${a.id}: nome/slug vazio`);
  if (slugs.has(a.slug)) erros.push(`${a.id}: slug duplicado ${a.slug}`);
  slugs.add(a.slug);
  for (const f of a.formas) {
    const onde = `${a.id}/${f.chave}`;
    if (!f.elementos.length || f.elementos.some((e) => !ELEMENTOS.includes(e))) erros.push(`${onde}: elementos ${f.elementos}`);
    if (!f.papeis.length || f.papeis.some((p) => !PAPEIS.includes(p))) erros.push(`${onde}: papéis ${f.papeis}`);
    if (!Object.values(f.stats).every(Number.isFinite)) erros.push(`${onde}: stats não numéricos`);
    if (!Number.isInteger(f.estagio)) erros.push(`${onde}: estágio ${f.estagio}`);
  }
}
if (erros.length) {
  console.error(`normalize abortado, ${OUT} não foi alterado:\n- ${erros.join('\n- ')}`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(aniimos, null, 2) + '\n');
console.log(`ok: ${aniimos.length} aniimos, ${total(aniimos)} formas em ${OUT}`);
