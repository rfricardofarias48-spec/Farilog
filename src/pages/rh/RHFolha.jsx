import { useState, useEffect } from 'react';
import { fetchFechamentosfolha, createFechamentoFolha, aprovarFechamento, fetchEmployeesRH } from '../../lib/db';
import { CheckCircle2, Clock, DollarSign, Plus, X } from 'lucide-react';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getQuinzenaAtual() {
  const d = new Date();
  const day = d.getDate();
  const m = d.getMonth();
  const y = d.getFullYear();
  const mm = String(m + 1).padStart(2, '0');
  const num = day <= 15 ? 1 : 2;
  const last = new Date(y, m + 1, 0).getDate();
  return {
    label: `${MONTHS_PT[m]}/${y} — Quinzena ${num}`,
    periodo: num === 1 ? `01/${mm}/${y} a 15/${mm}/${y}` : `16/${mm}/${y} a ${last}/${mm}/${y}`,
  };
}

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function RHFolha() {
  const [fechamentos, setFechamentos] = useState([]);
  const [employees, setEmployees]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);

  const q = getQuinzenaAtual();

  const load = () => {
    Promise.all([fetchFechamentosfolha(), fetchEmployeesRH()])
      .then(([f, e]) => { setFechamentos(f); setEmployees(e.filter(emp => emp.status === 'active')); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const totalDiarias = employees.length;
  const valorTotal   = employees.reduce((s, e) => s + e.dailyRate, 0);

  const handleCriarFechamento = async () => {
    setSaving(true);
    await createFechamentoFolha({
      periodo: q.label,
      totalDiarias,
      totalHe: 0,
      valorTotal,
    });
    setSaving(false);
    setShowForm(false);
    load();
  };

  const handleAprovar = async (id) => {
    await aprovarFechamento(id);
    load();
  };

  const abertos   = fechamentos.filter(f => f.status !== 'aprovado');
  const aprovados = fechamentos.filter(f => f.status === 'aprovado');

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Folha de Pagamento</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Fechamento quinzenal e aprovação</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={15} /> Novo fechamento
        </button>
      </div>

      {/* Preview quinzena atual */}
      <div className="card p-5" style={{ border: '1px solid rgba(255,77,12,0.2)', background: '#FFF5F2' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D0C', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Quinzena atual</p>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>{q.label}</p>
        <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>{q.periodo}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
          {[
            { label: 'Ajudantes ativos', value: employees.length, color: '#0F172A' },
            { label: 'Total estimado',   value: fmtCurrency(valorTotal), color: '#059669' },
            { label: 'Status',           value: 'Em aberto', color: '#D97706' },
          ].map(k => (
            <div key={k.label} style={{ padding: '10px', borderRadius: '10px', background: 'white', textAlign: 'center' }}>
              <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px' }}>{k.label}</p>
              <p style={{ fontSize: '15px', fontWeight: 800, color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Formulário novo fechamento */}
      {showForm && (
        <div className="card p-5 space-y-4 animate-fade-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Criar fechamento — {q.label}</p>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B' }}>
            Será registrado um fechamento com <strong>{employees.length} ajudantes</strong> ativos e valor estimado de <strong>{fmtCurrency(valorTotal)}</strong>.
            Após criar, o fechamento ficará aguardando sua aprovação.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={handleCriarFechamento} disabled={saving}
              style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white' }}>
              {saving ? 'Criando...' : 'Criar fechamento'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}><p style={{ color: '#94A3B8' }}>Carregando...</p></div>
      ) : (
        <>
          {abertos.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Aguardando aprovação ({abertos.length})</p>
              <div className="space-y-3">
                {abertos.map(f => (
                  <div key={f.id} className="card p-5" style={{ border: '1px solid #FDE68A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>{f.periodo}</p>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>{f.total_diarias} diárias</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#059669' }}>{fmtCurrency(f.valor_total)}</span>
                          <span style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {fmtDate(f.criado_em)}</span>
                        </div>
                      </div>
                      <button onClick={() => handleAprovar(f.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px', background: '#059669', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                        <CheckCircle2 size={14} /> Aprovar folha
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aprovados.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Histórico aprovado</p>
              <div className="card overflow-hidden">
                {aprovados.map((f, idx) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: idx < aprovados.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{f.periodo}</p>
                      <p style={{ fontSize: '11px', color: '#94A3B8' }}>Aprovado em {fmtDate(f.fechado_em)}</p>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#059669' }}>{fmtCurrency(f.valor_total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fechamentos.length === 0 && (
            <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
              <DollarSign size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>Nenhum fechamento registrado</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
