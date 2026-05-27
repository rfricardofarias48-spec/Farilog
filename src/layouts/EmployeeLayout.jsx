import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export default function EmployeeLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#EEF1F5' }}>
      <header
        className="sticky top-0 z-40 px-4 py-3.5"
        style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center px-5 py-2.5 rounded-xl" style={{ background: '#111827' }}>
            <img
              src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
              alt="FariLog"
              style={{ height: '52px', objectFit: 'contain' }}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="avatar" style={{ background: user?.color || '#FF4D0C', width: '22px', height: '22px', borderRadius: '6px', fontSize: '9px' }}>
                {user?.initials}
              </div>
              <span className="text-xs font-semibold" style={{ color: '#475569' }}>{user?.name?.split(' ')[0]}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: '#94A3B8', background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
