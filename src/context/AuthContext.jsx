import { createContext, useContext, useState, useEffect } from 'react';
import {
  loginAdmin, loginEmployee, loginCompany,
  fetchEmployees, fetchCompanies, fetchDemands,
  createDemand, updateDemandEmployeeStatus,
} from '../lib/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [demands, setDemands]     = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchCompanies(), fetchDemands()])
      .then(([emps, cos, dems]) => {
        setEmployees(emps);
        setCompanies(cos);
        setDemands(dems);
      })
      .finally(() => setLoading(false));
  }, []);

  const addDemand = async ({ companyId, date, time, service, employeeIds, adminId }) => {
    const saved = await createDemand({ companyId, date, time, service, employeeIds, adminId });
    if (saved) {
      // attach companyName for display
      const company = companies.find(c => c.id === companyId);
      setDemands(prev => [{ ...saved, companyName: company?.name }, ...prev]);
    }
    return saved;
  };

  const updateDemandStatus = async (demandId, employeeId, status) => {
    // Optimistic update
    setDemands(prev => prev.map(d =>
      d.id === demandId
        ? { ...d, employees: d.employees.map(e =>
            e.employeeId === employeeId ? { ...e, status } : e
          )}
        : d
    ));
    await updateDemandEmployeeStatus(demandId, employeeId, status);
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
