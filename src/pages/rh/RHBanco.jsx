import { useState, useEffect } from 'react';
import { fetchEmployees } from '../../lib/db';
import { Search, User } from 'lucide-react';

export default function RHBanco() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees().then(e => { setEmployees(e || []); setLoading(false); });
  }, []);

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Banco de Talentos</h1>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
          {employees.length} colaborador{employees.length !== 1 ? 'es' : ''} cadastrado{employees.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input
          className="input-field"
          style={{ paddingLeft: '36px' }}
          placeholder="Buscar por nome ou função..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Carregando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <User size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((emp, i) => (
            <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {emp.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</p>
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '1px' }}>{emp.role || 'Ajudante'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                  background: emp.status === 'ativo' ? '#DCFCE7' : '#F1F5F9',
                  color: emp.status === 'ativo' ? '#059669' : '#64748B',
                }}>
                  {emp.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
