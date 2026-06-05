import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import EmployeeLayout from './layouts/EmployeeLayout';
import CompanyLayout from './layouts/CompanyLayout';
import AdminLayout from './layouts/AdminLayout';
import LiderLayout from './layouts/LiderLayout';
import RHLayout from './layouts/RHLayout';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import CompanyDashboard from './pages/company/CompanyDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminFinanceiro from './pages/admin/AdminFinanceiro';
import AdminDemanda from './pages/admin/AdminDemanda';
import AdminOperacional from './pages/admin/AdminOperacional';
import LiderDashboard from './pages/lider/LiderDashboard';
import RHTarefas from './pages/rh/RHTarefas';
import RHBanco from './pages/rh/RHBanco';
import RHAdmissao from './pages/rh/RHAdmissao';
import RHBeneficios from './pages/rh/RHBeneficios';
import RHSolicitacoes from './pages/rh/RHSolicitacoes';
import AdminLideres from './pages/admin/AdminLideres';
import AdminRHUsers from './pages/admin/AdminRHUsers';
import AdminOcorrencias from './pages/admin/AdminOcorrencias';

function ProtectedRoute({ children, allowedRole }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== allowedRole) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/employee" element={
        <ProtectedRoute allowedRole="employee"><EmployeeLayout /></ProtectedRoute>
      }>
        <Route index element={<EmployeeDashboard />} />
      </Route>
      <Route path="/company" element={
        <ProtectedRoute allowedRole="company"><CompanyLayout /></ProtectedRoute>
      }>
        <Route index element={<CompanyDashboard />} />
      </Route>
      <Route path="/admin" element={
        <ProtectedRoute allowedRole="admin"><AdminLayout /></ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="companies" element={<AdminCompanies />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="financeiro"   element={<AdminFinanceiro />} />
        <Route path="demanda"     element={<AdminDemanda />} />
        <Route path="operacional" element={<AdminOperacional />} />
        <Route path="lideres"      element={<AdminLideres />} />
        <Route path="rh-users"    element={<AdminRHUsers />} />
        <Route path="ocorrencias" element={<AdminOcorrencias />} />
      </Route>
      <Route path="/lider" element={
        <ProtectedRoute allowedRole="lider"><LiderLayout /></ProtectedRoute>
      }>
        <Route index element={<LiderDashboard />} />
      </Route>
      <Route path="/rh" element={
        <ProtectedRoute allowedRole="rh"><RHLayout /></ProtectedRoute>
      }>
        <Route index element={<RHTarefas />} />
        <Route path="solicitacoes" element={<RHSolicitacoes />} />
        <Route path="banco"        element={<RHBanco />} />
        <Route path="admissao"     element={<RHAdmissao />} />
        <Route path="beneficios"   element={<RHBeneficios />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
