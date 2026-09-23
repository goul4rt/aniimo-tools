# Aniimo Tools

Ferramentas de Aniimo em português: **[aniimo.ogoulart.dev](https://aniimo.ogoulart.dev)**.
Nomes oficiais do jogo e dados atualizados todo dia a partir da wiki oficial.

Fan-site não-oficial e sem fins comerciais. Aniimo, nomes, textos e imagens são © Pawprint Studio; o site não hospeda assets do jogo (as imagens vêm do CDN oficial).

## Ferramentas

| Página | O que faz |
|---|---|
| [Aniilog](https://aniimo.ogoulart.dev/aniilog/) | Os 88 Aniimo e todas as formas: stats, skills, traços e onde encontrar |
| [Tabela de tipos](https://aniimo.ogoulart.dev/tipos/) | Quem ataca bem e quem resiste, e os 81 confrontos |
| [Códigos](https://aniimo.ogoulart.dev/codigos/) | Códigos de resgate ativos, com botão de copiar |
| [Coleção](https://aniimo.ogoulart.dev/colecao/) | Marque as formas que você tem, incluindo Prismana; exporta e importa |
| [Montador de time](https://aniimo.ogoulart.dev/time/) | Cobertura, fraquezas em comum e funções; times prontos da comunidade e sugestão automática para as vagas livres |
| [Comparar](https://aniimo.ogoulart.dev/comparar/) | Até 3 Aniimo ou formas lado a lado |
| [Homeland](https://aniimo.ogoulart.dev/homeland/) | Otimizador de produção: o que cada instalação faz para mais Home Coin/h, equipe de Aniimo, layout de clima automático, receitas e custos de RV; tudo num link compartilhável |
| [Tier list](https://aniimo.ogoulart.dev/tier/) | Arraste os Aniimo para SSS…D, renomeie as tiers, filtre por Prismana |
| [Resonance](https://aniimo.ogoulart.dev/evolucao/) | Materiais até o estágio que você quer |
| [API pública](https://aniimo.ogoulart.dev/api/) | Todos os dados em JSON aberto, com CORS liberado |

Também há um bot de Discord (`/aniimo <nome>`), descrito [mais abaixo](#bot-de-discord-bot).

## Rodando local

Requer Node >= 22.18 (os scripts `.ts` rodam direto no Node, sem tsx).

```sh
npm install
npm run dev     # http://localhost:4321
npm run build   # gera dist/, incluindo as imagens OG
npm run data    # baixa a wiki oficial (EN+PT) → raw/ → data/aniimos.json
```

Checagens (asserts, sem framework):

```sh
node src/scripts/sugestao.check.ts      # sugestão de time
node src/homeland/otimizador.check.ts   # otimizador de Homeland (eficiências medidas no jogo, planos por RV)
node src/homeland/layout.check.ts       # cobertura de clima, link do layout, layout automático
```

## Como está organizado

```
data/            JSON versionado: aniimos (da wiki), elementos, códigos, resonance e times prontos (à mão, com fontes)
scripts/         coleta e normalização da wiki (npm run data)
src/paginas.ts   registro das páginas: imagem OG, sitemap e breadcrumbs
src/pages/       páginas, API (api/v1/*.json), sitemap.xml e imagens OG (og/[...rota].png.ts)
src/scripts/     código do navegador: seletor de Aniimo, sugestão de time, ícones
src/homeland/    otimizador (programação linear inteira com YALPS), layout de clima e a página do Homeland
src/styles/      tokens do guia de estilo (cores Danube/Casal/Zumthor, Fredoka + Plus Jakarta Sans)
bot/             Worker do bot de Discord
proxy/           Worker que serve o domínio próprio a partir do Pages
docs/adr/        decisões e escopo
```

### Dados

- `data/aniimos.json` é atualizado todo dia (09:00 UTC) pela Action `update-data`. Ela só faz commit quando algo mudou, e o commit dispara o deploy. Se a coleta falhar, o site segue com os dados anteriores.
- Tabela de tipos, códigos, Resonance e times prontos são conferidos à mão. Cada arquivo guarda as fontes e a data da conferência, e as páginas citam as fontes.
- Homeland (`data/homeland.json`) vem do [aniimax](https://github.com/ae-bii/aniimax) (MIT, © aebii), convertido por `scripts/homeland.ts`. Para atualizar: `git clone https://github.com/ae-bii/aniimax /tmp/aniimax && node scripts/homeland.ts /tmp/aniimax`. A licença deles vai junto no JSON e em `data/homeland.LICENSE`.
- Os times prontos (`data/times.json`) são validados no build: se um Aniimo ou forma sumir da wiki, o build falha apontando o time.

### Página nova

1. Crie o arquivo em `src/pages/`, usando o layout `Base`.
2. Registre a rota em `src/paginas.ts`, com título e subtítulo para a imagem OG.

Sem o passo 2 o build falha de propósito: é o que garante que toda página tem imagem de compartilhamento e entra no sitemap.

### SEO e compartilhamento

- Cada página tem title, description, canonical, Open Graph, Twitter card e JSON-LD (WebSite na home, BreadcrumbList nas demais).
- As imagens OG (1200×630) são geradas no build com [satori](https://github.com/vercel/satori) + [resvg](https://github.com/yisibl/resvg-js), a partir das fontes em `src/og/fontes/`. As fichas do Aniilog mostram elementos, funções e stats base.
- `robots.txt` e `sitemap.xml` são gerados junto com o site.

## Deploy

Cloudflare Pages, com deploy a cada push em `main`. O domínio `aniimo.ogoulart.dev` passa pelo Worker em `proxy/` (detalhes no ADR).

## Bot de Discord (`bot/`)

Worker de HTTP interactions em https://aniimo-bot.extremeplays4.workers.dev: responde `/aniimo <nome>` com a ficha do Aniimo, com autocomplete. Teste local: `node bot/teste.mjs`.

Para ativar (uma vez):

1. Crie uma aplicação em https://discord.com/developers/applications e copie o **Application ID**, a **Public Key** e, na aba Bot, o **token**.
2. `cd bot && npx wrangler secret put DISCORD_PUBLIC_KEY` (cole a Public Key).
3. No portal, em *General Information → Interactions Endpoint URL*, coloque `https://aniimo-bot.extremeplays4.workers.dev` e salve. O Discord manda um PING, que o Worker precisa responder.
4. `DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... sh bot/registrar.sh`
5. Convite: `https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=applications.commands`

## Créditos e contato

Dados da [wiki oficial de Aniimo](https://wiki.aniimo.com/pt/); referências da comunidade citadas em cada página. Erros nos dados, sugestões ou pedidos de remoção: [abra uma issue](https://github.com/goul4rt/aniimo-tools/issues).

Curtiu o projeto? [Apoie no Ko-fi](https://ko-fi.com/ogoul4rt) ☕
