import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, LayoutDashboard, Building2, ChevronLeft, ChevronRight,
  DollarSign, ClipboardList, Search, Bell, Briefcase, Activity,
  BarChart2, ChevronDown, Users, Heart, Clock, Shield,
  TrendingUp, CreditCard, Wallet, FileText, UserCheck, MessageCircle,
} from 'lucide-react';

const OP_TABS = [
  { key: 'resumo',       label: 'Resumo do Dia',          icon: Activity },
  { key: 'convocacao',   label: 'Convocação',             icon: MessageCircle },
  { key: 'historico',    label: 'Histórico',              icon: ClipboardList },
  { key: 'relatorios',   label: 'Relatórios',             icon: BarChart2 },
  { key: 'encarregados', label: 'Encarregados',           icon: UserCheck },
];

const RH_TABS = [
  { key: 'funcionarios', label: 'Funcionários',      icon: Users },
  { key: 'beneficios',   label: 'Benefícios',        icon: Heart },
  { key: 'ponto',        label: 'Controle de Ponto', icon: Clock },
  { key: 'epi',          label: 'EPI',               icon: Shield },
];

const FIN_TABS = [
  { key: 'visao',   label: 'Visão Geral',        icon: BarChart2  },
  { key: 'fluxo',   label: 'Fluxo de Caixa',     icon: TrendingUp },
  { key: 'folha',   label: 'Folha de Pagamento', icon: Users      },
  { key: 'dividas', label: 'Endividamento',      icon: CreditCard },
  { key: 'custos',  label: 'Custos Fixos',       icon: Wallet     },
  { key: 'dre',     label: 'DRE',                icon: FileText   },
];

const OP_TAB_LABELS  = Object.fromEntries(OP_TABS.map(t => [t.key, t.label]));
const RH_TAB_LABELS  = Object.fromEntries(RH_TABS.map(t => [t.key, t.label]));
const FIN_TAB_LABELS = Object.fromEntries(FIN_TABS.map(t => [t.key, t.label]));

