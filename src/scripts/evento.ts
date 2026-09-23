// Eventos de uso (Umami). Sem o script carregado vira no-op, então dá para chamar em qualquer lugar.
type Umami = { track: (nome: string, dados?: Record<string, unknown>) => void };
const umami = () => (window as unknown as { umami?: Umami }).umami;

export const evento = (nome: string, dados?: Record<string, unknown>) => umami()?.track(nome, dados);

// Para ações repetitivas (arrastar na tier list, marcar na coleção): conta uma vez por visita à página.
const jaFoi = new Set<string>();
export const umaVez = (nome: string, dados?: Record<string, unknown>) => {
  if (jaFoi.has(nome)) return;
  jaFoi.add(nome);
  evento(nome, dados);
};
