import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Building2, Users, Menu, ChevronLeft, DollarSign, ClipboardList } from 'lucide-react';

const NAV = [
  { path: '/admin',            label: 'Visão Geral',    icon: LayoutDashboard, exact: true },
  { path: '/admin/companies',  label: 'Empresas',        icon: Building2 },
  { path: '/admin/employees',  label: 'Funcionários',    icon: Users },
  { path: '/admin/financeiro', label: 'Financeiro',      icon: DollarSign },
  { path: '/admin/demanda',    label: 'Lançar Demanda',  icon: ClipboardList },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen flex" style={{ background: '#EEF1F5' }}>
      {/* Sidebar — dark */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-full z-50 transition-all duration-300 ${open ? 'w-56' : 'w-16'}`}
        style={{ background: '#111827', borderRight: 'none' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
            alt="FariLog"
            style={{ height: open ? '90px' : '40px', objectFit: 'contain', transition: 'height 0.3s, transform 0.3s', maxWidth: '100%', transform: open ? 'scale(1.85)' : 'scale(1)', transformOrigin: 'center' }}
          />
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
        {/* Top bar */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5"
          style={{ background: '#EEF1F5', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <button onClick={() => setOpen(!open)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#94A3B8', background: 'rgba(0,0,0,0.04)' }}>
            {open ? <ChevronLeft size={17} /> : <Menu size={17} />}
          </button>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium" style={{ color: '#64748B' }}>Admin</span>
            <div className="avatar w-8 h-8 rounded-full text-xs" style={{ background: 'linear-gradient(135deg,#FF4D0C,#E03A00)', width: '32px', height: '32px', borderRadius: '50%' }}>
              {user?.initials}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
