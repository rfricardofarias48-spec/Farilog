// Geolocalização e distância — usados pela busca "estilo Uber", pelo ranking de
// candidatos e pelas reservas da escala. O modelo do app ainda não tem
// coordenadas obrigatórias: quando o cadastro traz latitude/longitude usamos
// esse ponto; quando o link do Google Maps traz coordenadas, usamos o ponto do
// link; caso contrário caímos no centroide da cidade lida do endereço.

import { coordsDaCidade, coordsDeLink, parseEmpresaLocalizacao } from './cidades.js';

// Mantém o nome antigo usado pelo restante do app.
export const coordsDeCidade = coordsDaCidade;

function coordenadaValida(latRaw, lngRaw) {
  if (latRaw === null || latRaw === undefined || latRaw === '') return false;
  if (lngRaw === null || lngRaw === undefined || lngRaw === '') return false;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

// Ponto de um ajudante: lat/lng cadastrados, coordenada do link do Maps ou
// centroide da cidade/endereço.
export function coordsFuncionario(f) {
  const latRaw = f?.latitude ?? f?.lat;
  const lngRaw = f?.longitude ?? f?.lng;
  if (coordenadaValida(latRaw, lngRaw)) {
    return { lat: Number(latRaw), lng: Number(lngRaw), exata: true, fonte: 'cadastro' };
  }

  const link = coordsDeLink(f?.localizacao || f?.location);
  if (link) return { ...link, exata: true, fonte: 'link' };

  const c = coordsDaCidade(f?.cidade || f?.city || f?.endereco || f?.address);
  return c ? { ...c, exata: false, fonte: 'cidade' } : null;
}

// Ponto da empresa: lat/lng cadastrados, coordenada do link do mapa ou
// centroide da cidade extraída do endereço/localização.
export function coordsEmpresa(e) {
  const latRaw = e?.latitude ?? e?.lat;
  const lngRaw = e?.longitude ?? e?.lng;
  if (coordenadaValida(latRaw, lngRaw)) {
    return { lat: Number(latRaw), lng: Number(lngRaw), exata: true, fonte: 'cadastro' };
  }

  const link = coordsDeLink(e?.localizacao || e?.location);
  if (link) return { ...link, exata: true, fonte: 'link' };

  const local = parseEmpresaLocalizacao(e);
  const c = coordsDaCidade(local.display || local.city || e?.city);
  return c ? { ...c, exata: false, fonte: 'cidade' } : null;
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
// rótulo de proximidade (mesma cidade / cidade vizinha / mesma UF / outra
// cidade) quando a posição é aproximada pela cidade.
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