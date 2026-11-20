import { useCallback, useEffect, useState } from 'react';
import { Users, Shield, Star, MapPin } from 'lucide-react';
import { fetchConvocacoesByEscala, subscribeConvocacoes } from '../../lib/db';
import { fmtDistancia } from '../../lib/geo';
import { fmtNota } from '../../lib/notas';

// Rótulos e cores por status da convocação.
export const CONV_STATUS = {
  pendente:     { label: 'Pendente',     color: '#B45309', bg: '#FEF3C7' },
  enviada:      { label: 'Aguardando',   color: '#B45309', bg: '#FEF3C7' },
  confirmado:   { label: 'Confirmado',   color: '#047857', bg: '#D1FAE5' },
  recusado:     { label: 'Recusou',      color: '#B91C1C', bg: '#FEE2E2' },
  sem_resposta: { label: 'Sem resposta', color: '#6B7280', bg: '#F3F4F6' },
  reserva:      { label: 'Reserva',      color: '#6B7280', bg: '#F3F4F6' },
  acionada:     { label: 'Acionada',     color: '#B45309', bg: '#FEF3C7' },
  falta:        { label: 'Falta',        color: '#B91C1C', bg: '#FEE2E2' },
  cancelada:    { label: 'Cancelada',    color: '#9CA3AF', bg: '#F3F4F6' },
};

export function ConvocacaoBadge({ status }) {
  const cfg = CONV_STATUS[status] || CONV_STATUS.pendente;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

// Carrega as convocações de uma escala e mantém atualizadas via realtime.
export function useConvocacoes(escalaId) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!escalaId) { setList([]); setLoading(false); return; }
    fetchConvocacoesByEscala(escalaId).then(l => { setList(l); setLoading(false); });
  }, [escalaId]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    if (!escalaId) return undefined;
    return subscribeConvocacoes(escalaId, () => load());
  }, [escalaId, load]);

  return { list, loading, reload: load };
}

// Painel de convocação: vagas, contadores e a lista com status ao vivo.
export default function ConvocacaoStatus({ escalaId, vagas, compact = false, onResumo }) {
  const { list, loading } = useConvocacoes(escalaId);

  const titulares  = list.filter(c => c.papel === 'titular');
  const reservas   = list.filter(c => c.papel === 'reserva');
  const confirmados = list.filter(c => c.status === 'confirmado').length;
  const pendentes   = list.filter(c => ['pendente', 'enviada'].includes(c.status)).length;
  const nVagas      = vagas ?? titulares.length;

  useEffect(() => {
    onResumo?.({ total: list.length, confirmados, pendentes, vagas: nVagas });
  }, [list.length, confirmados, pendentes, nVagas]);

  if (loading) {
    return <p style={{ fontSize: '12px', color: '#94A3B8', padding: '10px 0' }}>Carregando convocações…</p>;
  }
  if (!list.length) {
    return (
      <div style={{ textAlign: 'center', padding: compact ? '14px 0' : '26px 0' }}>
        <Users size={22} style={{ color: '#CBD5E1', margin: '0 auto 6px' }} />
        <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhuma convocação registrada nesta escala.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Contadores */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { label: 'Vagas',       value: nVagas,      color: '#0F172A' },
          { label: 'Confirmados', value: confirmados, color: confirmados >= nVagas ? '#047857' : '#0F172A' },
          { label: 'Pendentes',   value: pendentes,   color: '#B45309' },
          { label: 'Reservas',    value: reservas.length, color: '#6B7280' },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, minWidth: '62px', padding: '7px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</p>
            <p style={{ fontSize: '17px', fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {list.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '9px', background: c.papel === 'reserva' ? '#FAFAFA' : '#EEF2F7' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: c.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {c.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>{c.name}</p>
                {c.papel === 'reserva' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '9px', fontWeight: 700, color: '#6B7280', background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>
                    <Shield size={8} /> reserva
                  </span>
                )}
                {c.ordem ? <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 700 }}>{c.ordem}º</span> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}>
                  <MapPin size={9} /> {fmtDistancia(c.distanciaKm)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}>
                  <Star size={9} /> {c.notaSnapshot == null ? 'sem nota' : fmtNota(c.notaSnapshot)}
                </span>
              </div>
            </div>
            <ConvocacaoBadge status={c.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
