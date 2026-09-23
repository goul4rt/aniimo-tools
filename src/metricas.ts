// Métricas do site. Chaves vazias = nada é carregado (dev, forks, ou antes de configurar).
// As duas chaves são públicas por natureza (vão para o navegador), por isso ficam no código.

/** Cloudflare Web Analytics: visitas por página, origem, país, Web Vitals. Sem cookies. */
export const CF_BEACON = '';

/** PostHog: eventos de uso das ferramentas. Configurado sem cookies nem localStorage (persistence: 'memory'). */
export const POSTHOG_KEY = '';
export const POSTHOG_HOST = 'https://us.i.posthog.com';
