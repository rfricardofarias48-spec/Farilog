// Utilitários de notas, proximidade e contato — compartilhados entre admin e encarregado.

import {
  normalizeText,
  parseCidade,
  getCompanyCity,
  normalizarCidade,
  distanciaEntreCidades,
} from './cidades.js';

export { normalizeText, parseCidade, getCompanyCity, normalizarCidade };

function lerCidade(value) {
  if (value && typeof value === 'object' && ('city' in value || 'display' in value)) {
    const city = value.city || value.display || '';
    return {
      ...value,
      city,
      display: value.display || city,
      key: value.key || normalizeText(city),
    };
  }
  return parseCidade(value);
}

// Compara a cidade do ajudante com a cidade da empresa usando a leitura
// canônica (CEP, UF, bairro e link de mapa já resolvidos). Quando as duas
// cidades são conhecidas, a distância entre os centroides separa "vizinha"
// de "mesma UF" — sem transformar quem está na mesma cidade em "outra cidade".
export function compararProximidade(cidadeAjudante, cidadeEmpresa) {
  const a = lerCidade(cidadeAjudante);
  const b = lerCidade(cidadeEmpresa);
  const ka = a.key || normalizeText(a.city);
  const kb = b.key || normalizeText(b.city);

  if (!ka || !kb) {
    return {
      level: 3,
      label: 'Cidade não informada',
      detail: 'Complete a cidade no cadastro',
    };
  }

  if (ka === kb) {
    return { level: 0, label: 'Mesma cidade', detail: b.display || b.city };
  }

  const km = distanciaEntreCidades(ka, kb);
  const vizinha = km != null && km <= 25;
  const detalheA = a.uf ? `${a.display || a.city}/${a.uf}` : (a.display || a.city);

  if (a.uf && b.uf && a.uf === b.uf) {
    return {
      level: 1,
      label: vizinha ? `Cidade vizinha · ${Math.round(km)} km` : 'Mesma UF',
      detail: detalheA,
    };
  }

  if (vizinha) {
    return {
      level: 1,
      label: `Cidade vizinha · ${Math.round(km)} km`,
      detail: detalheA,
    };
  }

  return { level: 2, label: 'Outra cidade', detail: detalheA };
}

// Ordena: primeiro os mais próximos; dentro do grupo, maior nota média.
export function rankCandidatos(candidatos, cidadeEmpresa) {
  return candidatos
    .map(c => {
      const prox = compararProximidade(c.cidade, cidadeEmpresa);
      const media = c.media == null ? null : Number(c.media);
      const bonusProximidade = prox.level === 0 ? 30 : prox.level === 1 ? 18 : prox.level === 2 ? 6 : 2;
      const score = Math.round((media == null ? 0 : (media / 5) * 70) + bonusProximidade);
      return {
        ...c,
        media,
        proximidadeLevel: prox.level,
        proximidadeLabel: prox.label,
        proximidadeDetail: prox.detail,
        matchScore: score,
      };
    })
    .sort((a, b) => (
      a.proximidadeLevel - b.proximidadeLevel ||
      (b.media ?? -1) - (a.media ?? -1) ||
      String(a.name).localeCompare(String(b.name), 'pt-BR')
    ));
}

export function whatsappLink(telefone, mensagem) {
  if (!telefone) return null;
  let digits = String(telefone).replace(/\D/g, '');
  if (!digits) return null;
  if (!digits.startsWith('55')) digits = `55${digits}`;
  const text = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  return `https://wa.me/${digits}${text}`;
}

export function fmtNota(media) {
  if (media == null || Number.isNaN(Number(media))) return '—';
  return Number(media).toFixed(1).replace('.', ',');
}

export function notaCor(media) {
  if (media == null) return '#9A9A9A';
  return '#0B0B0B';
}

// Tons neutros para avatares — a paleta é monocromática, então a cor gravada
// no banco não é usada: derivamos um tom estável a partir de id/nome.
const AVATAR_TONES = ['#0B0B0B', '#1C1C1C', '#2A2A2A', '#333333', '#4A4A4A', '#6B6B6B'];
export function avatarTone(seed) {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function fmtDataCurta(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  const dow = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}