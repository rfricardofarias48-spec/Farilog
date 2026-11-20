// Geolocalização e distância — usados pela busca "estilo Uber", pelo ranking de
// candidatos e pelas reservas do agente. O modelo do app ainda não tem
// coordenadas obrigatórias: quando o cadastro traz latitude/longitude usamos
// esse ponto; caso contrário caímos no centroide da cidade informada.

import { normalizeText, getCompanyCity } from './notas';

// Centroides (aproximados) — RS em detalhe + capitais/principais cidades do Brasil.
const CITY_COORDS = {
  // ── Rio Grande do Sul ──
  'porto alegre': [-30.0346, -51.2177],
  'pelotas': [-31.7654, -52.3376],
  'rio grande': [-32.0350, -52.0986],
  'gravatai': [-29.9413, -50.9928],
  'canoas': [-29.9177, -51.1839],
  'cachoeirinha': [-29.9508, -51.0939],
  'viamao': [-30.0811, -51.0233],
  'alvorada': [-29.9894, -51.0833],
  'sao leopoldo': [-29.7600, -51.1470],
  'novo hamburgo': [-29.6783, -51.1306],
  'sapucaia do sul': [-29.8289, -51.1450],
  'esteio': [-29.8606, -51.1792],
  'guaiba': [-30.1139, -51.3250],
  'eldorado do sul': [-30.0842, -51.6161],
  'montenegro': [-29.6886, -51.4611],
  'triunfo': [-29.9394, -51.7189],
  'charqueadas': [-29.9572, -51.6253],
  'taquara': [-29.6506, -50.7806],
  'osorio': [-29.8878, -50.2697],
  'torres': [-29.3350, -49.7267],
  'tramandai': [-29.9853, -50.1336],
  'capao da canoa': [-29.7425, -50.0089],
  'camaqua': [-30.8528, -51.8122],
  'cachoeira do sul': [-30.0394, -52.8939],
  'santa maria': [-29.6842, -53.8069],
  'caxias do sul': [-29.1678, -51.1794],
  'bento goncalves': [-29.1662, -51.5165],
  'farroupilha': [-29.2239, -51.3419],
  'gramado': [-29.3788, -50.8737],
  'canela': [-29.3561, -50.8136],
  'passo fundo': [-28.2620, -52.4091],
  'bage': [-31.3314, -54.1069],
  'uruguaiana': [-29.7547, -57.0883],
  'santana do livramento': [-30.8908, -55.5328],
  'alegrete': [-29.7833, -55.7919],
  'santa cruz do sul': [-29.7184, -52.4259],
  'lajeado': [-29.4669, -51.9611],
  'erechim': [-27.6339, -52.2739],
  'ijui': [-28.3878, -53.9147],
  'santo angelo': [-28.2992, -54.2631],
  'cruz alta': [-28.6386, -53.6064],
  'sao gabriel': [-30.3364, -54.3197],
  'sao borja': [-28.6606, -56.0044],
  'dom pedrito': [-30.9806, -54.6742],
  'rosario do sul': [-30.2542, -54.9147],
  'santiago': [-29.1917, -54.8672],
  'encantado': [-29.2347, -51.8697],
  'estrela': [-29.5003, -51.9664],
  'teutonia': [-29.4483, -51.8075],
  'venancio aires': [-29.6064, -52.1919],
  'vera cruz': [-29.7172, -52.5061],
  'candelaria': [-29.6694, -52.7889],
  'arroio do meio': [-29.4014, -51.9450],
  'cangucu': [-31.3944, -52.6783],
  'piratini': [-31.4428, -53.1044],
  'pinheiro machado': [-31.5792, -53.3822],
  'herval': [-32.0239, -53.3950],
  'jaguarao': [-32.5658, -53.3758],
  'chui': [-33.6911, -53.4550],
  'santa vitoria do palmar': [-33.5189, -53.3681],
  'arroio grande': [-32.2383, -53.0867],
  'tavares': [-31.2867, -51.0936],
  'mostardas': [-31.1069, -50.9208],
  'palmares do sul': [-30.2589, -50.5092],
  'tapes': [-30.6739, -51.3969],
  'arambare': [-30.9169, -51.4983],
  'cristal': [-31.0042, -52.0458],
  'morro redondo': [-31.5881, -52.6344],
  'barra do ribeiro': [-30.2911, -51.3011],
  'taquari': [-29.8006, -51.8611],
  'bom retiro do sul': [-29.6089, -51.9436],
  'igarassama': [-29.9769, -51.9103],
  'general camara': [-29.9039, -51.7628],
  'nova santa rita': [-29.8547, -51.2764],
  'sapiranga': [-29.6381, -51.0064],
  'parobe': [-29.6286, -50.8336],
  'igarata': [-29.5769, -50.7989],
  'rolante': [-29.6494, -50.5758],
  'santo antonio da patrulha': [-29.8186, -50.5200],
  'caraa': [-29.7903, -50.4364],
  'maquine': [-29.6758, -50.2072],
  'xangri-la': [-29.8064, -50.0422],

  // ── Santa Catarina ──
  'florianopolis': [-27.5954, -48.5480],
  'joinville': [-26.3045, -48.8487],
  'blumenau': [-26.9194, -49.0661],
  'chapeco': [-27.1004, -52.6152],
  'criciuma': [-28.6775, -49.3697],
  'tubarao': [-28.4669, -49.0070],
  'lages': [-27.8159, -50.3260],
  'balneario camboriu': [-26.9906, -48.6350],
  'itajai': [-26.9078, -48.6619],

  // ── Paraná / Sudeste / demais capitais ──
  'curitiba': [-25.4284, -49.2733],
  'londrina': [-23.3103, -51.1628],
  'maringa': [-23.4205, -51.9331],
  'sao paulo': [-23.5505, -46.6333],
  'rio de janeiro': [-22.9068, -43.1729],
  'belo horizonte': [-19.9167, -43.9345],
  'vitoria': [-20.3155, -40.3128],
  'brasilia': [-15.7939, -47.8828],
  'goiania': [-16.6869, -49.2648],
  'campo grande': [-20.4697, -54.6201],
  'cuiaba': [-15.6014, -56.0979],
  'salvador': [-12.9777, -38.5016],
  'recife': [-8.0476, -34.8770],
  'fortaleza': [-3.7319, -38.5267],
  'natal': [-5.7945, -35.2110],
  'joao pessoa': [-7.1195, -34.8450],
  'maceio': [-9.6658, -35.7353],
  'aracaju': [-10.9472, -37.0731],
  'teresina': [-5.0892, -42.8019],
  'sao luis': [-2.5297, -44.3028],
  'belem': [-1.4558, -48.5039],
  'manaus': [-3.1190, -60.0217],
  'palmas': [-10.1840, -48.3336],
  'porto velho': [-8.7608, -63.8999],
  'rio branco': [-9.9754, -67.8249],
  'macapa': [0.0349, -51.0694],
  'boa vista': [2.8235, -60.6758],
};

