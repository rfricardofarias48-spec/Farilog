// Base local de cidades + leitura tolerante de endereços e links de mapa.
//
// O app não tem backend de geocoding. Então centralizamos aqui o que dá para
// fazer localmente: nome canônico, UF, centroide e interpretação de endereços
// livres ("Rua X, 123 - Bairro, Cidade - UF, CEP"), links do Google Maps e
// bairros conhecidos da região de operação.
//
// Regra de ouro: um texto que não parece cidade (CEP, UF, rua, número) NÃO
// pode virar cidade. É melhor "Cidade não informada" do que "Outra cidade"
// para quem está na mesma cidade da empresa.

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordRegex(key) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(key)}([^a-z0-9]|$)`);
}

// [nome exibido, UF, latitude, longitude]
const CIDADES = [
  ['Porto Alegre', 'RS', -30.0346, -51.2177],
  ['Pelotas', 'RS', -31.7654, -52.3376],
  ['Rio Grande', 'RS', -32.0350, -52.0986],
  ['Gravataí', 'RS', -29.9413, -50.9928],
  ['Canoas', 'RS', -29.9177, -51.1839],
  ['Cachoeirinha', 'RS', -29.9508, -51.0939],
  ['Viamão', 'RS', -30.0811, -51.0233],
  ['Alvorada', 'RS', -29.9894, -51.0833],
  ['São Leopoldo', 'RS', -29.7600, -51.1470],
  ['Novo Hamburgo', 'RS', -29.6783, -51.1306],
  ['Sapucaia do Sul', 'RS', -29.8289, -51.1450],
  ['Esteio', 'RS', -29.8606, -51.1792],
  ['Guaíba', 'RS', -30.1139, -51.3250],
  ['Eldorado do Sul', 'RS', -30.0842, -51.6161],
  ['Montenegro', 'RS', -29.6886, -51.4611],
  ['Triunfo', 'RS', -29.9394, -51.7189],
  ['Charqueadas', 'RS', -29.9572, -51.6253],
  ['Taquara', 'RS', -29.6506, -50.7806],
  ['Osório', 'RS', -29.8878, -50.2697],
  ['Torres', 'RS', -29.3350, -49.7267],
  ['Tramandaí', 'RS', -29.9853, -50.1336],
  ['Capão da Canoa', 'RS', -29.7425, -50.0089],
  ['Camaquã', 'RS', -30.8528, -51.8122],
  ['Cachoeira do Sul', 'RS', -30.0394, -52.8939],
  ['Santa Maria', 'RS', -29.6842, -53.8069],
  ['Caxias do Sul', 'RS', -29.1678, -51.1794],
  ['Bento Gonçalves', 'RS', -29.1662, -51.5165],
  ['Farroupilha', 'RS', -29.2239, -51.3419],
  ['Gramado', 'RS', -29.3788, -50.8737],
  ['Canela', 'RS', -29.3561, -50.8136],
  ['Passo Fundo', 'RS', -28.2620, -52.4091],
  ['Bagé', 'RS', -31.3314, -54.1069],
  ['Uruguaiana', 'RS', -29.7547, -57.0883],
  ['Santana do Livramento', 'RS', -30.8908, -55.5328],
  ['Alegrete', 'RS', -29.7833, -55.7919],
  ['Santa Cruz do Sul', 'RS', -29.7184, -52.4259],
  ['Lajeado', 'RS', -29.4669, -51.9611],
  ['Erechim', 'RS', -27.6339, -52.2739],
  ['Ijuí', 'RS', -28.3878, -53.9147],
  ['Santo Ângelo', 'RS', -28.2992, -54.2631],
  ['Cruz Alta', 'RS', -28.6386, -53.6064],
  ['São Gabriel', 'RS', -30.3364, -54.3197],
  ['São Borja', 'RS', -28.6606, -56.0044],
  ['Dom Pedrito', 'RS', -30.9806, -54.6742],
  ['Rosário do Sul', 'RS', -30.2542, -54.9147],
  ['Santiago', 'RS', -29.1917, -54.8672],
  ['Encantado', 'RS', -29.2347, -51.8697],
  ['Estrela', 'RS', -29.5003, -51.9664],
  ['Teutônia', 'RS', -29.4483, -51.8075],
  ['Venâncio Aires', 'RS', -29.6064, -52.1919],
  ['Vera Cruz', 'RS', -29.7172, -52.5061],
  ['Candelária', 'RS', -29.6694, -52.7889],
  ['Arroio do Meio', 'RS', -29.4014, -51.9450],
  ['Canguçu', 'RS', -31.3944, -52.6783],
  ['Piratini', 'RS', -31.4428, -53.1044],
  ['Pinheiro Machado', 'RS', -31.5792, -53.3822],
  ['Herval', 'RS', -32.0239, -53.3950],
  ['Jaguarão', 'RS', -32.5658, -53.3758],
  ['Chuí', 'RS', -33.6911, -53.4550],
  ['Santa Vitória do Palmar', 'RS', -33.5189, -53.3681],
  ['Arroio Grande', 'RS', -32.2383, -53.0867],
  ['Tavares', 'RS', -31.2867, -51.0936],
  ['Mostardas', 'RS', -31.1069, -50.9208],
  ['Palmares do Sul', 'RS', -30.2589, -50.5092],
  ['Tapes', 'RS', -30.6739, -51.3969],
  ['Arambaré', 'RS', -30.9169, -51.4983],
  ['Cristal', 'RS', -31.0042, -52.0458],
  ['Morro Redondo', 'RS', -31.5881, -52.6344],
  ['Barra do Ribeiro', 'RS', -30.2911, -51.3011],
  ['Taquari', 'RS', -29.8006, -51.8611],
  ['Bom Retiro do Sul', 'RS', -29.6089, -51.9436],
  ['Igarassama', 'RS', -29.9769, -51.9103],
  ['General Câmara', 'RS', -29.9039, -51.7628],
  ['Nova Santa Rita', 'RS', -29.8547, -51.2764],
  ['Sapiranga', 'RS', -29.6381, -51.0064],
  ['Parobé', 'RS', -29.6286, -50.8336],
  ['Igarata', 'RS', -29.5769, -50.7989],
  ['Rolante', 'RS', -29.6494, -50.5758],
  ['Santo Antônio da Patrulha', 'RS', -29.8186, -50.5200],
  ['Caraá', 'RS', -29.7903, -50.4364],
  ['Maquiné', 'RS', -29.6758, -50.2072],
  ['Xangri-lá', 'RS', -29.8064, -50.0422],
  ['Estância Velha', 'RS', -29.6483, -51.1744],
  ['Portão', 'RS', -29.7014, -51.2422],
  ['Campo Bom', 'RS', -29.6783, -51.0536],
  ['Dois Irmãos', 'RS', -29.5803, -51.0883],
  ['Ivoti', 'RS', -29.5908, -51.1608],
  ['Nova Hartz', 'RS', -29.5828, -50.9058],
  ['Araricá', 'RS', -29.6153, -50.9258],
  ['Glorinha', 'RS', -29.8794, -50.7861],

  ['Florianópolis', 'SC', -27.5954, -48.5480],
  ['Joinville', 'SC', -26.3045, -48.8487],
  ['Blumenau', 'SC', -26.9194, -49.0661],
  ['Chapecó', 'SC', -27.1004, -52.6152],
  ['Criciúma', 'SC', -28.6775, -49.3697],
  ['Tubarão', 'SC', -28.4669, -49.0070],
  ['Lages', 'SC', -27.8159, -50.3260],
  ['Balneário Camboriú', 'SC', -26.9906, -48.6350],
  ['Itajaí', 'SC', -26.9078, -48.6619],

  ['Curitiba', 'PR', -25.4284, -49.2733],
  ['Londrina', 'PR', -23.3103, -51.1628],
  ['Maringá', 'PR', -23.4205, -51.9331],

  ['São Paulo', 'SP', -23.5505, -46.6333],
  ['Rio de Janeiro', 'RJ', -22.9068, -43.1729],
  ['Belo Horizonte', 'MG', -19.9167, -43.9345],
  ['Vitória', 'ES', -20.3155, -40.3128],
  ['Brasília', 'DF', -15.7939, -47.8828],
  ['Goiânia', 'GO', -16.6869, -49.2648],
  ['Campo Grande', 'MS', -20.4697, -54.6201],
  ['Cuiabá', 'MT', -15.6014, -56.0979],
  ['Salvador', 'BA', -12.9777, -38.5016],
  ['Recife', 'PE', -8.0476, -34.8770],
  ['Fortaleza', 'CE', -3.7319, -38.5267],
  ['Natal', 'RN', -5.7945, -35.2110],
  ['João Pessoa', 'PB', -7.1195, -34.8450],
  ['Maceió', 'AL', -9.6658, -35.7353],
  ['Aracaju', 'SE', -10.9472, -37.0731],
  ['Teresina', 'PI', -5.0892, -42.8019],
  ['São Luís', 'MA', -2.5297, -44.3028],
  ['Belém', 'PA', -1.4558, -48.5039],
  ['Manaus', 'AM', -3.1190, -60.0217],
  ['Palmas', 'TO', -10.1840, -48.3336],
  ['Porto Velho', 'RO', -8.7608, -63.8999],
  ['Rio Branco', 'AC', -9.9754, -67.8249],
  ['Macapá', 'AP', 0.0349, -51.0694],
  ['Boa Vista', 'RR', 2.8235, -60.6758],
];

const REGISTRY = [];
const BY_KEY = new Map();
for (const [name, uf, lat, lng] of CIDADES) {
  const key = normalizeText(name);
  if (!key) continue;
  const entry = { key, name, uf, lat, lng, re: wordRegex(key) };
  REGISTRY.push(entry);
  if (!BY_KEY.has(key)) BY_KEY.set(key, entry);
}
const KNOWN = [...REGISTRY].sort((a, b) => b.key.length - a.key.length);

// Bairros/regiões conhecidos da operação. Só entram aqui nomes que, sozinhos,
// apontam para uma cidade com segurança. Serve como último recurso quando o
// endereço não traz o nome da cidade (ex.: "Av. Plínio Kroeff, 1100. Porto Seco").
const ALIASES = {
  poa: 'porto alegre',
  'sao leo': 'sao leopoldo',
  gravatahy: 'gravatai',
  sapucaia: 'sapucaia do sul',
  'porto seco': 'cachoeirinha',
  'granja esperanca': 'cachoeirinha',
  'chacara das rosas': 'cachoeirinha',
  'parque das rosas': 'cachoeirinha',
};

const ALIAS_ENTRIES = Object.entries(ALIASES)
  .map(([alias, target]) => ({ alias, target: BY_KEY.get(target), re: wordRegex(alias) }))
  .filter(a => a.target)
  .sort((a, b) => b.alias.length - a.alias.length);

const UF_CODES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const STATE_NAMES = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};
const STATE_NAMES_LONGEST = Object.entries(STATE_NAMES).sort((a, b) => b[0].length - a[0].length);

const CEP_RE = /\b\d{5}[-.\s]?\d{3}\b/g;
const UF_RE_END = /[\/\-–—,]\s*([A-Za-z]{2})\s*$/;
const UF_RE_PAREN = /\(\s*([A-Za-z]{2})\s*\)\s*$/;

const CAMPOS_DE_ENDERECO = /^(rua|r\.?|avenida|av\.?|rodovia|rod\.?|estrada|estr\.?|travessa|trav\.?|alameda|al\.?|praça|praca|largo|beco|viela|br[-\s]?\d+|rs[-\s]?\d+|km|bairro|distrito|condomínio|condominio|cond\.?|loteamento|residencial)\b/i;
const NAO_E_CIDADE = /^(centro|bairro|distrito|industrial|jardim|parque|vila|chácara|chacara|residencial|condomínio|condominio|loteamento|rua|avenida|rodovia|estrada|travessa|alameda|praça|praca|largo|beco|viela|km|brasil|brazil|cidade|estado)$/i;

function vazio(uf = null, source = 'vazio') {
  return { city: '', uf, key: '', display: '', confidence: 0, source, coords: null };
}

function isUrl(value) {
  const s = String(value ?? '').trim();
  return /^https?:\/\//i.test(s) || /(^|\s)(www\.|maps\.)/i.test(s) || /google\.[a-z.]+\/maps/i.test(s);
}

function safeDecode(value) {
  try { return decodeURIComponent(String(value ?? '')); } catch { return String(value ?? ''); }
}

function extrairUF(raw) {
  let s = String(raw ?? '').trim();
  s = s.replace(CEP_RE, ' ').replace(/[.,;]+$/, '').trim();
  const m = s.match(UF_RE_END) || s.match(UF_RE_PAREN);
  if (m && UF_CODES.has(m[1].toUpperCase())) return m[1].toUpperCase();
  if (/^[A-Za-z]{2}$/.test(s) && UF_CODES.has(s.toUpperCase())) return s.toUpperCase();
  const norm = normalizeText(s);
  for (const [name, uf] of STATE_NAMES_LONGEST) {
    if (wordRegex(name).test(norm)) return uf;
  }
  return null;
}

function limparEndereco(raw) {
  let s = String(raw ?? '');
  s = s.replace(CEP_RE, ' ');
  s = s.replace(/\b(brasil|brazil)\b/gi, ' ');
  // Remove o nome completo do estado para "Rio Grande do Sul" não ser lido
  // como a cidade de Rio Grande.
  for (const [name] of STATE_NAMES_LONGEST) {
    s = s.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi'), ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

function detectarCidadeConhecida(text) {
  const norm = normalizeText(text);
  if (!norm) return null;
  for (const c of KNOWN) {
    if (c.re.test(norm)) return c;
  }
  return null;
}

function detectarAlias(text) {
  const norm = normalizeText(text);
  if (!norm) return null;
  for (const a of ALIAS_ENTRIES) {
    if (a.re.test(norm)) return a.target;
  }
  return null;
}

function capitalizar(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/(^|[\s('\-.–])([a-zà-ú])/g, (m, sep, ch) => sep + ch.toUpperCase());
}

function extrairCidadeHeuristica(text) {
  const partes = String(text ?? '')
    .split(/[,;|/]|\s+[-–—]\s+/)
    .map(p => p.trim())
    .filter(Boolean);

  const candidatos = [];
  for (let parte of partes) {
    // "n° 142", "1100. Porto Seco" -> "Porto Seco"
    parte = parte.replace(/^(?:n[ºo°.]?\s*)?\d+\s*[.\-–]?\s*/i, '').trim();
    parte = parte.replace(/[.,;]+$/, '').trim();

    if (!parte || parte.length < 3) continue;
    if (!/[a-zà-ú]/i.test(parte)) continue;
    if (/\d/.test(parte)) continue;
    if (CAMPOS_DE_ENDERECO.test(parte)) continue;
    if (NAO_E_CIDADE.test(parte)) continue;
    if (parte.length === 2 && UF_CODES.has(parte.toUpperCase())) continue;
    candidatos.push(parte);
  }

  if (!candidatos.length) return '';
  return capitalizar(candidatos[candidatos.length - 1]);
}

function parseCidadeTexto(raw, source = 'texto', opcoes = {}) {
  const { heuristica = true } = opcoes;
  const original = String(raw ?? '').trim();
  if (!original) return vazio(null, source);

  const uf = extrairUF(original);
  const limpo = limparEndereco(original);

  const conhecida = detectarCidadeConhecida(limpo);
  if (conhecida) {
    return {
      city: conhecida.name,
      uf: conhecida.uf || uf,
      key: conhecida.key,
      display: conhecida.name,
      confidence: 0.95,
      source,
      coords: null,
    };
  }

  const alias = detectarAlias(limpo);
  if (alias) {
    return {
      city: alias.name,
      uf: alias.uf || uf,
      key: alias.key,
      display: alias.name,
      confidence: 0.8,
      source,
      coords: null,
    };
  }

  if (heuristica) {
    const heur = extrairCidadeHeuristica(limpo);
    if (heur) {
      return {
        city: heur,
        uf,
        key: normalizeText(heur),
        display: heur,
        confidence: 0.5,
        source,
        coords: null,
      };
    }
  }

  return vazio(uf, source);
}

// Coordenadas presentes em links do Google Maps (link completo) ou texto solto.
export function coordsDeLink(raw) {
  const s = String(raw ?? '');
  const padroes = [
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:ll|sll|q|query|center|destination)=(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i,
    /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/,
  ];
  for (const re of padroes) {
    const m = s.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    if (lat === 0 && lng === 0) continue;
    return { lat, lng };
  }
  return null;
}

function parseCidadeDeUrl(raw) {
  const texto = safeDecode(raw).replace(/\+/g, ' ');
  const coords = coordsDeLink(texto);

  const candidatos = [];
  const place = texto.match(/\/maps\/place\/([^/@?]+)/i)?.[1];
  if (place) candidatos.push(place);
  const search = texto.match(/\/maps\/search\/([^/@?]+)/i)?.[1];
  if (search) candidatos.push(search);

  try {
    const url = new URL(raw);
    for (const key of ['q', 'query', 'destination', 'place', 'address', 'daddr']) {
      const value = url.searchParams.get(key);
      if (value) candidatos.push(value);
    }
  } catch {
    // links curtos e formatos não padrão seguem só com o texto
  }

  for (const candidato of candidatos) {
    const p = parseCidadeTexto(candidato, 'link', { heuristica: false });
    if (p.city) return { ...p, coords: coords || null };
  }

  // Nome de cidade pode aparecer no meio do link (ex.: .../Cachoeirinha/...).
  const conhecida = detectarCidadeConhecida(texto);
  if (conhecida) {
    return {
      city: conhecida.name,
      uf: conhecida.uf,
      key: conhecida.key,
      display: conhecida.name,
      confidence: 0.85,
      source: 'link',
      coords: coords || null,
    };
  }

  return coords
    ? { ...vazio(null, 'link'), coords }
    : vazio(null, 'link');
}

// Interpreta cidade/UF/endereço/link e devolve a melhor leitura disponível.
export function parseCidade(raw) {
  const original = String(raw ?? '').trim();
  if (!original) return vazio();

  if (isUrl(original)) return parseCidadeDeUrl(original);

  // "(Pelotas)" é comum no endereço livre da empresa.
  const paren = original.match(/\(([^)]+)\)/);
  if (paren) {
    const p = parseCidadeTexto(paren[1], 'parenteses');
    if (p.city) return p;
  }

  return parseCidadeTexto(original, 'texto');
}

// Dados da empresa -> cidade confiável + possível coordenada de link.
// Ordem: campo cidade (se existir) -> link/localização -> endereço.
export function parseEmpresaLocalizacao(company) {
  let coords = null;

  const explicita = company?.cidade || company?.city;
  if (explicita) {
    const p = parseCidade(explicita);
    if (p.city) return { ...p, source: 'cadastro' };
    if (p.coords) coords = p.coords;
  }

  const localizacao = company?.localizacao ?? company?.location;
  if (localizacao) {
    const p = parseCidade(localizacao);
    if (p.city) return { ...p, source: 'localizacao' };
    if (p.coords) coords = coords || p.coords;
  }

  const endereco = company?.endereco ?? company?.address;
  if (endereco) {
    const p = parseCidade(endereco);
    if (p.city) return { ...p, source: 'endereco' };
    if (p.coords) coords = coords || p.coords;
  }

  if (coords) {
    // Link completo do Maps sem endereço: usa a cidade conhecida mais próxima
    // só como rótulo. A distância continua sendo calculada pelas coordenadas.
    const near = cidadeMaisProxima(coords, 30);
    if (near) {
      return {
        city: near.name,
        uf: near.uf,
        key: near.key,
        display: near.name,
        confidence: 0.7,
        source: 'coordenadas',
        coords,
      };
    }
    return { ...vazio(null, 'coordenadas'), coords };
  }
  return vazio();
}

export function getCompanyCity(company) {
  return parseEmpresaLocalizacao(company).display || '';
}

// Grava/exibe sempre a mesma forma ("Cachoeirinha", "Gravataí"), mas nunca
// inventa cidade quando o texto é inválido.
export function normalizarCidade(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const p = parseCidade(raw);
  return p.display || raw;
}

// Centroide da cidade, se o texto apontar para uma cidade conhecida.
export function coordsDaCidade(raw) {
  const p = parseCidade(raw);
  let c = p.key ? BY_KEY.get(p.key) : null;
  if (!c && p.city) c = BY_KEY.get(normalizeText(p.city));
  if (!c) {
    const norm = normalizeText(raw);
    if (norm) {
      for (const candidata of KNOWN) {
        if (candidata.re.test(norm)) { c = candidata; break; }
      }
    }
  }
  return c ? { lat: c.lat, lng: c.lng, cidade: c.name, uf: c.uf } : null;
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanciaEntrePontos(a, b) {
  const km = haversineKm(a, b);
  return km == null ? null : Math.round(km * 10) / 10;
}

export function distanciaEntreCidades(keyA, keyB) {
  const a = BY_KEY.get(keyA);
  const b = BY_KEY.get(keyB);
  return a && b ? distanciaEntrePontos(a, b) : null;
}

// Cidade conhecida mais próxima de um ponto (para quando só existe lat/lng).
export function cidadeMaisProxima(ponto, maxKm = 30) {
  const lat = Number(ponto?.lat);
  const lng = Number(ponto?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let melhor = null;
  for (const c of REGISTRY) {
    const km = haversineKm({ lat, lng }, c);
    if (km == null) continue;
    if (!melhor || km < melhor.km) melhor = { ...c, km: Math.round(km * 10) / 10 };
  }
  if (!melhor || melhor.km > maxKm) return null;
  return melhor;
}

export const CIDADES_CONHECIDAS = REGISTRY
  .map(c => c.name)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));