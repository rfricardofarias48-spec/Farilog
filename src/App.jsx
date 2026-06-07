import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import EmployeeLayout from './layouts/EmployeeLayout';
import CompanyLayout from './layouts/CompanyLayout';
import AdminLayout from './layouts/AdminLayout';
import LiderLayout from './layouts/LiderLayout';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import CompanyDashboard from './pages/company/CompanyDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminFinanceiro from './pages/admin/AdminFinanceiro';
import AdminDemanda from './pages/admin/AdminDemanda';
import AdminOperacional from './pages/admin/AdminOperacional';
import LiderDashboard from './pages/lider/LiderDashboard';
import AdminLideres from './pages/admin/AdminLideres';
import AdminRH from './pages/admin/AdminRH';
import AdminSolicitacoes from './pages/admin/AdminSolicitacoes';

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
        <Route path="companies"    element={<AdminCompanies />} />
        <Route path="employees"    element={<AdminEmployees />} />
        <Route path="financeiro"   element={<AdminFinanceiro />} />
        <Route path="demanda"      element={<AdminDemanda />} />
        <Route path="operacional"  element={<AdminOperacional />} />
        <Route path="lideres"      element={<AdminLideres />} />
        <Route path="rh"           element={<AdminRH />} />
        <Route path="solicitacoes" element={<AdminSolicitacoes />} />
      </Route>
      <Route path="/lider" element={
        <ProtectedRoute allowedRole="lider"><LiderLayout /></ProtectedRoute>
      }>
        <Route index element={<LiderDashboard />} />
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
