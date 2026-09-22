// ponytail: o token do wrangler não tem escopo de DNS, e custom domain de Worker cria o DNS sozinho.
// Então aniimo.ogoulart.dev → este Worker → Pages (que segue com deploy por push).
// Trocar por custom domain direto no Pages quando existir o CNAME aniimo → aniimo-tools.pages.dev.
export default {
  fetch(req) {
    const url = new URL(req.url);
    url.hostname = 'aniimo-tools.pages.dev';
    return fetch(new Request(url, req));
  },
};
