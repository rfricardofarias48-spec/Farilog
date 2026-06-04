import { useState, useEffect } from 'react';
import { fetchEmployees, updateEmployee } from '../../lib/db';
import { DollarSign, Edit2, Check, X } from 'lucide-react';

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function EditCell({ value, onSave, onCancel }) {
  const [val, setVal] = useState(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input type="number" value={val} onChange={e => setVal(e.target.value)}
        style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A' }} />
      <button onClick={() => onSave(Number(val))}
        style={{ background: '#DCFCE7', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '5px', color: '#059669' }}>
        <Check size={12} />
      </button>
      <button onClick={onCancel}
        style={{ background: '#FEE2E2', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '5px', color: '#E11D48' }}>
        <X size={12} />
      </button>
    </div>
  );
}

export default function RHBeneficios() {
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing]     = useState(null);
  const [loading, setLoading]     = useState(true);

  const load = () => fetchEmployees().then(e => { setEmployees(e || []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSave = async (empId, field, value) => {
    await updateEmployee(empId, { [field]: value });
    setEditing(null);
    load();
  };

  const ativos = employees.filter(e => e.status === 'active');

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Benefícios</h1>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
          Diárias e horas extras — {ativos.length} colaborador{ativos.length !== 1 ? 'es' : ''} ativo{ativos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {[
          { label: 'Colaboradores ativos', value: ativos.length, suffix: '' },
          { label: 'Diária média', value: fmtCurrency(ativos.reduce((s,e) => s + (e.dailyRate||0), 0) / (ativos.length||1)), suffix: '' },
          { label: 'Hora extra média', value: fmtCurrency(ativos.reduce((s,e) => s + (e.overtimeRate||0), 0) / (ativos.length||1)), suffix: '' },
        ].map((k,i) => (
          <div key={i} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Carregando...</div>
      ) : (
        <div className="card overflow-hidden">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Colaborador','Cargo','Diária','Hora Extra','Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {emp.initials}
                      </div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</p>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>{emp.cargo || 'Ajudante'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {editing?.id === emp.id && editing?.field === 'dailyRate' ? (
                      <EditCell value={emp.dailyRate} onSave={v => handleSave(emp.id, 'dailyRate', v)} onCancel={() => setEditing(null)} />
                    ) : (
                      <button onClick={() => setEditing({ id: emp.id, field: 'dailyRate' })}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{fmtCurrency(emp.dailyRate)}</span>
                        <Edit2 size={11} style={{ color: '#CBD5E1' }} />
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {editing?.id === emp.id && editing?.field === 'overtimeRate' ? (
                      <EditCell value={emp.overtimeRate} onSave={v => handleSave(emp.id, 'overtimeRate', v)} onCancel={() => setEditing(null)} />
                    ) : (
                      <button onClick={() => setEditing({ id: emp.id, field: 'overtimeRate' })}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{fmtCurrency(emp.overtimeRate)}/h</span>
                        <Edit2 size={11} style={{ color: '#CBD5E1' }} />
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: emp.status === 'active' ? '#DCFCE7' : '#F1F5F9', color: emp.status === 'active' ? '#059669' : '#64748B' }}>
                      {emp.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