const PAGE_TITLES = {
  '/admin':            'Visão Geral',
  '/admin/companies':  'Empresas',
  '/admin/financeiro': 'Financeiro',
  '/admin/operacional':'Operacional',
  '/admin/rh':         'RH',
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');

  const isOperacional = location.pathname === '/admin/operacional';
  const isRH          = location.pathname === '/admin/rh';
  const isFinanceiro  = location.pathname === '/admin/financeiro';
  const rawOpTab      = searchParams.get('tab') || 'resumo';
  // "demanda" foi unificada em "convocação": links antigos continuam válidos.
  const activeOpTab   = rawOpTab === 'demanda' ? 'convocacao' : rawOpTab;
  const activeRHTab   = searchParams.get('tab') || 'funcionarios';
  const activeFinTab  = searchParams.get('tab') || 'visao';

  const baseTitle = PAGE_TITLES[location.pathname] ?? 'Painel';
  const pageTitle = isOperacional
    ? (OP_TAB_LABELS[activeOpTab]  ?? 'Operacional')
    : isRH
    ? (RH_TAB_LABELS[activeRHTab]  ?? 'RH')
    : isFinanceiro
    ? (FIN_TAB_LABELS[activeFinTab] ?? 'Financeiro')
    : baseTitle;

  const AccordionItem = ({ path, label, icon: Icon, isActive, tabs, activeTab, onTabClick }) => (
    <>
      <button
        onClick={() => navigate(`${path}?tab=${isActive ? activeTab : tabs[0].key}`)}
        className={`sidebar-link w-full ${isActive ? 'active' : ''} ${!open ? 'justify-center px-0' : ''}`}
        style={{ border: 'none', background: 'none' }}
      >
        <Icon size={17} className="flex-shrink-0" />
        {open && (
          <>
            <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
            <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: isActive ? 'rotate(180deg)' : 'none', color: '#6B6B6B' }} />
          </>
        )}
      </button>
      {isActive && open && (
        <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {tabs.map(({ key, label: lbl, icon: TabIcon }) => (
            <button key={key} onClick={() => onTabClick(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 10px', borderRadius: '8px',
                fontSize: '12px', fontWeight: activeTab === key ? 700 : 500,
                color: activeTab === key ? '#FFFFFF' : '#9A9A9A',
                background: activeTab === key ? 'rgba(255,255,255,0.10)' : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (activeTab !== key) e.currentTarget.style.color = '#D1D1D1'; }}
              onMouseLeave={e => { if (activeTab !== key) e.currentTarget.style.color = '#9A9A9A'; }}
            >
              <TabIcon size={13} style={{ flexShrink: 0 }} />
              {lbl}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F5F5' }}>
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-full z-50 transition-all duration-300 ${open ? 'w-56' : 'w-16'}`}
        style={{ background: '#0B0B0B', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-center overflow-hidden" style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
          <img src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png" alt="FariLog"
            style={{ height: open ? '90px' : '40px', objectFit: 'contain', transition: 'height 0.3s, transform 0.3s', maxWidth: '100%', transform: open ? 'scale(1.85)' : 'scale(1)', transformOrigin: 'center' }} />
          <button onClick={() => setOpen(!open)}
            style={{ position: 'absolute', top: '10px', right: '-10px', zIndex: 60, width: '20px', height: '20px', borderRadius: '50%', background: '#1C1C1C', border: '1.5px solid #333333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9A9A9A' }}>
            {open ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
          </button>
        </div>

        {open && <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', color: '#6B6B6B', textTransform: 'uppercase', padding: '20px 16px 8px' }}>Menu</p>}

        <nav className="flex-1 px-2 space-y-1" style={{ paddingTop: open ? 0 : '16px' }}>
          {/* Visão Geral */}
          <NavLink to="/admin" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!open ? 'justify-center px-0' : ''}`}>
            <LayoutDashboard size={17} className="flex-shrink-0" />
            {open && <span>Visão Geral</span>}
          </NavLink>

          {/* Operacional — accordion */}
          <AccordionItem
            path="/admin/operacional"
            label="Operacional"
            icon={Briefcase}
            isActive={isOperacional}
            tabs={OP_TABS}
            activeTab={activeOpTab}
            onTabClick={key => navigate(`/admin/operacional?tab=${key}`)}
          />

          {/* Financeiro — accordion */}
          <AccordionItem
            path="/admin/financeiro"
            label="Financeiro"
            icon={DollarSign}
            isActive={isFinanceiro}
            tabs={FIN_TABS}
            activeTab={activeFinTab}
            onTabClick={key => navigate(`/admin/financeiro?tab=${key}`)}
          />

          {/* RH — accordion */}
          <AccordionItem
            path="/admin/rh"
            label="RH"
            icon={Users}
            isActive={isRH}
            tabs={RH_TABS}
            activeTab={activeRHTab}
            onTabClick={key => navigate(`/admin/rh?tab=${key}`)}
          />

          {/* Empresas */}
          <NavLink to="/admin/companies" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!open ? 'justify-center px-0' : ''}`}>
            <Building2 size={17} className="flex-shrink-0" />
            {open && <span>Empresas</span>}
          </NavLink>
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {open && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-semibold" style={{ color: '#F5F5F5' }}>{user?.name}</p>
              <p className="text-xs" style={{ color: '#6B6B6B' }}>Administrador</p>
            </div>
          )}
          <button onClick={() => { logout(); navigate('/'); }}
            className={`sidebar-link w-full hover:text-white ${!open ? 'justify-center px-0' : ''}`}
            style={{ color: '#4A4A4A' }}>
            <LogOut size={17} className="flex-shrink-0" />
            {open && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <div className={`flex-1 flex flex-col transition-all duration-300 ${open ? 'md:ml-56' : 'md:ml-16'}`}>
        <div className="topbar">
          <div className="flex items-center justify-between mb-5" style={{ padding: '26px 24px 0 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', alignSelf: 'flex-end', paddingBottom: '3px' }}>
              <span style={{ width: '4px', height: '30px', borderRadius: '999px', background: 'linear-gradient(180deg, #BC4A2A 0%, #8C3B4A 100%)', boxShadow: '0 1px 6px rgba(188,74,42,0.35)' }} />
              <span style={{ color: '#0B0B0B', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 }}>{pageTitle}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9A9A9A' }} />
                <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-4 py-2 rounded-xl outline-none"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(11, 11, 11,0.09)', color: '#0B0B0B', fontSize: '13px', width: '220px', boxShadow: '0 1px 2px rgba(11, 11, 11,0.04)', transition: 'border-color 0.18s, box-shadow 0.18s' }}
                  onFocus={e => { e.target.style.borderColor = '#BC4A2A'; e.target.style.boxShadow = '0 0 0 3.5px rgba(188,74,42,0.10)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(11, 11, 11,0.09)'; e.target.style.boxShadow = '0 1px 2px rgba(11, 11, 11,0.04)'; }}
                />
              </div>
              <button className="p-2 rounded-xl relative" style={{ background: '#FFFFFF', border: '1px solid rgba(11, 11, 11,0.09)', color: '#6B6B6B', boxShadow: '0 1px 2px rgba(11, 11, 11,0.04)', transition: 'all 0.18s' }}>
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#BC4A2A', boxShadow: '0 0 6px rgba(188,74,42,0.8)' }} />
              </button>
              <div className="avatar flex items-center justify-center" style={{ background: '#0B0B0B', width: '32px', height: '32px', borderRadius: '50%', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)' }}>
                {user?.initials}
              </div>
            </div>
          </div>
        </div>
        <main className="flex-1 p-6" style={{ paddingTop: '20px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
