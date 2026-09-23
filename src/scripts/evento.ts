// Eventos de uso (PostHog). Sem PostHog carregado vira no-op, então dá para chamar em qualquer lugar.
type PH = { capture: (nome: string, props?: Record<string, unknown>) => void };
const ph = () => (window as unknown as { posthog?: PH }).posthog;

export const evento = (nome: string, props?: Record<string, unknown>) => ph()?.capture(nome, props);

// Para ações repetitivas (arrastar na tier list, marcar na coleção): conta uma vez por visita à página.
const jaFoi = new Set<string>();
export const umaVez = (nome: string, props?: Record<string, unknown>) => {
  if (jaFoi.has(nome)) return;
  jaFoi.add(nome);
  evento(nome, props);
};
