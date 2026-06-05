import { useState, useEffect } from 'react';
import { fetchEmployeesRH, toggleEmployeeStatus } from '../../lib/db';
import { Search, User, UserX, UserCheck, MapPin, Clock } from 'lucide-react';

function tempoEmpresa(dataContratacao) {
  if (!dataContratacao) return null;
  const inicio = new Date(dataContratacao + 'T12:00:00');
  const meses  = (new Date().getFullYear() - inicio.getFullYear()) * 12 + (new Date().getMonth() - inicio.getMonth());
  if (meses < 1)  return 'menos de 1 mês';
  if (meses < 12) return `${meses} mês${meses !== 1 ? 'es' : ''}`;
  const anos = Math.floor(meses / 12);
  const rest = meses % 12;
  return rest === 0 ? `${anos} ano${anos !== 1 ? 's' : ''}` : `${anos} ano${anos !== 1 ? 's' : ''} e ${rest} mês${rest !== 1 ? 'es' : ''}`;
}

export default function RHBanco() {
  const [employees, setEmployees]   = useState([]);
  const [search, setSearch]         = useState('');
  const [filtro, setFiltro]         = useState('active');
  const [loading, setLoading]       = useState(true);
  const [afastModal, setAfastModal] = useState(null); // { id, nome }
  const [motivo, setMotivo]         = useState('');

  const load = () => fetchEmployeesRH().then(e => { setEmployees(e); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = employees.filter(e => {
    const matchSearch = e.name?.toLowerCase().includes(search.toLowerCase()) ||
      (e.cidade || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.cargo || '').toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === 'todos' ? true : e.status === filtro;
    return matchSearch && matchFiltro;
  });

  const counts = {
    active:   employees.filter(e => e.status === 'active').length,
    inactive: employees.filter(e => e.status === 'inactive').length,
  };

  const handleAfastar = async () => {
    await toggleEmployeeStatus(afastModal.id, 'inactive', motivo);
    setAfastModal(null);
    setMotivo('');
    load();
  };

  const handleReativar = async (id) => {
    await toggleEmployeeStatus(id, 'active', '');
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Banco de Ajudantes</h1>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
          {counts.active} ativo{counts.active !== 1 ? 's' : ''} · {counts.inactive} inativo{counts.inactive !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Busca + filtro */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="input-field" style={{ paddingLeft: '36px' }} placeholder="Buscar por nome, cargo ou cidade..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: '#F1F5F9' }}>
          {[['active','Ativos'], ['inactive','Afastados'], ['todos','Todos']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFiltro(val)}
              style={{ padding: '6px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: filtro === val ? 'white' : 'transparent', color: filtro === val ? '#0F172A' : '#94A3B8', boxShadow: filtro === val ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}><p style={{ color: '#94A3B8' }}>Carregando...</p></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
          <User size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Nenhum ajudante encontrado</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((emp, i) => {
            const tempo = tempoEmpresa(emp.dataContratacao);
            const isAtivo = emp.status === 'active';
            return (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none', opacity: isAtivo ? 1 : 0.65 }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {emp.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    {emp.name}
                    {emp.cidade && <span style={{ fontSize: '12px', fontWeight: 400, color: '#94A3B8' }}> ({emp.cidade})</span>}
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    {emp.cargo || 'Ajudante'}
                    {tempo && <span style={{ color: '#94A3B8' }}> · {tempo}</span>}
                  </p>
                  {!isAtivo && emp.motivoAfastamento && (
                    <p style={{ fontSize: '11px', color: '#E11D48', marginTop: '2px', fontStyle: 'italic' }}>
                      Motivo: {emp.motivoAfastamento}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: isAtivo ? '#DCFCE7' : '#F1F5F9', color: isAtivo ? '#059669' : '#64748B' }}>
                    {isAtivo ? 'Ativo' : 'Afastado'}
                  </span>
                  {isAtivo ? (
                    <button onClick={() => setAfastModal({ id: emp.id, nome: emp.name })}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '8px', background: '#FEF2F2', color: '#E11D48', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                      <UserX size={12} /> Afastar
                    </button>
                  ) : (
                    <button onClick={() => handleReativar(emp.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '8px', background: '#DCFCE7', color: '#059669', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                      <UserCheck size={12} /> Reativar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal afastamento */}
      {afastModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAfastModal(null)}>
          <div className="modal-box animate-fade-up" style={{ maxWidth: '420px' }}>
            <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>Afastar ajudante</p>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>{afastModal.nome}</p>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>Motivo do afastamento *</label>
            <input className="input-field" placeholder="Ex: férias, atestado, desligamento..."
              value={motivo} onChange={e => setMotivo(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => { setAfastModal(null); setMotivo(''); }}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={handleAfastar} disabled={!motivo.trim()}
                style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', cursor: motivo.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 700, background: motivo.trim() ? '#E11D48' : '#E2E8F0', color: motivo.trim() ? 'white' : '#94A3B8' }}>
                Confirmar afastamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
