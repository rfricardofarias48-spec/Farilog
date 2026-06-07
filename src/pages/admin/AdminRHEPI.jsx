import { useState, useEffect } from 'react';
import { fetchEmployees, updateEmployee } from '../../lib/db';
import { Shield, Check } from 'lucide-react';

const EPI_ITEMS = [
  { key: 'colete',    label: 'Colete' },
  { key: 'sapato',    label: 'Sapato de segurança' },
  { key: 'luvas',     label: 'Luvas' },
  { key: 'capacete',  label: 'Capacete' },
  { key: 'oculos',    label: 'Óculos de proteção' },
];

export default function AdminRHEPI() {
  const [employees, setEmployees] = useState([]);
  const [epiMap, setEpiMap]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);

  const load = () => fetchEmployees().then(e => {
    setEmployees(e.filter(emp => emp.status === 'active') || []);
    setLoading(false);
  });

  useEffect(() => { load(); }, []);

  const toggleEpi = async (empId, key) => {
    const current = epiMap[empId] || {};
    const updated  = { ...current, [key]: !current[key] };
    setEpiMap(prev => ({ ...prev, [empId]: updated }));
    setSaving(empId);
    // Salva como JSON no campo observacoes ou use um campo dedicado — por ora apenas local
    setTimeout(() => setSaving(null), 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Controle de EPI</h1>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
          Equipamentos de Proteção Individual por ajudante
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}><p style={{ color: '#94A3B8' }}>Carregando...</p></div>
      ) : employees.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <Shield size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Nenhum ajudante ativo</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Ajudante</th>
                  {EPI_ITEMS.map(e => (
                    <th key={e.key} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{e.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const epis = epiMap[emp.id] || {};
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                            {emp.initials}
                          </div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</p>
                        </div>
                      </td>
                      {EPI_ITEMS.map(item => (
                        <td key={item.key} style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleEpi(emp.id, item.key)}
                            style={{
                              width: '28px', height: '28px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                              background: epis[item.key] ? '#DCFCE7' : '#F1F5F9',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                              transition: 'all 0.15s',
                            }}>
                            {epis[item.key]
                              ? <Check size={14} style={{ color: '#059669' }} />
                              : <span style={{ fontSize: '10px', color: '#94A3B8' }}>—</span>
                            }
                          </button>
                        </td>
                      ))}
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
