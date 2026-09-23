// Combobox de Aniimo (padrão ARIA 1.2 "combobox + listbox"), no lugar do <datalist> nativo,
// que no Chrome/macOS abre um popup escuro do sistema, só com o texto e sem imagem.
import { COR, ELEMENTO } from '../rotulos.ts';
import type { Elemento } from '../types.ts';

export type Opcao = { slug: string; nome: string; en: string; imagem: string; elementos: string[] };

// Nomes vêm da wiki (fonte externa): escapar antes de ir para innerHTML.
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export const chip = (e: string) =>
  `<span class="rounded-full px-2 py-px text-[11px] font-semibold ${COR[e as Elemento]}">${ELEMENTO[e as Elemento]}</span>`;

let n = 0;

/** Liga o combobox a um <input>. `escolhe` recebe o slug escolhido, ou null quando o campo é limpo. */
export function seletor(input: HTMLInputElement, opcoes: Opcao[], escolhe: (slug: string | null) => void) {
  const id = `seletor-${n++}`;
  const busca = new Map(opcoes.map((o) => [o.slug, semAcento([o.nome, o.en, o.slug, ...o.elementos.map((e) => ELEMENTO[e as Elemento])].join(' '))]));
  let atual: Opcao | undefined;
  let visiveis: Opcao[] = [];
  let ativo = -1;

  const caixa = document.createElement('div');
  caixa.className = 'relative';
  input.replaceWith(caixa);
  caixa.append(input);
  input.classList.add('pr-10');
  Object.assign(input, { autocomplete: 'off', spellcheck: false });
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', id);
  input.setAttribute('aria-expanded', 'false');

  const limpar = document.createElement('button');
  limpar.type = 'button';
  limpar.hidden = true;
  limpar.setAttribute('aria-label', 'Limpar');
  limpar.className = 'absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-lg leading-none text-muted hover:bg-danube-100 hover:text-ink';
  limpar.textContent = '×';

  const lista = document.createElement('ul');
  lista.id = id;
  lista.hidden = true;
  lista.setAttribute('role', 'listbox');
  lista.className = 'absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white p-1.5 shadow-[0_12px_32px_-8px_rgb(21_57_58/.25)]';
  caixa.append(limpar, lista);

  const marca = (i: number) => {
    ativo = i;
    [...lista.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    if (i < 0) return input.removeAttribute('aria-activedescendant');
    input.setAttribute('aria-activedescendant', `${id}-${i}`);
    lista.children[i].scrollIntoView({ block: 'nearest' });
  };

  function abre() {
    const q = semAcento(input.value);
    // Com um Aniimo já escolhido, abrir de novo mostra todos (o texto no campo é o nome dele, não uma busca).
    visiveis = !q || q === semAcento(atual?.nome ?? '') ? opcoes : opcoes.filter((o) => busca.get(o.slug)!.includes(q));
    lista.innerHTML = visiveis.length
      ? visiveis.map((o, i) => `
        <li id="${id}-${i}" role="option" aria-selected="false" data-i="${i}"
          class="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 aria-selected:bg-danube-50 ${o.slug === atual?.slug ? 'font-semibold' : ''}">
          <img src="${esc(o.imagem)}" alt="" loading="lazy" width="40" height="40" class="h-10 w-10 shrink-0 rounded-xl bg-danube-100 object-contain" onerror="this.style.visibility='hidden'" />
          <span class="min-w-0 flex-1 leading-tight">
            <span class="block truncate font-display text-[15px] font-semibold text-ink">${esc(o.nome)}</span>
            <span class="block truncate text-xs text-muted">${esc(o.en)}</span>
          </span>
          <span class="flex shrink-0 gap-1">${o.elementos.map(chip).join('')}</span>
        </li>`).join('')
      : '<li class="px-3 py-2 text-sm text-muted">Nenhum Aniimo com esse nome.</li>';
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    marca(visiveis.length && q ? 0 : -1);
  }

  function fecha() {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    marca(-1);
  }

  function define(o: Opcao | undefined, avisa = true) {
    atual = o;
    input.value = o?.nome ?? '';
    limpar.hidden = !o;
    fecha();
    if (avisa) escolhe(o?.slug ?? null);
  }

  input.addEventListener('focus', () => { input.select(); abre(); });
  input.addEventListener('click', () => lista.hidden && abre());
  input.addEventListener('input', () => { limpar.hidden = !input.value; abre(); });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (lista.hidden) return abre();
      const d = ev.key === 'ArrowDown' ? 1 : -1;
      marca((ativo + d + visiveis.length) % visiveis.length);
    } else if (ev.key === 'Enter' && !lista.hidden) {
      ev.preventDefault();
      if (visiveis[ativo]) define(visiveis[ativo]);
    } else if (ev.key === 'Escape') {
      fecha();
    }
  });
  // Saiu do campo: aceita um nome digitado por completo; senão volta ao Aniimo que já estava escolhido.
  input.addEventListener('blur', () => {
    const q = semAcento(input.value);
    if (!q) return define(undefined, atual !== undefined);
    const exato = opcoes.find((o) => [o.nome, o.en, o.slug].some((x) => semAcento(x) === q));
    if (exato && exato !== atual) define(exato);
    else define(atual, false);
  });
  // mousedown em vez de click: não tira o foco do input antes de escolher.
  lista.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    const li = (ev.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (li) define(visiveis[Number(li.dataset.i)]);
  });
  lista.addEventListener('mousemove', (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (li && Number(li.dataset.i) !== ativo) marca(Number(li.dataset.i));
  });
  limpar.addEventListener('click', () => { define(undefined); input.focus(); });

  /** Preenche sem disparar `escolhe` (restaurar o time/comparação do link). */
  return { define: (slug: string) => define(opcoes.find((o) => o.slug === slug), false) };
}

/** Pílulas de forma no lugar do <select>: só aparecem quando o Aniimo tem mais de uma forma. */
export function pilulas(box: HTMLElement, formas: { chave: string; nome: string }[], atual: string, escolhe: (chave: string) => void) {
  box.innerHTML = formas.length < 2 ? '' : formas.map((f) =>
    `<button type="button" data-chave="${esc(f.chave)}" aria-pressed="${f.chave === atual}"
      class="cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${f.chave === atual
        ? 'border-casal bg-casal text-white'
        : 'border-danube-100 bg-white text-casal hover:border-danube'}">${esc(f.nome)}</button>`).join('');
  box.onclick = (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-chave]');
    if (b) escolhe(b.dataset.chave!);
  };
}
