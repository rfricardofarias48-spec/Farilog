import { createContext, useContext, useState, useEffect } from 'react';
import {
  loginAdmin, loginEmployee, loginCompany, loginLider, loginRH,
  fetchEmployees, fetchCompanies, fetchDemands,
  createDemand, updateDemandEmployeeStatus, deleteDemand, editDemand,
  fetchTarefasRH, createTarefaRH, concluirTarefaRH,
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

  const addDemand = async ({ companyId, date, time, service, employeeIds }) => {
    const saved = await createDemand({ companyId, date, time, service, employeeIds, adminId: user?.id ?? null });
    if (saved) {
      // attach companyName for display
      const company = companies.find(c => c.id === companyId);
      setDemands(prev => [{ ...saved, companyName: company?.name }, ...prev]);
    }
    return saved;
  };

  const updateDemandStatus = async (demandId, employeeId, status) => {
    setDemands(prev => prev.map(d =>
      d.id === demandId
        ? { ...d, employees: d.employees.map(e =>
            e.employeeId === employeeId ? { ...e, status } : e
          )}
        : d
    ));
    await updateDemandEmployeeStatus(demandId, employeeId, status);
  };

  const removeDemand = async (id) => {
    setDemands(prev => prev.filter(d => d.id !== id));
    return await deleteDemand(id);
  };

  const changeDemand = async (id, form) => {
    const ok = await editDemand(id, form);
    if (ok) {
      const company = companies.find(c => c.id === form.companyId);
      setDemands(prev => prev.map(d =>
        d.id === id
          ? {
              ...d,
              companyId:   form.companyId,
              companyName: company?.name ?? d.companyName,
              date:        form.date,
              time:        form.time,
              service:     form.service,
              employees:   form.selectedEmployees.map(eId => ({
                employeeId: eId,
                status: d.employees.find(e => e.employeeId === eId)?.status ?? 'aguardando',
                entrada: d.employees.find(e => e.employeeId === eId)?.entrada ?? null,
                saidaAlmoco: d.employees.find(e => e.employeeId === eId)?.saidaAlmoco ?? null,
                retornoAlmoco: d.employees.find(e => e.employeeId === eId)?.retornoAlmoco ?? null,
                saida: d.employees.find(e => e.employeeId === eId)?.saida ?? null,
              })),
            }
          : d
      ));
    }
    return ok;
  };

  const login = async (email, password) => {
    const emp = await loginEmployee(email, password);
    if (emp) { setUser({ role: 'employee', ...emp }); return { success: true, role: 'employee' }; }

    const co = await loginCompany(email, password);
    if (co) { setUser({ role: 'company', ...co }); return { success: true, role: 'company' }; }

    const admin = await loginAdmin(email, password);
    if (admin) { setUser({ role: 'admin', ...admin }); return { success: true, role: 'admin' }; }

    const lider = await loginLider(email, password);
    if (lider) { setUser({ role: 'lider', ...lider }); return { success: true, role: 'lider' }; }

    const rh = await loginRH(email, password);
    if (rh) { setUser({ role: 'rh', ...rh }); return { success: true, role: 'rh' }; }

    return { success: false, error: 'E-mail ou senha inválidos' };
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{
      user, login, logout, loading,
      employees, setEmployees,
      companies, setCompanies,
      demands, addDemand, updateDemandStatus, removeDemand, changeDemand,
      createTarefaRH, concluirTarefaRH, fetchTarefasRH,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
