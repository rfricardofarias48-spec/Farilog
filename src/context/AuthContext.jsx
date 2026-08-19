import { createContext, useContext, useState, useEffect } from 'react';
import {
  loginAdmin, loginCompany,
  fetchEmployees, fetchCompanies, fetchDemands,
  createDemand, updateDemandEmployeeStatus, updateDemandEmployeeTimes, updateDemandAllTimes, deleteDemand, archiveDemand, editDemand,
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

  const addDemand = async ({ companyId, date, time, service, employeeIds, tipoServico, entrada, saida, saidaAlmoco, retornoAlmoco, employeeTimes }) => {
    const saved = await createDemand({
      companyId, date, time: time || entrada || '07:30', service, employeeIds,
      adminId: user?.id ?? null, liderId: null, tipoServico,
      entrada, saida, saidaAlmoco, retornoAlmoco, employeeTimes,
    });
    if (saved) {
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

  const updateDemandTimes = async (demandId, employeeId, times) => {
    setDemands(prev => prev.map(d =>
      d.id === demandId
        ? { ...d, employees: d.employees.map(e => {
            if (e.employeeId !== employeeId) return e;
            const updated = { ...e, ...times };
            if (times.saida) {
              updated.status = 'finalizado';
            } else if (times.entrada) {
              updated.status = 'confirmado';
            }
            return updated;
          })}
        : d
    ));
    await updateDemandEmployeeTimes(demandId, employeeId, times);
  };

  const updateDemandAllEmployeesTimes = async (demandId, times) => {
    setDemands(prev => prev.map(d =>
      d.id === demandId
        ? { ...d, employees: d.employees.map(e => {
            const updated = { ...e, ...times };
            if (times.saida) {
              updated.status = 'finalizado';
            } else if (times.entrada) {
              updated.status = 'confirmado';
            }
            return updated;
          })}
        : d
    ));
    await updateDemandAllTimes(demandId, times);
  };

  const removeDemand = async (id) => {
    setDemands(prev => prev.filter(d => d.id !== id));
    return await deleteDemand(id);
  };

  const archiveDemandFromList = async (id) => {
    setDemands(prev => prev.filter(d => d.id !== id));
    return await archiveDemand(id);
  };

  const changeDemand = async (id, form) => {
    const ok = await editDemand(id, { ...form, liderId: null, tipoServico: form.tipoServico });
    if (ok) {
      const company = companies.find(c => c.id === form.companyId);
      setDemands(prev => prev.map(d =>
        d.id === id
          ? {
              ...d,
              companyId:   form.companyId,
              companyName: company?.name ?? d.companyName,
              date:        form.date,
              time:        form.time || form.entrada || d.time,
              service:     form.service,
              tipoServico: form.tipoServico || d.tipoServico,
              employees:   form.selectedEmployees.map(eId => {
                const existing = d.employees.find(e => e.employeeId === eId);
                const custom = form.employeeTimes?.[eId] || {};
                const entrada = custom.entrada !== undefined ? custom.entrada : (form.entrada ?? existing?.entrada ?? null);
                const saida   = custom.saida   !== undefined ? custom.saida   : (form.saida   ?? existing?.saida   ?? null);
                const saidaAlmoco   = custom.saidaAlmoco   !== undefined ? custom.saidaAlmoco   : (form.saidaAlmoco   ?? existing?.saidaAlmoco   ?? null);
                const retornoAlmoco = custom.retornoAlmoco !== undefined ? custom.retornoAlmoco : (form.retornoAlmoco ?? existing?.retornoAlmoco ?? null);
                const status = saida ? 'finalizado' : entrada ? 'confirmado' : (existing?.status ?? 'aguardando');

                return {
                  employeeId: eId,
                  status,
                  entrada,
                  saidaAlmoco,
                  retornoAlmoco,
                  saida,
                };
              }),
            }
          : d
      ));
    }
    return ok;
  };

  const login = async (email, password) => {
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
      demands, addDemand, updateDemandStatus, updateDemandTimes, updateDemandAllEmployeesTimes, removeDemand, archiveDemandFromList, changeDemand,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
