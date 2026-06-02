import { createContext, useContext, useState, useEffect } from 'react';
import { loginAdmin, loginEmployee, loginCompany, fetchEmployees, fetchCompanies } from '../lib/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [demands, setDemands]     = useState([]);

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchCompanies()])
      .then(([emps, cos]) => {
        setEmployees(emps);
        setCompanies(cos);
      })
      .finally(() => setLoading(false));
  }, []);

  const addDemand = (demand) => setDemands(prev => [demand, ...prev]);

  const updateDemandStatus = (demandId, employeeId, status) => {
    setDemands(prev => prev.map(d =>
      d.id === demandId
        ? { ...d, employees: d.employees.map(e =>
            e.employeeId === employeeId ? { ...e, status } : e
          )}
        : d
    ));
  };

  const login = async (email, password) => {
    const emp = await loginEmployee(email, password);
    if (emp) { setUser({ role: 'employee', ...emp }); return { success: true, role: 'employee' }; }

    const co = await loginCompany(email, password);
    if (co) { setUser({ role: 'company', ...co }); return { success: true, role: 'company' }; }

    const admin = await loginAdmin(email, password);
    if (admin) { setUser({ role: 'admin', ...admin }); return { success: true, role: 'admin' }; }

    return { success: false, error: 'E-mail ou senha inválidos' };
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{
      user, login, logout, loading,
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
