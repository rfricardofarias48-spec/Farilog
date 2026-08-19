import { useState, useEffect } from 'react';
import { fetchTodayAllRecords } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import { Clock, CheckCircle2, AlertTriangle, Calendar, Users, Filter, ChevronRight, Flame, Sparkles } from 'lucide-react';
import { calculateWorkAndOvertime } from '../../lib/timeUtils';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export default function AdminRHPonto() {
  const { demands, employees, companies, updateDemandTimes } = useAuth();
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchTodayAllRecords(selectedDate)
      .then(r => {
        setRecords(r || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedDate, demands]);

  // Combine records with context demands for full manual tracking
  const matchingDemands = demands.filter(d => d.date === selectedDate);

  const comEntrada = records.filter(r => r.entrada || r.checkIn);
  const comSaida   = records.filter(r => r.saida || r.checkOut);
  const emAndamento = records.filter(r => (r.entrada || r.checkIn) && !(r.saida || r.checkOut));

  // Cálculo de total de horas extras do dia selecionado
  let totalDiaOvertimeMins = 0;
  records.forEach(r => {
    const entrada = r.entrada || r.checkIn;
    const saida = r.saida || r.checkOut;
    const saidaAlmoco = r.saida_almoco || r.saidaAlmoco;
    const retornoAlmoco = r.retorno_almoco || r.retornoAlmoco;
    const isCargaDescarga = r.tipoServico === 'carga_descarga' || r.tipo_servico === 'carga_descarga';

    if (entrada && saida) {
      const calc = calculateWorkAndOvertime(
        entrada,
        saida,
        isCargaDescarga ? null : saidaAlmoco,
        isCargaDescarga ? null : retornoAlmoco
      );
      totalDiaOvertimeMins += calc.overtimeMinutes;
    }
  });

  const totalDiaHEHours = Math.floor(totalDiaOvertimeMins / 60);
  const totalDiaHERemMins = totalDiaOvertimeMins % 60;
  const totalDiaHEFormatted = totalDiaOvertimeMins > 0
    ? `${totalDiaHEHours}h ${String(totalDiaHERemMins).padStart(2, '0')}m`
    : '0h';

  const filteredRecords = records.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.funcionarioNome?.toLowerCase().includes(q) ||
      r.empresaNome?.toLowerCase().includes(q) ||
      r.service?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Controle de Horários & Horas Extras da Equipe</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
            Auditoria de jornada, intervalos e cálculo automático de HE (8h de trabalho + 1h intervalo = 9h base; ou 8h sem intervalo)
          </p>
        </div>

        {/* Seletor de Data */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          <Calendar size={14} className="text-slate-400" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Data:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="input-field"
            style={{ fontSize: '12px', padding: '4px 8px', height: '30px', width: '135px' }}
          />
          {selectedDate !== TODAY && (
            <button
              onClick={() => setSelectedDate(TODAY)}
              style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D0C', background: '#FFF2EE', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}
            >
              Hoje
            </button>
          )}
        </div>
      </div>

      {/* Métricas do dia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Escalados', value: records.length, color: '#0F172A', bg: '#F8FAFC' },
          { label: 'Com Entrada',     value: comEntrada.length, color: '#0284C7', bg: '#F0F9FF' },
          { label: 'Em Andamento',    value: emAndamento.length, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Finalizados',     value: comSaida.length,   color: '#059669', bg: '#ECFDF5' },
          {
            label: 'Total Horas Extras',
            value: totalDiaHEFormatted,
            color: totalDiaOvertimeMins > 0 ? '#FF4D0C' : '#64748B',
            bg: totalDiaOvertimeMins > 0 ? '#FFF2EE' : '#F8FAFC',
            highlight: totalDiaOvertimeMins > 0
          },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '16px', textAlign: 'center', background: k.bg, border: k.highlight ? '1.5px solid rgba(255,77,12,0.3)' : '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              {k.highlight && <Flame size={12} color="#FF4D0C" />}
              {k.label}
            </p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de Registros */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}><p style={{ color: '#94A3B8' }}>Carregando horários...</p></div>
      ) : filteredRecords.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <Clock size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ color: '#0F172A', fontSize: '14px', fontWeight: 700 }}>Nenhum horário registrado para esta data</p>
          <p style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px' }}>
            Lance uma nova demanda na aba Operacional &gt; Lançar Demanda para registrar a escala
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>{filteredRecords.length} colaboradores na data</p>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Horários manuais definidos pelo Admin com cálculo de HE</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#F8FAFC', color: '#64748B', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 16px' }}>Colaborador</th>
                  <th style={{ padding: '10px 16px' }}>Empresa</th>
                  <th style={{ padding: '10px 16px' }}>Entrada</th>
                  <th style={{ padding: '10px 16px' }}>Almoço (Saída/Volta)</th>
                  <th style={{ padding: '10px 16px' }}>Saída</th>
                  <th style={{ padding: '10px 16px' }}>Jornada & Horas Extras</th>
                  <th style={{ padding: '10px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, idx) => {
                  const entrada = r.entrada || r.checkIn;
                  const saida   = r.saida   || r.checkOut;
                  const almocoSaida = r.saida_almoco || r.saidaAlmoco;
                  const almocoVolta = r.retorno_almoco || r.retornoAlmoco;
                  const isCargaDescarga = r.tipoServico === 'carga_descarga' || r.tipo_servico === 'carga_descarga';
                  const isDone  = Boolean(saida);

                  let timeCalc = null;
                  if (entrada && saida) {
                    timeCalc = calculateWorkAndOvertime(
                      entrada,
                      saida,
                      isCargaDescarga ? null : almocoSaida,
                      isCargaDescarga ? null : almocoVolta
                    );
                  }

                  return (
                    <tr
                      key={r.id || idx}
                      style={{
                        borderBottom: idx < filteredRecords.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                        background: idx % 2 === 0 ? 'white' : '#FCFCFD',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: r.funcionarioCor || '#94A3B8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0,
                          }}>
                            {r.funcionarioIni || '?'}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: '#0F172A' }}>{r.funcionarioNome || '—'}</p>
                            <p style={{ fontSize: '10px', color: '#94A3B8' }}>Ajudante</p>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                        {r.empresaNome || '—'}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {entrada ? (
                          <span style={{ fontWeight: 700, color: '#0F172A', background: '#F1F5F9', padding: '3px 7px', borderRadius: '5px' }}>
                            {entrada}
                          </span>
                        ) : (
                          <span style={{ color: '#E11D48', fontWeight: 600, fontSize: '11px' }}>Não informada</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', color: '#64748B' }}>
                        {almocoSaida && almocoVolta
                          ? `${almocoSaida} - ${almocoVolta}`
                          : almocoSaida
                          ? `${almocoSaida} - (em aberto)`
                          : isCargaDescarga
                          ? <span style={{ color: '#94A3B8', fontSize: '11px' }}>Direto (Carga)</span>
                          : <span style={{ color: '#94A3B8', fontSize: '11px' }}>Não informado (base 8h)</span>}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {saida ? (
                          <span style={{ fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '3px 7px', borderRadius: '5px' }}>
                            {saida}
                          </span>
                        ) : (
                          <span style={{ color: '#D97706', fontWeight: 600, fontSize: '11px', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>
                            Em aberto (trabalhando)
                          </span>
                        )}
                      </td>

                      {/* Coluna de Jornada e Horas Extras */}
                      <td style={{ padding: '12px 16px' }}>
                        {timeCalc ? (
                          <div className="flex flex-col gap-1">
                            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                              Jornada: <strong>{timeCalc.workHoursFormatted}</strong>
                            </span>
                            {timeCalc.overtimeMinutes > 0 ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                fontSize: '11px', fontWeight: 800, color: '#FF4D0C',
                                background: '#FFF2EE', padding: '2px 6px', borderRadius: '5px',
                                width: 'fit-content',
                              }}>
                                <Flame size={12} /> +{timeCalc.overtimeFormatted} HE
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>
                                Sem HE (dentro da jornada)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            Aguardando saída
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {isDone ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#059669' }}>
                            <CheckCircle2 size={13} /> Finalizado
                          </span>
                        ) : entrada ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#0284C7' }}>
                            <Clock size={13} /> Em andamento
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#E11D48' }}>
                            <AlertTriangle size={13} /> Sem entrada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

