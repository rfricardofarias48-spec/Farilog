import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fmtNota } from '../../lib/notas';
import { fmtDistancia } from '../../lib/geo';

// Pino da empresa (sede da operação).
const EMPRESA_ICON = L.divIcon({
  className: 'farilog-pin',
  html: '<div style="width:34px;height:34px;border-radius:50%;background:#0B0B0B;border:2px solid #fff;'
      + 'box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:16px">🏭</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// Pino do ajudante (iniciais). Laranja quando é o foco.
function pontoIcon(initials, { destaque = false } = {}) {
  const bg = destaque ? '#FF4D0C' : '#1C1C1C';
  return L.divIcon({
    className: 'farilog-pin',
    html: `<div style="width:28px;height:28px;border-radius:8px;background:${bg};border:2px solid #fff;`
        + `box-shadow:0 2px 8px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;`
        + `color:#fff;font-size:9px;font-weight:800;letter-spacing:.02em">${initials || '?'}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Reenquadra o mapa sempre que a lista de pontos muda (a busca cresce em tempo real).
function AjustarBounds({ centro, pontos, assinatura }) {
  const map = useMap();
  const pontoKey = pontos.map(p => p.id).join(',');
  useEffect(() => {
    const coords = pontos.filter(p => p.coords).map(p => [p.coords.lat, p.coords.lng]);
    if (centro) coords.push([centro.lat, centro.lng]);
    if (!coords.length) return;
    if (coords.length === 1) { map.setView(coords[0], 11, { animate: true }); return; }
    const bounds = L.latLngBounds(coords).pad(0.25);
    map.fitBounds(bounds, { animate: true, maxZoom: 12 });
  }, [map, pontoKey, centro?.lat, centro?.lng, assinatura]);
  return null;
}

export default function MapaAjudantes({
  empresa,               // { name, coords: { lat, lng } }
  pontos = [],           // [{ id, name, initials, coords, distanciaKm, media, destaque }]
  raioKm = null,
  altura = 260,
  interativo = true,
  mostrarRaio = true,
  assinatura = 0,
}) {
  const centro = empresa?.coords
    || pontos.find(p => p.coords)?.coords
    || { lat: -30.05, lng: -51.2 };

  return (
    <div className="map-shell" style={{ height: altura }}>
      <MapContainer
        center={[centro.lat, centro.lng]}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        zoomControl={interativo}
        scrollWheelZoom={interativo}
        dragging={interativo}
        doubleClickZoom={interativo}
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {mostrarRaio && raioKm && empresa?.coords && (
          <Circle
            center={[empresa.coords.lat, empresa.coords.lng]}
            radius={raioKm * 1000}
            pathOptions={{ color: '#0B0B0B', weight: 1, opacity: 0.25, fillColor: '#0B0B0B', fillOpacity: 0.04 }}
          />
        )}

        {empresa?.coords && (
          <Marker position={[empresa.coords.lat, empresa.coords.lng]} icon={EMPRESA_ICON}>
            <Popup>
              <strong>{empresa.name || 'Empresa'}</strong>
              {empresa.city ? <div style={{ fontSize: 11 }}>{empresa.city}</div> : null}
            </Popup>
          </Marker>
        )}

        {pontos.filter(p => p.coords).map(p => (
          <Marker key={p.id} position={[p.coords.lat, p.coords.lng]} icon={pontoIcon(p.initials, { destaque: p.destaque })}>
            <Popup>
              <strong>{p.name}</strong>
              <div style={{ fontSize: 11 }}>{p.cidade || '—'}</div>
              <div style={{ fontSize: 11 }}>
                {fmtDistancia(p.distanciaKm)}{p.media != null ? ` · ★ ${fmtNota(p.media)}` : ''}
              </div>
            </Popup>
          </Marker>
        ))}

        <AjustarBounds centro={empresa?.coords || null} pontos={pontos} assinatura={assinatura} />
      </MapContainer>
    </div>
  );
}
