// Status de confirmação de uma diária (registros/escala).
// Ficava em AdminDemanda; foi extraído para ser compartilhado sem arrastar a
// tela antiga de lançamento de demanda.

export const STATUS_CONFIG = {
  aguardando: { label: 'Aguardando', color: '#6B6B6B', bg: '#F7F7F7' },
  confirmado: { label: 'Confirmado', color: '#0B0B0B', bg: '#F5F5F5' },
  atrasado:   { label: 'Atrasado',   color: '#9E3D22', bg: '#FAF4F1' },
  falta:      { label: 'Falta',      color: '#4A4A4A', bg: '#F5F5F5' },
  finalizado: { label: 'Finalizado', color: '#6B6B6B', bg: '#F5F5F5' },
};