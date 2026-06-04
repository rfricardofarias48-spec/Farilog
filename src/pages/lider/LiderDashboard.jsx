import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchEscalasByLider, fetchAjudantesDisponiveis,
  upsertRelatorioDiario, fetchOcorrencias, createOcorrencia,
  updateOcorrenciaStatus, updateDemandEmployeeStatus,
  createEscalaByLider, addRegistroToEscala,
} from '../../lib/db';
import { fmtCurrency } from '../../data/mockData';
import {
  Users, Calendar, Clock, CheckCircle2, AlertCircle,
  ClipboardList, Plus, ChevronRight, X, Building2,
  Send, UserCheck, UserX, FileText, RefreshCw, Search,
} from 'lucide-react';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const DOW   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const T     = { color: '#0F172A' };
const TM    = { color: '#94A3B8' };

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${DOW[new Date(`${iso}T12:00:00`).getDay()]}, ${d}/${m}/${y}`;
}

// ── Status badge ──────────────────────────────────────────────────────────
const STATUS = {
  aguardando: { label: 'Aguardando', color: '#D97706', bg: '#FEF3C7' },
  confirmado: { label: 'Confirmado', color: '#059669', bg: '#DCFCE7' },
  atrasado:   { label: 'Atrasado',   color: '#EA580C', bg: '#FFEDD5' },
  falta:      { label: 'Falta',      color: '#E11D48', bg: '#FFE4E6' },
  finalizado: { label: 'Finalizado', color: '#64748B', bg: '#F1F5F9' },
};

function StatusBadge({ status }) {
  const cfg = STATUS[status] || STATUS.aguardando;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── Tab: Hoje ─────────────────────────────────────────────────────────────
const STATUS_ACTIONS = [
  { key: 'confirmado', label: 'Presente', color: '#059669', bg: '#DCFCE7' },
  { key: 'falta',      label: 'Falta',    color: '#E11D48', bg: '#FFE4E6' },
  { key: 'atrasado',   label: 'Atrasado', color: '#D97706', bg: '#FEF3C7' },
];

function ModalSubstituto({ escala, employees, onClose, onRefresh }) {
  const [disponiveis, setDisponiveis] = useState([]);
  const [search, setSearch]           = useState('');
  const [adding, setAdding]           = useState(null);

  useEffect(() => {
    fetchAjudantesDisponiveis(TODAY).then(setDisponiveis);
  }, []);

  const handleAdd = async (emp) => {
    setAdding(emp.id);
    await addRegistroToEscala(
      escala.id, emp.id, escala.companyId, TODAY, escala.service
    );
    await onRefresh();
    onClose();
  };

  const filtered = disponiveis.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '420px' }}>
        <div className="flex items-center justify-between mb-4">
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Acionar substituto</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
        </div>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="input-field" style={{ paddingLeft: '32px' }} placeholder="Buscar ajudante..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px 0' }}>
            Nenhum ajudante disponível hoje
          </p>
        ) : filtered.map(emp => (
          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {emp.initials}
            </div>
            <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</p>
            <button onClick={() => handleAdd(emp)} disabled={adding === emp.id}
              style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: '#FF4D0C', color: 'white', opacity: adding === emp.id ? 0.5 : 1 }}>
              {adding === emp.id ? '...' : 'Escalar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabHoje({ user, escalas, employees, onRefresh }) {
  const todayEscala  = escalas.find(e => e.date === TODAY);
  const ajudantes    = todayEscala?.employees || [];
  const [updating, setUpdating]         = useState(null);
  const [modalSubst, setModalSubst]     = useState(false);

  const confirmados = ajudantes.filter(a => a.status === 'confirmado').length;
  const ausentes    = ajudantes.filter(a => a.status === 'falta').length;
  const total       = ajudantes.length;

  const handleStatus = async (employeeId, novoStatus) => {
    if (!todayEscala) return;
    setUpdating(employeeId);
    await updateDemandEmployeeStatus(todayEscala.id, employeeId, novoStatus);
    await onRefresh();
    setUpdating(null);
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        {[
          { label: 'Escalados',   value: total,       color: '#0F172A' },
          { label: 'Confirmados', value: confirmados, color: '#059669' },
          { label: 'Ausentes',    value: ausentes,    color: ausentes > 0 ? '#E11D48' : '#CBD5E1' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '14px 12px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de ajudantes */}
      <div className="card overflow-hidden">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
            Equipe de hoje — {fmtDate(TODAY)}
          </p>
          {todayEscala && (
            <button onClick={() => setModalSubst(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={11} /> Substituto
            </button>
          )}
        </div>
        {ajudantes.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>Nenhuma escala para hoje</p>
          </div>
        ) : ajudantes.map(({ employeeId, status, entrada, saida }) => {
          const emp = employees.find(e => e.id === employeeId);
          const isUpdating = updating === employeeId;
          return (
            <div key={employeeId} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {emp?.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
                  {entrada && <p style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Entrada: {entrada}{saida ? ` · Saída: ${saida}` : ''}</p>}
                </div>
                <StatusBadge status={status} />
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingLeft: '48px' }}>
                {STATUS_ACTIONS.map(({ key, label, color, bg }) => (
                  <button key={key} disabled={isUpdating || status === key}
                    onClick={() => handleStatus(employeeId, key)}
                    style={{
                      flex: 1, padding: '6px 4px', borderRadius: '8px', border: 'none',
                      cursor: status === key ? 'default' : 'pointer',
                      fontSize: '10px', fontWeight: 700,
                      background: status === key ? bg : '#F1F5F9',
                      color: status === key ? color : '#94A3B8',
                      opacity: isUpdating ? 0.5 : 1, transition: 'all 0.15s',
                    }}>
                    {isUpdating && status !== key ? '...' : label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modalSubst && todayEscala && (
        <ModalSubstituto
          escala={todayEscala}
          employees={employees}
          onClose={() => setModalSubst(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

// ── Tab: Escala ───────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function NovaEscalaForm({ user, onSaved, onCancel }) {
  const [form, setForm]           = useState({ date: TODAY, time: '07:00', service: '' });
  const [disponiveis, setDisp]    = useState([]);
  const [selected, setSelected]   = useState([]);
  const [loadingDisp, setLD]      = useState(false);
  const [saving, setSaving]       = useState(false);

  const loadDisp = async (date) => {
    setLD(true);
    const list = await fetchAjudantesDisponiveis(date);
    setDisp(list);
    setLD(false);
  };

  useEffect(() => { loadDisp(form.date); }, [form.date]);

  const toggle = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) return alert('Selecione ao menos um ajudante.');
    setSaving(true);
    await createEscalaByLider({
      liderId:     user.id,
      companyId:   user.empresa_id,
      date:        form.date,
      time:        form.time,
      service:     form.service,
      employeeIds: selected,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Nova Escala</p>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Data *</label>
          <input type="date" className="input-field" required value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Horário</label>
          <input type="time" className="input-field" value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Serviço</label>
          <input className="input-field" placeholder="Ex: Separação, Entrega, Carga..." value={form.service}
            onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
        </div>
      </div>

      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>
          Ajudantes disponíveis em {new Date(`${form.date}T12:00:00`).toLocaleDateString('pt-BR')} — selecione
        </p>
        {loadingDisp ? (
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>Carregando...</p>
        ) : disponiveis.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhum ajudante disponível nessa data</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {disponiveis.map(emp => {
              const sel = selected.includes(emp.id);
              return (
                <button key={emp.id} type="button" onClick={() => toggle(emp.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', border: `2px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.08)'}`, background: sel ? '#FFF5F2' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {emp.initials}
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: sel ? '#FF4D0C' : '#0F172A', flex: 1 }}>{emp.name}</p>
                  {sel && <CheckCircle2 size={14} style={{ color: '#FF4D0C' }} />}
                </button>
              );
            })}
          </div>
        )}
        {selected.length > 0 && (
          <p style={{ fontSize: '11px', color: '#FF4D0C', fontWeight: 600, marginTop: '6px' }}>
            {selected.length} ajudante{selected.length !== 1 ? 's' : ''} selecionado{selected.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          style={{ flex: 2, padding: '10px', borderRadius: '10px', background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700 }}>
          {saving ? 'Criando...' : `Criar escala (${selected.length})`}
        </button>
      </div>
    </form>
  );
}

function TabEscala({ user, escalas, employees, onRefresh }) {
  const [openId, setOpenId]     = useState(null);
  const [showForm, setShowForm] = useState(false);

  const upcoming = escalas
    .filter(e => e.date >= TODAY)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-3">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
          Próximas escalas — {upcoming.length} agendadas
        </p>
        <button onClick={() => setShowForm(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={13} /> Nova escala
        </button>
      </div>

      {showForm && (
        <NovaEscalaForm
          user={user}
          onSaved={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {upcoming.length === 0 && !showForm && (
        <div className="card" style={{ padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Nenhuma escala agendada</p>
        </div>
      )}
      {upcoming.map(escala => (
        <div key={escala.id} className="card overflow-hidden">
          <button onClick={() => setOpenId(openId === escala.id ? null : escala.id)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ textAlign: 'center', width: '36px', flexShrink: 0 }}>
              <p style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala.date.split('-')[2]}</p>
              <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>
                {MONTHS_SHORT[Number(escala.date.split('-')[1]) - 1]}
              </p>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{escala.companyName}</p>
              <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                {escala.time} · {escala.employees.length} ajudante{escala.employees.length !== 1 ? 's' : ''}
              </p>
            </div>
            <ChevronRight size={14} style={{ color: '#CBD5E1', transform: openId === escala.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {openId === escala.id && (
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FAFBFC' }}>
              {escala.employees.map(({ employeeId, status }) => {
                const emp = employees.find(e => e.id === employeeId);
                return (
                  <div key={employeeId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {emp?.initials}
                    </div>
                    <p style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
                    <StatusBadge status={status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab: Ocorrências ──────────────────────────────────────────────────────
function TabOcorrencias({ user }) {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ descricao: '', data: TODAY });

  useEffect(() => {
    fetchOcorrencias({ liderId: user.id }).then(setOcorrencias);
  }, [user.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.descricao.trim()) return;
    await createOcorrencia({
      liderId: user.id,
      empresaId: user.empresa_id,
      data: form.data,
      descricao: form.descricao,
    });
    setForm({ descricao: '', data: TODAY });
    setShowForm(false);
    fetchOcorrencias({ liderId: user.id }).then(setOcorrencias);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>{ocorrencias.length} ocorrência{ocorrencias.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={13} /> Nova
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Registrar Ocorrência</p>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>Data</label>
            <input type="date" className="input-field" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>Descrição</label>
            <textarea className="input-field" rows={3} placeholder="Descreva o que aconteceu..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              style={{ resize: 'none' }} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" style={{ flex: 2, padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>Registrar</button>
          </div>
        </form>
      )}

      {ocorrencias.length === 0 ? (
        <div className="card" style={{ padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Nenhuma ocorrência registrada</p>
        </div>
      ) : ocorrencias.map(oc => (
        <div key={oc.id} className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>{fmtDate(oc.data)}</p>
              <p style={{ fontSize: '13px', color: '#0F172A', lineHeight: 1.5 }}>{oc.descricao}</p>
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: oc.status === 'resolvido' ? '#DCFCE7' : '#FEF3C7', color: oc.status === 'resolvido' ? '#059669' : '#D97706', flexShrink: 0 }}>
              {oc.status === 'resolvido' ? 'Resolvido' : 'Aberto'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Relatório ────────────────────────────────────────────────────────
function TabRelatorio({ user, escalas, employees }) {
  const todayEscala = escalas.find(e => e.date === TODAY);
  const ajudantes   = todayEscala?.employees || [];

  const [obs, setObs]           = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const presentes  = ajudantes.filter(a => a.status === 'confirmado' || a.status === 'finalizado').length;
  const ausentes   = ajudantes.filter(a => a.status === 'falta').length;
  const ocCount    = ajudantes.filter(a => a.status === 'atrasado').length;

  const handleFinalizar = async () => {
    setSaving(true);
    await upsertRelatorioDiario({
      liderId:          user.id,
      empresaId:        user.empresa_id,
      data:             TODAY,
      presentes,
      ausentes,
      ocorrenciasCount: ocCount,
      observacoes:      obs,
      finalizado:       true,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Relatório do dia — {fmtDate(TODAY)}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Presentes', value: presentes, color: '#059669' },
            { label: 'Ausentes',  value: ausentes,  color: ausentes > 0 ? '#E11D48' : '#CBD5E1' },
          ].map((k, i) => (
            <div key={i} style={{ padding: '10px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '4px' }}>{k.label}</p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
            </div>
          ))}
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Observações do dia</label>
          <textarea className="input-field" rows={4} placeholder="Descreva como foi a operação, incidentes, destaques..."
            value={obs} onChange={e => setObs(e.target.value)} style={{ resize: 'none' }} />
        </div>

        <button onClick={handleFinalizar} disabled={saving} style={{
          width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
          fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <FileText size={14} /> {saving ? 'Salvando...' : 'Finalizar dia'}
        </button>

        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#059669' }}>
            <CheckCircle2 size={14} /> Relatório finalizado e disponível para o cliente.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────
export default function LiderDashboard() {
  const { user, employees } = useAuth();
  const { tab } = useOutletContext();
  const [escalas, setEscalas] = useState([]);

  const load = useCallback(() => {
    if (user?.id) fetchEscalasByLider(user.id).then(setEscalas);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const TAB_TITLES = {
    hoje:        'Hoje',
    escala:      'Escala',
    ocorrencias: 'Ocorrências',
    relatorio:   'Relatório Diário',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="animate-fade-up">
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {TAB_TITLES[tab] || 'Painel'}
        </p>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
          {tab === 'hoje' ? `Olá, ${user?.name?.split(' ')[0]}` : TAB_TITLES[tab]}
        </h1>
        {tab === 'hoje' && user?.companyName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
            <Building2 size={12} style={{ color: '#94A3B8' }} />
            <p style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{user.companyName}</p>
          </div>
        )}
      </div>

      {/* Content */}
      {tab === 'hoje'        && <TabHoje        user={user} escalas={escalas} employees={employees} onRefresh={load} />}
      {tab === 'escala'      && <TabEscala      user={user} escalas={escalas} employees={employees} onRefresh={load} />}
      {tab === 'ocorrencias' && <TabOcorrencias user={user} />}
      {tab === 'relatorio'   && <TabRelatorio   user={user} escalas={escalas} employees={employees} />}
    </div>
  );
}
