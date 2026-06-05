import { useState, useEffect } from 'react';
import { fetchEmployeesRH, updateEmployee } from '../../lib/db';
import { Edit2, Check, X } from 'lucide-react';

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

const COLS = [
  { key: 'dailyRate',    label: 'Diária',      color: '#059669' },
  { key: 'overtimeRate', label: 'Hora Extra',  color: '#7C3AED' },
  { key: 'vr',           label: 'VR (R$/dia)', color: '#D97706' },
  { key: 'vt',           label: 'VT (R$/dia)', color: '#0891B2' },
];

export default function RHBeneficios() {
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing]     = useState(null);
  const [loading, setLoading]     = useState(true);

  const load = () => fetchEmployeesRH().then(e => { setEmployees(e || []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSave = async (empId, field, value) => {
    await updateEmployee(empId, { [field]: value });
    setEditing(null);
    load();
  };

  const ativos = employees.filter(e => e.status === 'active');

  const totalVR = ativos.reduce((s, e) => s + (e.vr || 0), 0);
  const totalVT = ativos.reduce((s, e) => s + (e.vt || 0), 0);
  const mediaDiaria = ativos.reduce((s, e) => s + (e.dailyRate || 0), 0) / (ativos.length || 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Benefícios</h1>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
          Diárias, horas extras, VR e VT — {ativos.length} ajudante{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        {[
          { label: 'Ativos',        value: ativos.length,          color: '#0F172A', suffix: '' },
          { label: 'Diária média',  value: fmtCurrency(mediaDiaria), color: '#059669', suffix: '' },
          { label: 'VR médio/dia', value: fmtCurrency(totalVR / (ativos.length || 1)), color: '#D97706', suffix: '' },
          { label: 'VT médio/dia', value: fmtCurrency(totalVT / (ativos.length || 1)), color: '#0891B2', suffix: '' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '16px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ fontSize: '17px', fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Carregando...</div>
      ) : (
        <div className="card overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Colaborador</th>
                  {COLS.map(c => (
                    <th key={c.key} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', opacity: emp.status === 'active' ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {emp.initials}
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</p>
                          {emp.cidade && <p style={{ fontSize: '11px', color: '#94A3B8' }}>{emp.cidade}</p>}
                        </div>
                      </div>
                    </td>
                    {COLS.map(col => (
                      <td key={col.key} style={{ padding: '12px 16px' }}>
                        {editing?.id === emp.id && editing?.field === col.key ? (
                          <EditCell value={emp[col.key]} onSave={v => handleSave(emp.id, col.key, v)} onCancel={() => setEditing(null)} />
                        ) : (
                          <button onClick={() => setEditing({ id: emp.id, field: col.key })}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: col.color }}>{fmtCurrency(emp[col.key])}</span>
                            <Edit2 size={11} style={{ color: '#CBD5E1' }} />
                          </button>
                        )}
                      </td>
                    ))}
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
        </div>
      )}
    </div>
  );
}
