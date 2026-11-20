import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { coordsDaCidade, normalizeText } from '../../lib/cidades';
import { geocodificarEndereco } from '../../lib/geocoding';

const PIN_ICON = L.divIcon({
  className: 'farilog-pin',
  html: '<div style="width:26px;height:26px;border-radius:50%;background:#BC4A2A;'
      + 'border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function numero(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function CliqueNoMapa({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Recentraliza quando o admin pede (busca por endereço/troca de cidade), sem
// puxar o mapa a cada arrasto do pino.
function MapaController({ lat, lng, zoom, foco }) {
  const map = useMap();

  useEffect(() => {
    if (lat == null || lng == null) return;
    map.setView([lat, lng], zoom, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco]);

  return null;
}

function AjustarTamanho() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function SeletorLocalizacao({
  latitude,
  longitude,
  cidade,
  endereco,
  bairro,
  cep,
  onChange,
}) {
  const latProp = numero(latitude);
  const lngProp = numero(longitude);
  const [ponto, setPonto] = useState({ lat: latProp, lng: lngProp });
  const [buscando, setBuscando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('info');
  const [foco, setFoco] = useState(0);

  useEffect(() => {
    setPonto({ lat: latProp, lng: lngProp });
  }, [latProp, lngProp]);

  const centroCidade = useMemo(() => coordsDaCidade(cidade), [cidade]);
  const alvo = ponto.lat != null && ponto.lng != null
    ? ponto
    : centroCidade || { lat: -29.95, lng: -51.09 };

  const temPonto = ponto.lat != null && ponto.lng != null;
  const podeBuscar = !!String(cidade ?? '').trim() &&
    !!(String(endereco ?? '').trim() || String(bairro ?? '').trim());

  useEffect(() => {
    if (ponto.lat == null) setFoco(f => f + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidade]);

  const aplicar = (lat, lng, focar = false) => {
    setPonto({ lat, lng });
    onChange?.(lat, lng);
    if (focar) setFoco(f => f + 1);
    setMensagem('');
  };

  const limpar = () => {
    setPonto({ lat: null, lng: null });
    onChange?.(null, null);
    setMensagem('');
    setFoco(f => f + 1);
  };

  const buscar = async () => {
    if (!podeBuscar || buscando) return;
    setBuscando(true);
    setMensagem('');
    const resultado = await geocodificarEndereco({ endereco, bairro, cidade, cep });
    setBuscando(false);

    if (!resultado) {
      setTipoMensagem('warn');
      setMensagem('Não encontrei o endereço. Clique no mapa ou arraste o pino até o local exato.');
      return;
    }

    aplicar(resultado.lat, resultado.lng, true);
    const outraCidade = resultado.city && cidade &&
      normalizeText(resultado.city) !== normalizeText(cidade);

    if (outraCidade) {
      setTipoMensagem('warn');
      setMensagem(`O mapa encontrou ${resultado.city}. Confirme se o pino está no endereço certo.`);
    } else if (resultado.aproximado) {
      setTipoMensagem('warn');
      setMensagem(`Localização aproximada (${resultado.label}). Ajuste o pino no mapa.`);
    } else {
      setTipoMensagem('ok');
      setMensagem(`Encontrado: ${resultado.label}. Ajuste o pino se precisar.`);
    }
  };

  const statusCor = tipoMensagem === 'ok' ? '#0B0B0B' : tipoMensagem === 'warn' ? '#9E3D22' : '#6B6B6B';
  const StatusIcon = tipoMensagem === 'ok' ? CheckCircle2 : tipoMensagem === 'warn' ? AlertTriangle : MapPin;

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '7px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 800, color: '#0B0B0B' }}>
          <MapPin size={12} style={{ color: '#BC4A2A' }} /> Localização exata
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={buscar}
            disabled={!podeBuscar || buscando}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 10px', borderRadius: '8px', border: '1px solid #E4E4E4',
              background: '#fff', color: podeBuscar ? '#0B0B0B' : '#9A9A9A',
              fontSize: '11px', fontWeight: 700, cursor: podeBuscar && !buscando ? 'pointer' : 'not-allowed',
              opacity: podeBuscar ? 1 : 0.6,
            }}
          >
            {buscando ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            {buscando ? 'Buscando...' : 'Buscar coordenadas'}
          </button>
          {temPonto && (
            <button
              type="button"
              onClick={limpar}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '6px 9px', borderRadius: '8px', border: '1px solid #E4E4E4',
                background: '#fff', color: '#6B6B6B', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>
      </div>

      <div className="map-shell" style={{ height: '240px', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
        <MapContainer
          center={[alvo.lat, alvo.lng]}
          zoom={temPonto ? 16 : 13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
          <CliqueNoMapa onPick={(lat, lng) => aplicar(lat, lng)} />
          {temPonto && (
            <Marker
              position={[ponto.lat, ponto.lng]}
              icon={PIN_ICON}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  aplicar(lat, lng);
                },
              }}
            />
          )}
          <MapaController lat={alvo.lat} lng={alvo.lng} zoom={temPonto ? 16 : 13} foco={foco} />
          <AjustarTamanho />
        </MapContainer>
      </div>

      <p style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '10.5px', lineHeight: 1.5, marginTop: '6px', color: statusCor, fontWeight: 600 }}>
        <StatusIcon size={11} style={{ flexShrink: 0, marginTop: '1px' }} />
        {mensagem || (temPonto
          ? `Pino definido em ${ponto.lat.toFixed(5)}, ${ponto.lng.toFixed(5)}.`
          : 'Clique no mapa ou arraste o pino até o endereço. Sem pino, a busca usa o centro da cidade.')}
      </p>
    </div>
  );
}