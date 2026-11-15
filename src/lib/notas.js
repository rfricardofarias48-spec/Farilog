// Utilitários de notas, proximidade e contato — compartilhados entre admin e encarregado.

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function splitCidadeUF(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { city: '', uf: null };
  const m = raw.match(/^(.+?)\s*[\/-]\s*([A-Za-z]{2})$/);
  if (m) return { city: m[1].trim(), uf: m[2].toUpperCase() };
  return { city: raw, uf: null };
}

// A empresa guarda endereço livre e "localização" (às vezes um link do Google Maps).
// Extrai a cidade do endereço: "(Pelotas)", "Gravataí/RS" ou o último trecho do endereço.
export function getCompanyCity(company) {
  const loc = String(company?.location ?? '').trim();
  const isUrl = /^https?:\/\//i.test(loc) || /maps\./i.test(loc) || /google\.[a-z.]+\/maps/i.test(loc);
  if (loc && !isUrl && loc.length <= 80) return loc;

  const addr = String(company?.address ?? '').trim();
  if (!addr) return '';

  const paren = addr.match(/\(([^)]+)\)/);
  if (paren) return paren[1].trim();

  const uf = addr.match(/([^,\-–]+?)\s*[\/-]\s*[A-Za-z]{2}\s*$/);
  if (uf) return uf[1].trim();

  const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length) {
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) return '';
    return last;
  }
  return '';
}

export function compararProximidade(cidadeAjudante, cidadeEmpresa) {
  const a = splitCidadeUF(cidadeAjudante);
  const b = splitCidadeUF(cidadeEmpresa);
  const na = normalizeText(a.city);
  const nb = normalizeText(b.city);

  if (!na || !nb) {
    return { level: 3, label: 'Cidade não informada', detail: 'Sem cidade cadastrada' };
  }
  if (na === nb || na.includes(nb) || nb.includes(na)) {
    return { level: 0, label: 'Mesma cidade', detail: a.city };
  }
  if (a.uf && b.uf && a.uf === b.uf) {
    return { level: 1, label: 'Mesma UF', detail: `${a.city}/${a.uf}` };
  }
  return { level: 2, label: 'Outra cidade', detail: a.city };
}

// Ordena: primeiro os mais próximos; dentro do grupo, maior nota média.
export function rankCandidatos(candidatos, cidadeEmpresa) {
  return candidatos
    .map(c => {
      const prox = compararProximidade(c.cidade, cidadeEmpresa);
      const media = c.media == null ? null : Number(c.media);
      const bonusProximidade = prox.level === 0 ? 30 : prox.level === 1 ? 18 : prox.level === 2 ? 6 : 10;
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