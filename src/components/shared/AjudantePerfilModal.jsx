import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, MapPin, CalendarDays, MessageSquare, TrendingUp, Loader2 } from 'lucide-react';
import { fetchNotasFuncionario } from '../../lib/db';
import { fmtDataCurta, fmtNota, notaCor } from '../../lib/notas';
import StarRating, { StarsDisplay } from './StarRating';
import WhatsAppButton from './WhatsAppButton';

export default function AjudantePerfilModal({ employee, onClose }) {
  const [notas, setNotas]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!employee?.id) return undefined;
    setLoading(true);
    fetchNotasFuncionario(employee.id).then(list => {
      if (!alive) return;
      setNotas(list);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [employee?.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const media = notas.length
    ? notas.reduce((s, n) => s + Number(n.nota || 0), 0) / notas.length
    : null;

  const dist = [0, 0, 0, 0, 0, 0];
  notas.forEach(n => {
    const idx = Math.round(Number(n.nota));
    if (idx >= 0 && idx <= 5) dist[idx] += 1;
  });
  const maiorBarra = Math.max(1, ...dist);
  const ultima = notas[0] || null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1250,
        background: 'rgba(11, 11, 11,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '22px', width: '100%', maxWidth: '700px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 32px 90px rgba(0,0,0,0.3)', border: '1px solid rgba(0,0,0,0.06)',
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: '20px 22px', borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: 'linear-gradient(180deg,#FAFAFA 0%,#FFFFFF 100%)',
          display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0,
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px', flexShrink: 0,
            background: '#0B0B0B', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em',
          }}>
            {employee?.initials || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '18px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {employee?.name || 'Ajudante'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 600 }}>{employee?.cargo || 'Ajudante de Logística'}</span>
              {employee?.cidade && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#6B6B6B' }}>
                  <MapPin size={11} /> {employee.cidade}
                </span>
              )}
              {employee?.phone && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#6B6B6B' }}>
                  <Phone size={11} /> {employee.phone}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {employee?.phone && (
              <WhatsAppButton
                phone={employee.phone}
                message={`Olá ${String(employee.name || '').split(' ')[0]}, tudo bem? Aqui é da FariLog.`}
              />
            )}
            <button onClick={onClose} style={{
              width: '32px', height: '32px', borderRadius: '8px', border: 'none',
              background: '#F5F5F5', color: '#6B6B6B', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9A9A9A', fontSize: '13px' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              Carregando histórico...
            </div>
          ) : (
            <>
              {/* Resumo */}
              <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                <div style={{
                  borderRadius: '14px', padding: '14px',
                  background: media == null ? '#FAFAFA' : '#FFF7F4',
                  border: `1px solid ${media == null ? '#E6E6E6' : '#FFD9CC'}`,
                }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Média geral</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginTop: '3px' }}>
                    <span style={{ fontSize: '30px', fontWeight: 900, color: notaCor(media), lineHeight: 1 }}>
                      {fmtNota(media)}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A' }}>/ 5</span>
                  </div>
                  <div style={{ marginTop: '7px' }}>
                    <StarsDisplay value={media ?? 0} size={14} />
                  </div>
                </div>

                <div style={{
                  borderRadius: '14px', padding: '14px', background: '#FAFAFA',
                  border: '1px solid #E6E6E6',
                }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avaliações</p>
                  <p style={{ fontSize: '30px', fontWeight: 900, color: '#0B0B0B', lineHeight: 1, marginTop: '3px' }}>{notas.length}</p>
                  <p style={{ fontSize: '10px', color: '#9A9A9A', marginTop: '4px' }}>diárias avaliadas</p>
                </div>

                <div style={{
                  borderRadius: '14px', padding: '14px', background: '#FAFAFA',
                  border: '1px solid #E6E6E6',
                }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Última nota</p>
                  <p style={{ fontSize: '30px', fontWeight: 900, color: notaCor(ultima?.nota ?? null), lineHeight: 1, marginTop: '3px' }}>
                    {ultima ? fmtNota(ultima.nota) : '—'}
                  </p>
                  <p style={{ fontSize: '10px', color: '#9A9A9A', marginTop: '4px' }}>
                    {ultima ? fmtDataCurta(ultima.data) : 'sem avaliações'}
                  </p>
                </div>
              </div>

              {/* Distribuição */}
              {notas.length > 0 && (
                <div style={{ padding: '0 22px 16px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    Distribuição das notas
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[5, 4, 3, 2, 1, 0].map(n => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#6B6B6B', width: '28px' }}>{n} ★</span>
                        <div style={{ flex: 1, height: '7px', borderRadius: '99px', background: '#F4F4F5', overflow: 'hidden' }}>
                          <div style={{
                            width: `${(dist[n] / maiorBarra) * 100}%`, height: '100%',
                            background: n === 5 ? '#FF4D0C' : n === 4 ? '#0B0B0B' : n === 3 ? '#6B6B6B' : n === 2 ? '#9A9A9A' : n === 1 ? '#D1D1D1' : '#E6E6E6',
                            borderRadius: '99px', transition: 'width .25s',
                          }} />
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#9A9A9A', width: '18px', textAlign: 'right' }}>{dist[n]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico */}
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '16px 22px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 800, color: '#0B0B0B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Histórico de notas e observações
                  </p>
                  <span style={{ fontSize: '10px', color: '#9A9A9A' }}>{notas.length} registro{notas.length === 1 ? '' : 's'}</span>
                </div>

                {notas.length === 0 ? (
                  <div style={{ padding: '30px 12px', textAlign: 'center', background: '#F7F7F7', borderRadius: '12px', marginTop: '8px' }}>
                    <TrendingUp size={22} style={{ color: '#C8C8C8', margin: '0 auto 6px' }} />
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#6B6B6B' }}>Nenhuma avaliação lançada ainda</p>
                    <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '2px' }}>
                      As notas aparecem aqui após o encarregado fechar a diária.
                    </p>
                  </div>
                ) : notas.map(n => (
                  <div key={n.id} style={{ padding: '13px 0', borderBottom: '1px solid rgba(0,0,0,0.055)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 800, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.empresaNome || 'Empresa não informada'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#9A9A9A' }}>
                            <CalendarDays size={10} /> {fmtDataCurta(n.data)}
                          </span>
                          {n.servico && <span style={{ fontSize: '10px', color: '#9A9A9A' }}>· {n.servico}</span>}
                          {n.tipoServico && (
                            <span style={{
                              fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                              background: n.tipoServico === 'carga_descarga' ? '#0B0B0B' : '#F4F4F5',
                              color: n.tipoServico === 'carga_descarga' ? '#FFFFFF' : '#4A4A4A',
                            }}>
                              {n.tipoServico === 'carga_descarga' ? 'Carga/Descarga' : 'Entrega'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <StarRating value={n.nota} readOnly size={11} showValue />
                        <p style={{ fontSize: '9px', color: '#9A9A9A', marginTop: '2px' }}>
                          {n.avaliadoPorNome ? `por ${n.avaliadoPorNome}` : 'Encarregado responsável'}
                        </p>
                      </div>
                    </div>
                    {n.observacao && (
                      <div style={{
                        marginTop: '7px', padding: '8px 10px', background: '#F7F7F7',
                        borderRadius: '8px', border: '1px solid rgba(0,0,0,0.04)',
                        display: 'flex', gap: '6px', alignItems: 'flex-start',
                      }}>
                        <MessageSquare size={12} style={{ color: '#9A9A9A', flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontSize: '11px', color: '#4A4A4A', lineHeight: 1.5 }}>{n.observacao}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}