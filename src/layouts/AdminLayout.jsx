import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Building2, Users, ChevronLeft, ChevronRight, DollarSign, ClipboardList, Search, Bell, Briefcase } from 'lucide-react';

const PAGE_TITLES = {
  '/admin':              'Visão Geral',
  '/admin/companies':    'Empresas',
  '/admin/employees':    'Funcionários',
  '/admin/financeiro':   'Financeiro',
  '/admin/demanda':      'Lançar Demanda',
  '/admin/operacional':  'Operacional',
};

const NAV = [
  { path: '/admin',              label: 'Visão Geral',   icon: LayoutDashboard, exact: true },
  { path: '/admin/companies',    label: 'Empresas',       icon: Building2 },
  { path: '/admin/employees',    label: 'Funcionários',   icon: Users },
  { path: '/admin/financeiro',   label: 'Financeiro',     icon: DollarSign },
  { path: '/admin/operacional',  label: 'Operacional',    icon: Briefcase },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Painel';

  return (
    <div className="min-h-screen flex" style={{ background: '#EEF1F5' }}>
      {/* Sidebar — dark */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-full z-50 transition-all duration-300 ${open ? 'w-56' : 'w-16'}`}
        style={{ background: '#111827', borderRight: 'none' }}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-center overflow-hidden" style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
            alt="FariLog"
            style={{ height: open ? '90px' : '40px', objectFit: 'contain', transition: 'height 0.3s, transform 0.3s', maxWidth: '100%', transform: open ? 'scale(1.85)' : 'scale(1)', transformOrigin: 'center' }}
          />
          <button
            onClick={() => setOpen(!open)}
            style={{
              position: 'absolute', top: '10px', right: '-10px', zIndex: 60,
              width: '20px', height: '20px', borderRadius: '50%',
              background: '#1E293B', border: '1.5px solid #374151',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#9CA3AF',
            }}
          >
            {open ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
          </button>
        </div>

        {/* Menu label */}
        {open && (
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: '#374151', textTransform: 'uppercase', padding: '20px 16px 8px' }}>
            Menu
          </p>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-1" style={{ paddingTop: open ? 0 : '16px' }}>
          {NAV.map(({ path, label, icon: Icon, exact }) => (
            <NavLink key={path} to={path} end={exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!open ? 'justify-center px-0' : ''}`}>
              <Icon size={17} className="flex-shrink-0" />
              {open && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {open && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-semibold" style={{ color: '#F1F5F9' }}>{user?.name}</p>
              <p className="text-xs" style={{ color: '#374151' }}>Administrador</p>
            </div>
          )}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className={`sidebar-link w-full hover:text-red-400 ${!open ? 'justify-center px-0' : ''}`}
            style={{ color: '#4B5563' }}
          >
            <LogOut size={17} className="flex-shrink-0" />
            {open && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${open ? 'md:ml-56' : 'md:ml-16'}`}>
        <main className="flex-1 p-6">
          {/* Barra utilitária inline — sem altura de header */}
          <div className="flex items-center justify-between mb-5" style={{ paddingLeft: '20px' }}>
            <span className="font-semibold text-sm" style={{ color: '#1E293B' }}>{pageTitle}</span>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-4 py-1.5 rounded-lg outline-none"
                  style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.07)', color: '#1E293B', fontSize: '13px', width: '200px' }}
                />
              </div>
              <button className="p-1.5 rounded-lg relative" style={{ background: 'rgba(0,0,0,0.04)', color: '#64748B' }}>
                <Bell size={15} />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: '#FF4D0C' }} />
              </button>
              <div className="avatar text-xs flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#FF4D0C,#E03A00)', width: '30px', height: '30px', borderRadius: '50%' }}>
                {user?.initials}
              </div>
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
