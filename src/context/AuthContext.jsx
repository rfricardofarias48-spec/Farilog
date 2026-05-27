import { createContext, useContext, useState } from 'react';
import { EMPLOYEES, COMPANIES, ADMIN_USER } from '../data/mockData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState(EMPLOYEES);
  const [companies, setCompanies] = useState(COMPANIES);

  // ── Demandas compartilhadas entre admin, empresa e ajudante ──────────────
  const [demands, setDemands] = useState([]);

  const addDemand = (demand) => setDemands(prev => [demand, ...prev]);

  // Atualiza o status de um ajudante dentro de uma demanda
  const updateDemandStatus = (demandId, employeeId, status) => {
    setDemands(prev => prev.map(d =>
      d.id === demandId
        ? { ...d, employees: d.employees.map(e =>
            e.employeeId === employeeId ? { ...e, status } : e
          )}
        : d
    ));
  };

  // Auto-detect role from credentials
  const login = (email, password) => {
    const emp = employees.find(e => e.email === email && e.password === password);
    if (emp) { setUser({ role: 'employee', ...emp }); return { success: true, role: 'employee' }; }

    const co = companies.find(c => c.email === email && c.password === password);
    if (co) { setUser({ role: 'company', ...co }); return { success: true, role: 'company' }; }

    if (ADMIN_USER.email === email && ADMIN_USER.password === password) {
      setUser({ role: 'admin', ...ADMIN_USER });
      return { success: true, role: 'admin' };
    }

    return { success: false, error: 'E-mail ou senha inválidos' };
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      employees, setEmployees,
      companies, setCompanies,
      demands, addDemand, updateDemandStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
