# aniimo-tools

Hub de ferramentas de Aniimo em PT-BR: [aniimo.ogoulart.dev](https://aniimo.ogoulart.dev). Fan-site não-oficial; Aniimo e todos os assets são © Pawprint Studio.

Decisões e escopo: [docs/adr/001-hub-aniimo.md](docs/adr/001-hub-aniimo.md).

```sh
npm install
npm run data   # baixa a wiki oficial (EN+PT) → raw/ → data/aniimos.json
npm run dev
npm run build
```

Requer Node >= 22.18 (os scripts `.ts` rodam direto no Node). `data/aniimos.json` é atualizado todo dia pela Action `update-data`.

## Bot de Discord (`bot/`)

Worker de HTTP interactions em https://aniimo-bot.extremeplays4.workers.dev: responde `/aniimo <nome>` com a ficha do Aniimo, com autocomplete. Teste local: `node bot/teste.mjs`.

Para ativar (uma vez):

1. Crie uma aplicação em https://discord.com/developers/applications e copie o **Application ID**, a **Public Key** e, na aba Bot, o **token**.
2. `cd bot && npx wrangler secret put DISCORD_PUBLIC_KEY` (cole a Public Key).
3. No portal, em *General Information → Interactions Endpoint URL*, coloque `https://aniimo-bot.extremeplays4.workers.dev` e salve. O Discord manda um PING, que o Worker precisa responder.
4. `DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... sh bot/registrar.sh`
5. Convite: `https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=applications.commands`
