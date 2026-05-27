import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export default function EmployeeLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#EEF1F5' }}>
      <header
        className="sticky top-0 z-40 px-4 py-1"
        style={{ background: '#111827', borderBottom: 'none' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
            alt="FariLog"
            style={{ height: '120px', objectFit: 'contain' }}
          />
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="avatar" style={{ background: user?.color || '#FF4D0C', width: '22px', height: '22px', borderRadius: '6px', fontSize: '9px' }}>
                {user?.initials}
              </div>
              <span className="text-xs font-semibold" style={{ color: '#F1F5F9' }}>{user?.name?.split(' ')[0]}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: '#94A3B8', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
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
