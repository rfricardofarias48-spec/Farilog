import { useState, useEffect } from 'react';
import { fetchTodayAllRecords } from '../../lib/db';
import { Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export default function AdminRHPonto() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayAllRecords(TODAY).then(r => { setRecords(r || []); setLoading(false); });
  }, []);

  const comEntrada    = records.filter(r => r.checkIn);
  const semEntrada    = records.filter(r => !r.checkIn);
  const comSaida      = records.filter(r => r.checkOut);

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Controle de Ponto</h1>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
          Monitoramento de ponto — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {[
          { label: 'Com entrada', value: comEntrada.length, color: '#059669' },
          { label: 'Sem entrada', value: semEntrada.length, color: semEntrada.length > 0 ? '#E11D48' : '#CBD5E1' },
          { label: 'Finalizados', value: comSaida.length,   color: '#64748B' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '16px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}><p style={{ color: '#94A3B8' }}>Carregando...</p></div>
      ) : records.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <Clock size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Nenhum registro de ponto hoje</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>{records.length} registros hoje</p>
          </div>
          {records.map((r, idx) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: idx < records.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: r.funcionarioCor || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {r.funcionarioIni || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{r.funcionarioNome || '—'}</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '2px' }}>
                  {r.checkIn  && <span style={{ fontSize: '11px', color: '#059669' }}>↳ {r.checkIn}</span>}
                  {r.checkOut && <span style={{ fontSize: '11px', color: '#64748B' }}>⇥ {r.checkOut}</span>}
                  {!r.checkIn && <span style={{ fontSize: '11px', color: '#E11D48' }}>Sem entrada</span>}
                </div>
              </div>
              {r.checkOut
                ? <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                : r.checkIn
                ? <Clock size={16} style={{ color: '#2563EB', flexShrink: 0 }} />
                : <AlertTriangle size={16} style={{ color: '#E11D48', flexShrink: 0 }} />
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
