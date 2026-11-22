// Geocodificação assistiva para o cadastro do ajudante.
//
// O app não tem backend. Usamos o Photon (OpenStreetMap/Komoot), que libera
// CORS no navegador e não exige chave. O resultado é uma AJUDA: o pino no mapa
// continua sendo a fonte de verdade e deve ser ajustado pelo admin.
//
// Importante: links curtos do Google Maps (maps.app.goo.gl) não são resolvidos
// pelo navegador. Para coordenadas exatas, use o pino do mapa ou cole a URL
// completa do Maps (com "@latitude,longitude") / o par "latitude,longitude".

import { coordsDaCidade, coordsDeLink } from './cidades.js';

const cache = new Map();

function limpar(value) {
  return String(value ?? '').trim();
}

export function comporEndereco(dados = {}) {
  const rua = limpar(dados.endereco ?? dados.address);
  const bairro = limpar(dados.bairro ?? dados.neighborhood);
  const cidade = limpar(dados.cidade ?? dados.city);
  const cep = limpar(dados.cep ?? dados.zip);
  return [rua, bairro, cidade, cep, 'Brasil'].filter(Boolean).join(', ');
}

async function consultarPhoton(query, centro) {
  const params = new URLSearchParams({ q: query, limit: '1' });
  if (centro) {
    params.set('lat', String(centro.lat));
    params.set('lon', String(centro.lng));
  }

  try {
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const feature = json?.features?.[0];
    if (!feature) return null;

    const [lngRaw, latRaw] = feature.geometry?.coordinates || [];
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const props = feature.properties || {};
    if (props.countrycode && props.countrycode !== 'BR') return null;

    return {
      lat,
      lng,
      label: [props.name, props.district, props.city, props.state].filter(Boolean).join(', '),
      city: props.city || null,
      state: props.state || null,
      postcode: props.postcode || null,
    };
  } catch {
    return null;
  }
}

// Busca o endereço completo e, se não achar, cai para bairro e cidade.
// `aproximado` indica que o ponto veio de um nível mais amplo.
export async function geocodificarEndereco(dados = {}) {
  const cidade = limpar(dados.cidade ?? dados.city);
  if (!cidade) return null;

  const completa = comporEndereco(dados);
  if (cache.has(completa)) return cache.get(completa);

  const bairro = limpar(dados.bairro ?? dados.neighborhood);
  const tentativas = [{ query: completa, aproximado: false }];
  if (bairro) tentativas.push({ query: [bairro, cidade, 'Brasil'].join(', '), aproximado: true });
  tentativas.push({ query: [cidade, 'Brasil'].join(', '), aproximado: true });

  const centro = coordsDaCidade(cidade);

  for (const tentativa of tentativas) {
    const encontrado = await consultarPhoton(tentativa.query, centro);
    if (!encontrado) continue;
    const resultado = { ...encontrado, aproximado: tentativa.aproximado, query: tentativa.query };
    cache.set(completa, resultado);
    return resultado;
  }

  cache.set(completa, null);
  return null;
}

// Reverso: das coordenadas para o endereço (rua/número, bairro, CEP).
// Usado ao extrair a localização do link do Maps, para já preencher o
// endereço residencial do ajudante.
export async function reverseGeocode(lat, lng) {
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return null;

  const chave = `rev:${latN.toFixed(5)},${lngN.toFixed(5)}`;
  if (cache.has(chave)) return cache.get(chave);

  try {
    const params = new URLSearchParams({ lat: String(latN), lon: String(lngN), limit: '1' });
    const res = await fetch(`https://photon.komoot.io/reverse?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) { cache.set(chave, null); return null; }

    const json = await res.json();
    const props = json?.features?.[0]?.properties || {};
    if (props.countrycode && props.countrycode !== 'BR') { cache.set(chave, null); return null; }

    // Em resultado de rua o nome vem em `name`; em resultado de casa vem em
    // `street`, com o número em `housenumber`. Se `name` for só número, ele é
    // o número, não o logradouro.
    const nome = String(props.name || '').trim();
    const ehNumero = /^\d+\w?$/.test(nome);
    const logradouro = props.street || (ehNumero ? '' : nome);
    const numero = props.housenumber || (ehNumero ? nome : '');

    const resultado = {
      endereco: [logradouro, numero].filter(Boolean).join(', ') || null,
      bairro:   props.district || props.suburb || props.locality || null,
      cidade:   props.city || props.town || props.village || null,
      cep:      props.postcode || null,
      label:    [logradouro, numero, props.district, props.city, props.state].filter(Boolean).join(', '),
    };
    cache.set(chave, resultado);
    return resultado;
  } catch {
    cache.set(chave, null);
    return null;
  }
}

// Coordenadas de um link completo do Maps ou de um par "lat,lng".
export function coordenadasDoLink(value) {
  return coordsDeLink(value);
}