// Chave estável de cidade: sem acento, sem "/UF", sem parênteses.
function cityKey(raw) {
  let s = normalizeText(raw);
  s = s.replace(/\(.*?\)/g, ' ');
  s = s.replace(/[\/-]\s*[a-z]{2}\s*$/, ' ');   // remove sufixo de UF ("pelotas/rs")
  s = s.replace(/[^a-z\s]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

// Coordenadas a partir do texto de cidade ("Pelotas/RS", "Gravataí", "Porto Alegre - RS").
export function coordsDeCidade(raw) {
  const key = cityKey(raw);
  if (!key) return null;
  if (CITY_COORDS[key]) return { lat: CITY_COORDS[key][0], lng: CITY_COORDS[key][1] };
  // Tenta casar por contenção (ex.: "pelotas" dentro de uma string maior).
  for (const k of Object.keys(CITY_COORDS)) {
    if (key.includes(k) || k.includes(key)) {
      return { lat: CITY_COORDS[k][0], lng: CITY_COORDS[k][1] };
    }
  }
  return null;
}

// Ponto de um ajudante: lat/lng cadastrados ou centroide da cidade.
export function coordsFuncionario(f) {
  const lat = Number(f?.latitude ?? f?.lat);
  const lng = Number(f?.longitude ?? f?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng, exata: true };
  }
  const c = coordsDeCidade(f?.cidade);
  return c ? { ...c, exata: false } : null;
}

// Ponto da empresa: lat/lng cadastrados ou cidade extraída do endereço/localização.
export function coordsEmpresa(e) {
  const lat = Number(e?.latitude ?? e?.lat);
  const lng = Number(e?.longitude ?? e?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng, exata: true };
  }
  const city = e?.city || getCompanyCity({ address: e?.endereco ?? e?.address, location: e?.localizacao ?? e?.location });
  const c = coordsDeCidade(city);
  return c ? { ...c, exata: false } : null;
}

// Distância em km entre dois pontos {lat,lng}.
export function haversine(a, b) {
  if (!a || !b) return null;
  const R = 6371; // raio da Terra (km)
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Distância direta entre dois pontos geográficos (ou null se algum não resolver).
export function distanciaKm(pontoA, pontoB) {
  const km = haversine(pontoA, pontoB);
  return km == null ? null : Math.round(km * 10) / 10;
}

export function fmtDistancia(km) {
  if (km == null) return '—';
  if (km < 1) return 'menos de 1 km';
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

// Rótulo de distância para a lista: km exato quando há coordenada cadastrada;
// rótulo de proximidade (mesma cidade / mesma UF / outra cidade) quando a
// posição é aproximada pela cidade.
export function rotuloDistancia(km, exata, proximidadeLabel) {
  if (exata) return fmtDistancia(km);
  return proximidadeLabel || '—';
}

// Ponto médio (para centralizar o mapa entre empresa e candidatos).
export function centroide(pontos) {
  const validos = pontos.filter(Boolean);
  if (!validos.length) return null;
  const lat = validos.reduce((s, p) => s + p.lat, 0) / validos.length;
  const lng = validos.reduce((s, p) => s + p.lng, 0) / validos.length;
  return { lat, lng };
}

// Deslocamento determinístico e pequeno (~0,7 a 3 km) em torno do centroide da
// cidade — só para separar visualmente no mapa ajudantes que compartilham a
// mesma cidade quando não há coordenada exata cadastrada. Não altera a
// distância usada no ranking.
export function jitterCoords(coords, seed) {
  if (!coords) return null;
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const ang  = ((h % 360) * Math.PI) / 180;
  const raio = 0.006 + ((h % 97) / 97) * 0.022;
  return { lat: coords.lat + raio * Math.cos(ang), lng: coords.lng + raio * Math.sin(ang) };
}
