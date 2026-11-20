import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, CheckCircle2, XCircle, Clock, MapPin, Star, Shield, RefreshCw, Info, Send,
} from 'lucide-react';
import {
  fetchConvocacoesAgente, subscribeConvocacoes,
  aceitarConvocacao, recusarConvocacao, marcarSemResposta,
} from '../../lib/db';
import { ConvocacaoBadge } from '../../components/shared/ConvocacaoStatus';
import { fmtDistancia } from '../../lib/geo';
import { fmtNota } from '../../lib/notas';
import WhatsAppButton from '../../components/shared/WhatsAppButton';

const FILTROS = [
  { id: 'fila',       label: 'Fila do agente', statuses: ['pendente', 'enviada'] },
  { id: 'confirmado', label: 'Confirmados',    statuses: ['confirmado', 'falta'] },
  { id: 'reserva',    label: 'Reservas',       statuses: ['reserva', 'acionada'] },
  { id: 'todas',      label: 'Todas',          statuses: null },
];

const fmtDia = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dow = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
};

// Texto do convite (mesmo formato documentado em supabase/agente-whatsapp.md).
function textoConvite(c) {
  const primeiro = String(c.name || '').split(' ')[0];
  return [
    `Olá ${primeiro}, aqui é da FariLog.`,
    `Temos uma diária em ${c.empresaNome || 'nossa empresa'} no dia ${fmtDia(c.data)}.`,
    c.endereco ? `📍 Local: ${c.endereco}` : null,
    c.horario ? `🕐 Horário: ${c.horario}` : null,
    c.valorDiaria ? `💰 Valor: R$ ${c.valorDiaria}` : null,
    c.pagamentoEm ? `📅 Pagamento: ${fmtDia(c.pagamentoEm)}` : null,
    '',
    'Você aceita a convocação?',
  ].filter(Boolean).join('\n');
}

export default function AdminConvocacao() {
  const [filtro, setFiltro] = useState('fila');
  const [convs, setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [agindo, setAgindo]   = useState(null);

  const statuses = FILTROS.find(f => f.id === filtro)?.statuses ?? null;

  const load = useCallback(() => {
    setLoading(true);
    fetchConvocacoesAgente({ statuses }).then(list => { setConvs(list); setLoading(false); });
  }, [filtro]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Status ao vivo (o agente, quando existir, atualiza as mesmas linhas)
  useEffect(() => subscribeConvocacoes(null, () => load()), [load]);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const c of convs) {
      const k = c.escalaId || 'sem';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    }
    return [...map.entries()]
      .map(([escalaId, list]) => ({
        escalaId,
        list: list.sort((a, b) => (a.papel === b.papel ? (a.ordem ?? 999) - (b.ordem ?? 999) : a.papel === 'titular' ? -1 : 1)),
        empresa: list[0]?.empresaNome,
        data: list[0]?.data,
        horario: list[0]?.horario,
        vagas: list[0]?.vagas,
        endereco: list[0]?.endereco,
        confirmados: list[0]?.confirmados ?? 0,
      }))
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }, [convs]);

  const agir = async (tipo, conv) => {
    setAgindo(conv.id);
    if (tipo === 'aceitar')  await aceitarConvocacao(conv);
    if (tipo === 'recusar')  await recusarConvocacao(conv);
    if (tipo === 'silencio') await marcarSemResposta(conv);
    setAgindo(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>Convocação</p>
          <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            Fila de convocações que o agente de WhatsApp vai consumir. Enquanto o agente não está ativo,
            use os botões para simular as respostas e testar o fluxo.
          </p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: '#F1F5F9', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: '#F1F5F9', width: 'fit-content', flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            style={{ padding: '6px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: filtro === f.id ? 'white' : 'transparent', color: filtro === f.id ? '#0F172A' : '#94A3B8', boxShadow: filtro === f.id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <Loader2 size={24} className="animate-spin" style={{ color: '#FF4D0C', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '13px', color: '#94A3B8' }}>Carregando convocações…</p>
        </div>
      ) : grupos.length === 0 ? (
        <div className="card" style={{ padding: '56px 20px', textAlign: 'center' }}>
          <Send size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>Nenhuma convocação neste filtro.</p>
          <p style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '4px' }}>
            Monte uma escala pelo app do encarregado para gerar convocações.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => (
            <div key={g.escalaId} className="card overflow-hidden">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                    {g.empresa || 'Empresa'} · {fmtDia(g.data)}{g.horario ? ` · ${g.horario}` : ''}
                  </p>
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{g.endereco || 'endereço não informado'}</p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: g.confirmados >= g.vagas ? '#047857' : '#B45309', background: g.confirmados >= g.vagas ? '#D1FAE5' : '#FEF3C7', padding: '3px 9px', borderRadius: '7px' }}>
                  {g.confirmados}/{g.vagas} confirmados
                </span>
              </div>

              {g.list.map(c => {
                const acionavel = ['pendente', 'enviada', 'reserva', 'acionada'].includes(c.status);
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: c.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {c.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{c.name}</p>
                        {c.papel === 'reserva' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '9px', fontWeight: 700, color: '#6B7280', background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>
                            <Shield size={8} /> reserva
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}><MapPin size={9} /> {fmtDistancia(c.distanciaKm)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}><Star size={9} /> {c.notaSnapshot == null ? 'sem nota' : fmtNota(c.notaSnapshot)}</span>
                        {c.phone && <span style={{ fontSize: '10px', color: '#94A3B8' }}>{c.phone}</span>}
                      </div>
                    </div>

                    <ConvocacaoBadge status={c.status} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                      <WhatsAppButton phone={c.phone} message={textoConvite(c)} label="Convite" compact />
                      {acionavel && (
                        <>
                          <button onClick={() => agir('aceitar', c)} disabled={agindo === c.id} title="Ajudante aceitou"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '8px', border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#047857', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                            <CheckCircle2 size={11} /> Aceitou
                          </button>
                          <button onClick={() => agir('recusar', c)} disabled={agindo === c.id} title="Ajudante recusou"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '8px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                            <XCircle size={11} /> Recusou
                          </button>
                          <button onClick={() => agir('silencio', c)} disabled={agindo === c.id} title="Sem resposta"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                            <Clock size={11} /> Silêncio
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)' }}>
        <Info size={13} style={{ color: '#64748B', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>
          <b>Simulador:</b> os botões gravam os mesmos status que o agente gravará. Regra de vagas: ao aceitar com a
          lista cheia, o ajudante vira <b>reserva</b>. O contrato completo está em <code>supabase/agente-whatsapp.md</code>.
        </p>
      </div>
    </div>
  );
}
