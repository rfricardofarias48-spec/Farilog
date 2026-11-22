import { Shield, Send, X } from 'lucide-react';
import { fmtDistancia } from '../../lib/geo';
import { fmtNota } from '../../lib/notas';

const fmtDia = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dow = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
};

// Confirmação final: mostra titulares e reservas e grava a convocação.
// A partir daqui o envio é manual (botão de WhatsApp) + registro da resposta.
export default function ModalConfirmarConvocacao({
  empresa, date, time, vagas, titulares = [], reservas = [], pagamentoEm, saving, onCancel, onConfirm,
}) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onCancel()}
      style={{ zIndex: 1300 }}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Confirmar convocação?</p>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
              {empresa?.name || 'Empresa'} · {fmtDia(date)}{time ? ` · ${time}` : ''}
            </p>
          </div>
          <button onClick={onCancel} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
        </div>

        <div className="kpi-2x2" style={{ marginBottom: '14px' }}>
          {[
            { label: 'Vagas',    value: vagas },
            { label: 'Titulares', value: titulares.length },
            { label: 'Reservas', value: reservas.length },
            { label: 'Diária',   value: empresa?.dailyRate ? `R$ ${empresa.dailyRate}` : '—' },
          ].map(k => (
            <div key={k.label} style={{ padding: '8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)', textAlign: 'center' }}>
              <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</p>
              <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{k.value}</p>
            </div>
          ))}
        </div>

        {pagamentoEm && (
          <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
            💰 Pagamento previsto: <b style={{ color: '#0F172A' }}>{fmtDia(pagamentoEm)}</b>
          </p>
        )}

        {/* Titulares */}
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
          Titulares ({titulares.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
          {titulares.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhum titular selecionado.</p>
          ) : titulares.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '9px', background: '#EEF2F7' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: t.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'white', flexShrink: 0 }}>{t.initials}</div>
              <div className="person-main">
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{t.name}</p>
                <p style={{ fontSize: '10px', color: '#64748B' }}>{fmtDistancia(t.distanciaKm)}</p>
              </div>
              <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700, flexShrink: 0 }}>pendente</span>
            </div>
          ))}
        </div>

        {/* Reservas */}
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
          Reservas ({reservas.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {reservas.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '9px', background: '#FAFAFA' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: r.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'white', flexShrink: 0 }}>{r.initials}</div>
              <div className="person-main">
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{r.name}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}>{fmtDistancia(r.distanciaKm)}</span>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, color: '#6B7280', flexShrink: 0 }}><Shield size={9} /> reserva</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: '#FAF4F1', border: '1px solid #E4C9BF' }}>
          <p style={{ fontSize: '11px', color: '#8A3520', lineHeight: 1.5 }}>
            Ao confirmar, cada titular e reserva fica <b>pendente</b> no histórico. Envie o convite pelo botão de
            WhatsApp e registre a resposta na mão. Se a lista lotar, quem aceitar depois entra como <b>reserva</b>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button type="button" onClick={onCancel} disabled={saving}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={saving}
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '12px', borderRadius: '10px', border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap', background: saving ? '#E2E8F0' : '#BC4A2A', color: saving ? '#94A3B8' : 'white' }}>
            <Send size={14} /> {saving ? 'Convocando…' : 'Confirmar e convocar'}
          </button>
        </div>
      </div>
    </div>
  );
}
