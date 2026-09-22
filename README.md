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
