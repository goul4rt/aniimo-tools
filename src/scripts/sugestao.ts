// "Completar o time": escolhe Aniimo para as vagas livres a partir de quem já está no time.
export type Membro = { slug: string; chave: string; elementos: string[]; papeis: string[]; total: number };
export type Ataque = Record<string, { forte: string[]; fraco: string[] }>;

/** Nota de um time: mesmos critérios dos cards de análise da página. */
export function nota(time: Membro[], ataque: Ataque) {
  const els = Object.keys(ataque);
  const meus = [...new Set(time.flatMap((m) => m.elementos))];
  const cobre = els.filter((d) => meus.some((a) => ataque[a].forte.includes(d))).length;
  // Fraqueza em comum pesa mais quanto mais membros ela pega (2 membros = 1, 3 = 4, 4 = 9).
  let risco = 0;
  for (const e of els) {
    const n = time.filter((m) => m.elementos.some((x) => ataque[e].forte.includes(x))).length;
    if (n >= 2) risco += (n - 1) ** 2;
  }
  const papeis = new Set(time.flatMap((m) => m.papeis)).size;
  const forca = time.reduce((s, m) => s + m.total, 0) / Math.max(1, time.length);
  // ponytail: pesos na mão; cobertura manda, stats só desempatam (total ~300–600 → 6–12 pontos)
  return { cobre, risco, papeis, valor: cobre * 10 - risco * 6 + papeis * 5 + forca / 50 };
}

/**
 * Busca em feixe: a cada vaga, testa todas as opções em cima dos `largura` melhores times parciais.
 * Devolve até `quantas` sugestões variadas entre si (cada lista é só o que foi adicionado).
 */
export function sugere(base: Membro[], opcoes: Membro[], vagas: number, ataque: Ataque, largura = 40, quantas = 3) {
  // ponytail: feixe não garante o ótimo global; com 208 formas e ≤4 vagas a busca exaustiva seria ~7×10⁷ times
  let feixe: { add: number[]; valor: number }[] = [{ add: [], valor: 0 }];
  const noTime = new Set(base.map((m) => m.slug));
  for (let v = 0; v < vagas; v++) {
    const vistos = new Set<string>();
    const prox: typeof feixe = [];
    for (const s of feixe) {
      const usados = new Set([...noTime, ...s.add.map((i) => opcoes[i].slug)]);
      // Só índices crescentes: {A,B} e {B,A} são o mesmo time.
      for (let i = (s.add.at(-1) ?? -1) + 1; i < opcoes.length; i++) {
        if (usados.has(opcoes[i].slug)) continue;
        const add = [...s.add, i];
        const chave = add.join(',');
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        prox.push({ add, valor: nota([...base, ...add.map((j) => opcoes[j])], ataque).valor });
      }
    }
    if (!prox.length) break;
    prox.sort((a, b) => b.valor - a.valor);
    // Na última vaga fica a lista inteira, para ter de onde tirar sugestões variadas.
    feixe = v < vagas - 1 ? prox.slice(0, largura) : prox;
  }
  // Sugestões variadas: cada uma repete no máximo metade das espécies de qualquer sugestão anterior.
  const saida: Membro[][] = [];
  for (const s of feixe) {
    const time = s.add.map((i) => opcoes[i]);
    if (!time.length) continue;
    const limite = Math.floor(time.length / 2);
    if (saida.some((o) => o.filter((m) => time.some((t) => t.slug === m.slug)).length > limite)) continue;
    saida.push(time);
    if (saida.length === quantas) break;
  }
  return saida;
}
