import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Users, ClipboardList, UserPlus, DollarSign, Bell, UserSearch, Banknote } from 'lucide-react';

const NAV = [
  { path: '/rh',               label: 'Tarefas',       icon: ClipboardList, exact: true },
  { path: '/rh/solicitacoes',  label: 'Solicitações',  icon: Bell },
  { path: '/rh/recrutamento',  label: 'Recrutamento',  icon: UserSearch },
  { path: '/rh/banco',         label: 'Banco',         icon: Users },
  { path: '/rh/admissao',      label: 'Admissão',      icon: UserPlus },
  { path: '/rh/beneficios',    label: 'Benefícios',    icon: DollarSign },
  { path: '/rh/folha',         label: 'Folha',         icon: Banknote },
];

export default function RHLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex" style={{ background: '#EEF1F5' }}>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 z-50"
        style={{ background: '#111827' }}>
        <div className="flex items-center justify-center" style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <img src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
            alt="FariLog" style={{ height: '90px', objectFit: 'contain', transform: 'scale(1.85)', transformOrigin: 'center', maxWidth: '100%' }} />
        </div>
        <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: '#374151', textTransform: 'uppercase', padding: '20px 16px 8px' }}>RH</p>
        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(({ path, label, icon: Icon, exact }) => (
            <NavLink key={path} to={path} end={exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Icon size={17} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold" style={{ color: '#F1F5F9' }}>{user?.name}</p>
            <p className="text-xs" style={{ color: '#374151' }}>RH</p>
          </div>
          <button onClick={() => { logout(); navigate('/'); }}
            className="sidebar-link w-full hover:text-red-400" style={{ color: '#4B5563', border: 'none', background: 'none' }}>
            <LogOut size={17} className="flex-shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Header mobile */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{ background: '#111827', height: '56px' }}>
        <img src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
          alt="FariLog" style={{ height: '70px', objectFit: 'contain' }} />
        <div className="flex items-center gap-2">
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white' }}>
            {user?.initials}
          </div>
          <button onClick={() => { logout(); navigate('/'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col md:ml-56">
        <main className="flex-1 p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ background: 'white', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
        {NAV.map(({ path, label, icon: Icon, exact }) => (
          <NavLink key={path} to={path} end={exact}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              padding: '10px 4px', fontSize: '10px', fontWeight: 600, textDecoration: 'none',
              color: isActive ? '#FF4D0C' : '#94A3B8',
              borderTop: isActive ? '2px solid #FF4D0C' : '2px solid transparent',
            })}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
