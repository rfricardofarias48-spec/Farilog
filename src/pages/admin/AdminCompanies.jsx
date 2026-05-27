import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PAYMENTS, WORK_RECORDS, EMPLOYEES, fmtCurrency, fmtDate, WEEKDAYS, MONTHS } from '../../data/mockData';
import { Plus, Edit2, Trash2, X, Building2, Search, Phone, Mail, Calendar, Users, CheckCircle, TrendingUp, Clock, ChevronRight } from 'lucide-react';

const TODAY = '2026-05-26';
const TODAY_DATE = new Date(2026, 4, 26);

const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

const EMPTY = { name: '', cnpj: '', email: '', password: '', phone: '', contact: '', address: '', sector: '' };

function Modal({ company, onSave, onClose }) {
  const [form, setForm] = useState(company ? { ...company } : { ...EMPTY });

  const fields = [
    { key: 'name',     label: 'Razão Social',                        required: true, col: 2 },
    { key: 'cnpj',     label: 'CNPJ',                                required: true, placeholder: '00.000.000/0001-00' },
    { key: 'contact',  label: 'Responsável',                          required: true },
    { key: 'sector',   label: 'Setor' },
    { key: 'phone',    label: 'Telefone',                             placeholder: '(00) 00000-0000' },
    { key: 'email',    label: 'E-mail de acesso',                     required: true, type: 'email', col: 2 },
    { key: 'password', label: company ? 'Nova senha (opcional)' : 'Senha de acesso', type: 'password' },
    { key: 'address',  label: 'Endereço completo',                    col: 2 },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold" style={T}>{company ? 'Editar Empresa' : 'Nova Empresa'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(({ key, label, required, placeholder, type, col }) => (
              <div key={key} className={col === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
                <input type={type || 'text'} placeholder={placeholder} required={required}
                  value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-field" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button type="submit" className="btn-primary flex-1">{company ? 'Salvar' : 'Cadastrar empresa'}</button>
            <button type="button" onClick={onClose} className="btn-ghost px-5">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPayAmount(p) {
  const VALOR_DIARIA = 150, VALOR_HE = 50;
  function parsePStart(period) { const m = period.match(/^(\d{2})\/(\d{2}) - \d{2}\/\d{2}\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }
  function parsePEnd(period)   { const m = period.match(/^(\d{2})\/(\d{2}) - (\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[5]}-${m[4]}-${m[3]}` : null; }
  const s = parsePStart(p.period), e = parsePEnd(p.period);
  if (!s || !e) return 0;
  const recs = WORK_RECORDS.filter(r => r.companyId === p.companyId && r.date >= s && r.date <= e);
  return recs.filter(r => r.status !== 'absent').length * VALOR_DIARIA + recs.filter(r => r.overtime).length * VALOR_HE;
}

function dateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${d} de ${MONTHS[m - 1]}`;
}

// ── Escala KPI cards ──────────────────────────────────────────────────────────

function EscalaKPIs({ records }) {
  const total     = records.length;
  const presentes = records.filter(r => r.status === 'active' || r.status === 'completed').length;
  const freq      = total > 0 ? Math.round((presentes / total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Escala',    value: total,           icon: Calendar,     color: '#7C3AED', bg: '#F5F3FF' },
        { label: 'Presença',  value: presentes,       icon: CheckCircle,  color: '#059669', bg: '#ECFDF5' },
        { label: 'Frequência',value: `${freq}%`,      icon: TrendingUp,   color: '#FF4D0C', bg: '#FFF2EE' },
      ].map((k, i) => (
        <div key={i} className="stat-card">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: k.bg }}>
              <k.icon size={16} style={{ color: k.color }} />
            </div>
          </div>
          <p className="text-2xl font-bold leading-none" style={{ color: k.color }}>{k.value}</p>
          <p className="text-xs mt-2" style={TM}>{k.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Helper list ───────────────────────────────────────────────────────────────

function HelperList({ records, showStatus }) {
  if (records.length === 0) {
    return (
      <div className="py-10 text-center">
        <Users size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
        <p className="text-sm" style={TM}>Nenhum ajudante escalado</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 grid text-xs font-semibold"
        style={{ gridTemplateColumns: '1fr 1fr auto auto', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
        <span>Ajudante</span><span>Serviço</span><span>Empresa</span>{showStatus && <span>Status</span>}
      </div>
      {records.map(r => {
        const emp = EMPLOYEES.find(e => e.id === r.employeeId);
        const comp = WORK_RECORDS && r.companyId;
        const compName = ['c1','c2','c3'].map(id => ({ id, label: ['LogTech','FastMove','TransBR'][['c1','c2','c3'].indexOf(id)] }))
          .find(c => c.id === r.companyId)?.label ?? r.companyId;
        const statusColor = r.status === 'active' ? '#059669' : r.status === 'scheduled' ? '#D97706' : r.status === 'absent' ? '#DC2626' : '#94A3B8';
        const statusLabel = r.status === 'active' ? 'Em serviço' : r.status === 'scheduled' ? 'Agendado' : r.status === 'absent' ? 'Falta' : 'Concluído';

        return (
          <div key={r.id} className="table-row" style={{ gridTemplateColumns: '1fr 1fr auto auto', gap: '16px' }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="avatar flex-shrink-0"
                style={{ background: emp?.color ?? '#94A3B8', width: '32px', height: '32px', borderRadius: '8px', fontSize: '10px' }}>
                {emp?.initials ?? '??'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={T}>{emp?.name ?? 'Desconhecido'}</p>
                {r.checkIn && <p className="text-xs" style={TM}><Clock size={9} className="inline mr-1" />{r.checkIn}</p>}
              </div>
            </div>
            <span className="text-xs" style={T2}>{r.service}</span>
            <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: '#F1F5F9', color: '#475569', whiteSpace: 'nowrap' }}>{compName}</span>
            {showStatus && (
              <span className="text-xs font-semibold" style={{ color: statusColor, whiteSpace: 'nowrap' }}>{statusLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-aba: Hoje ─────────────────────────────────────────────────────────────

function SubHoje() {
  const todayRecords = WORK_RECORDS.filter(r => r.date === TODAY);
  const active = todayRecords.filter(r => r.status === 'active');

  return (
    <div className="space-y-4">
      <EscalaKPIs records={todayRecords} />
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Ajudantes em serviço agora</p>
        <HelperList records={active} showStatus={false} />
      </div>
    </div>
  );
}

// ── Sub-aba: Próximas Escalas ─────────────────────────────────────────────────

function SubProximas() {
  const futureDates = [...new Set(
    WORK_RECORDS
      .filter(r => r.date > TODAY && r.status === 'scheduled')
      .map(r => r.date)
  )].sort();

  if (futureDates.length === 0) {
    return (
      <div className="py-14 text-center">
        <Calendar size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
        <p className="text-sm" style={TM}>Nenhuma escala futura lançada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {futureDates.map(date => {
        const records = WORK_RECORDS.filter(r => r.date === date && r.status === 'scheduled');
        return (
          <div key={date} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF4D0C' }} />
              <p className="text-sm font-semibold capitalize" style={T}>{dateLabel(date)}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#FFF2EE', color: '#FF4D0C' }}>
                {records.length} escalado{records.length !== 1 ? 's' : ''}
              </span>
            </div>
            <EscalaKPIs records={records} />
            <HelperList records={records} showStatus={true} />
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-aba: Histórico ────────────────────────────────────────────────────────

function SubHistorico() {
  const [search, setSearch] = useState('');

  const past = WORK_RECORDS
    .filter(r => r.date < TODAY && r.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  const filtered = search
    ? past.filter(r => {
        const emp = EMPLOYEES.find(e => e.id === r.employeeId);
        return emp?.name.toLowerCase().includes(search.toLowerCase()) ||
               r.service.toLowerCase().includes(search.toLowerCase()) ||
               r.date.includes(search);
      })
    : past;

  const compLabel = id => ({ c1: 'LogTech', c2: 'FastMove', c3: 'TransBR' }[id] ?? id);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input className="input-field pl-9" placeholder="Buscar por nome, serviço ou data..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 grid text-xs font-semibold"
          style={{ gridTemplateColumns: 'auto 1fr 1fr auto auto', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
          <span>Data</span><span>Ajudante</span><span>Serviço</span><span>Empresa</span><span>Valor</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Clock size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={TM}>Nenhum registro encontrado</p>
          </div>
        ) : (
          filtered.map(r => {
            const emp = EMPLOYEES.find(e => e.id === r.employeeId);
            return (
              <div key={r.id} className="table-row" style={{ gridTemplateColumns: 'auto 1fr 1fr auto auto', gap: '16px' }}>
                <span className="text-xs font-medium" style={{ color: '#64748B', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="avatar flex-shrink-0"
                    style={{ background: emp?.color ?? '#94A3B8', width: '28px', height: '28px', borderRadius: '7px', fontSize: '10px' }}>
                    {emp?.initials ?? '??'}
                  </div>
                  <span className="text-xs font-semibold truncate" style={T}>{emp?.name ?? '—'}</span>
                </div>
                <span className="text-xs truncate" style={T2}>{r.service}</span>
                <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: '#F1F5F9', color: '#475569', whiteSpace: 'nowrap' }}>
                  {compLabel(r.companyId)}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#059669', whiteSpace: 'nowrap' }}>{fmtCurrency(r.value)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Aba Escalas ───────────────────────────────────────────────────────────────

function EscalasTab() {
  const [sub, setSub] = useState('hoje');

  const SUBS = [
    { key: 'hoje',     label: 'Hoje' },
    { key: 'proximas', label: 'Próximas Escalas' },
    { key: 'historico',label: 'Histórico' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(0,0,0,0.05)' }}>
        {SUBS.map(s => (
          <button key={s.key} onClick={() => setSub(s.key)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={sub === s.key
              ? { background: '#fff', color: '#FF4D0C', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
              : { color: '#64748B' }}>
            {s.label}
          </button>
        ))}
      </div>

      {sub === 'hoje'      && <SubHoje />}
      {sub === 'proximas'  && <SubProximas />}
      {sub === 'historico' && <SubHistorico />}
    </div>
  );
}

// ── Aba Empresas ──────────────────────────────────────────────────────────────

function EmpresasTab({ companies, setCompanies }) {
  const [modal, setModal]               = useState(null);
  const [search, setSearch]             = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search) ||
    c.contact.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (form) => {
    if (modal === 'new') {
      setCompanies([...companies, { ...form, id: `c${Date.now()}`, password: form.password || '123456' }]);
    } else {
      setCompanies(companies.map(c => c.id === modal.id ? { ...c, ...form, password: form.password || c.password } : c));
    }
    setModal(null);
  };

  const getStats = (id) => ({
    paid:   PAYMENTS.filter(p => p.companyId === id && p.status === 'paid').reduce((s, p) => s + getPayAmount(p), 0), // uses module-level helper
    active: WORK_RECORDS.filter(r => r.companyId === id && r.date === TODAY && r.status === 'active').length,
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs" style={TM}>{companies.length} empresas cadastradas</p>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Nova Empresa
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input className="input-field pl-9" placeholder="Buscar por nome, CNPJ ou responsável..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 grid text-xs font-semibold"
          style={{ gridTemplateColumns: '1fr auto auto auto auto', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
          <span>Empresa</span><span>Setor</span><span>Hoje</span><span>Faturado</span><span>Ações</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Building2 size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={TM}>Nenhuma empresa encontrada</p>
          </div>
        ) : (
          filtered.map(c => {
            const stats = getStats(c.id);
            return (
              <div key={c.id} className="table-row" style={{ gridTemplateColumns: '1fr auto auto auto auto', gap: '16px' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#FF4D0C,#E03A00)', width: '36px', height: '36px', borderRadius: '10px', fontSize: '11px' }}>
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={T}>{c.name}</p>
                    <div className="flex gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs" style={TM}><Phone size={9} />{c.phone}</span>
                      <span className="flex items-center gap-1 text-xs" style={TM}><Mail size={9} />{c.email}</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: '#F1F5F9', color: '#475569' }}>{c.sector}</span>
                <span className="text-xs font-semibold" style={{ color: stats.active > 0 ? '#059669' : '#94A3B8' }}>
                  {stats.active} ativo{stats.active !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#FF4D0C' }}>{fmtCurrency(stats.paid)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal(c)} className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#94A3B8', background: '#F1F5F9' }}><Edit2 size={13} /></button>
                  <button onClick={() => setDeleteConfirm(c.id)} className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#94A3B8', background: '#F1F5F9' }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(modal === 'new' || (modal && modal !== 'new')) && (
        <Modal company={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box max-w-sm animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={T}>Remover empresa?</h3>
            <p className="text-sm mb-5" style={T2}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => { setCompanies(companies.filter(c => c.id !== deleteConfirm)); setDeleteConfirm(null); }}
                className="btn-danger flex-1 py-2.5">Remover</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'empresas', label: 'Empresas', icon: Building2 },
  { key: 'escalas',  label: 'Escalas',  icon: Calendar },
];

export default function AdminCompanies() {
  const { companies, setCompanies } = useAuth();
  const [tab, setTab] = useState('empresas');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-bold" style={T}>Empresas</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 animate-fade-up delay-1" style={{ borderBottom: '2px solid rgba(0,0,0,0.06)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all -mb-0.5"
            style={tab === t.key
              ? { color: '#FF4D0C', borderBottom: '2px solid #FF4D0C' }
              : { color: '#94A3B8', borderBottom: '2px solid transparent' }}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 animate-fade-up delay-2">
        {tab === 'empresas' && <EmpresasTab companies={companies} setCompanies={setCompanies} />}
        {tab === 'escalas'  && <EscalasTab />}
      </div>
    </div>
  );
}
