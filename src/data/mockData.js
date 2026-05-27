export const EMPLOYEES = [
  { id: 'e1', name: 'Carlos Silva', cpf: '123.456.789-00', phone: '(11) 98765-4321', email: 'carlos@email.com', password: '123456', initials: 'CS', color: '#2563EB', status: 'active', dailyRate: 150, hireDate: '2024-01-15' },
  { id: 'e2', name: 'Pedro Alves', cpf: '987.654.321-00', phone: '(11) 91234-5678', email: 'pedro@email.com', password: '123456', initials: 'PA', color: '#7C3AED', status: 'active', dailyRate: 150, hireDate: '2024-03-01' },
  { id: 'e3', name: 'João Santos', cpf: '456.789.123-00', phone: '(11) 95555-1234', email: 'joao@email.com', password: '123456', initials: 'JS', color: '#059669', status: 'active', dailyRate: 150, hireDate: '2024-02-10' },
  { id: 'e4', name: 'André Ferreira', cpf: '321.654.987-00', phone: '(11) 94444-5678', email: 'andre@email.com', password: '123456', initials: 'AF', color: '#DC2626', status: 'inactive', dailyRate: 150, hireDate: '2023-11-20' },
  { id: 'e5', name: 'Lucas Martins', cpf: '654.321.789-00', phone: '(11) 93333-4567', email: 'lucas@email.com', password: '123456', initials: 'LM', color: '#D97706', status: 'active', dailyRate: 150, hireDate: '2024-04-05' },
  { id: 'e6', name: 'Rafael Costa', cpf: '789.012.345-00', phone: '(11) 92222-3456', email: 'rafael@email.com', password: '123456', initials: 'RC', color: '#0891B2', status: 'active', dailyRate: 150, hireDate: '2024-05-01' },
  { id: 'e7', name: 'Diego Pereira', cpf: '012.345.678-00', phone: '(11) 91111-2345', email: 'diego@email.com', password: '123456', initials: 'DP', color: '#BE185D', status: 'active', dailyRate: 150, hireDate: '2024-04-20' },
];

export const COMPANIES = [
  { id: 'c1', name: 'LogTech Distribuidora', cnpj: '12.345.678/0001-90', email: 'logtech@empresa.com', password: '123456', phone: '(11) 3333-0001', contact: 'João Gomes', address: 'Av. Industrial, 500 - São Paulo/SP', sector: 'Distribuição' },
  { id: 'c2', name: 'FastMove Logística', cnpj: '98.765.432/0001-00', email: 'fastmove@empresa.com', password: '123456', phone: '(11) 3333-0002', contact: 'Maria Souza', address: 'Rua Comercial, 200 - Guarulhos/SP', sector: 'Logística' },
  { id: 'c3', name: 'TransBR Cargo', cnpj: '45.678.912/0001-10', email: 'transbr@empresa.com', password: '123456', phone: '(11) 3333-0003', contact: 'Roberto Lima', address: 'Rod. Anhanguera, km 20 - Campinas/SP', sector: 'Transporte' },
];

export const ADMIN_USER = { id: 'a1', name: 'Ricardo Farias', email: 'admin@farilog.com', password: 'admin123', initials: 'RF' };

// Today: 2026-05-26
export const WORK_RECORDS = [
  // Today - Active
  { id: 'w1',    employeeId: 'e1', companyId: 'c1', date: '2026-05-26', checkIn: '07:30', lunchOut: '12:00', lunchReturn: '13:00', checkOut: null, overtime: '18:30', status: 'active', value: 150, service: 'Separação de mercadoria' },
  { id: 'w2',    employeeId: 'e2', companyId: 'c1', date: '2026-05-26', checkIn: '07:45', lunchOut: '12:10', lunchReturn: '13:05', checkOut: null, overtime: null,    status: 'active', value: 150, service: 'Carga e descarga' },
  { id: 'w3',    employeeId: 'e3', companyId: 'c2', date: '2026-05-26', checkIn: '08:00', lunchOut: null,    lunchReturn: null,    checkOut: null, overtime: null,    status: 'active', value: 150, service: 'Organização de estoque' },
  { id: 'w4',    employeeId: 'e5', companyId: 'c3', date: '2026-05-26', checkIn: '07:15', lunchOut: null,    lunchReturn: null,    checkOut: null, overtime: null,    status: 'active', value: 150, service: 'Carga e descarga' },
  { id: 'w5',    employeeId: 'e6', companyId: 'c1', date: '2026-05-26', checkIn: '07:30', lunchOut: '12:00', lunchReturn: '13:00', checkOut: null, overtime: null,    status: 'active', value: 150, service: 'Separação de mercadoria' },
  // Today - Absent (falta)
  { id: 'w_a1',  employeeId: 'e7', companyId: 'c1', date: '2026-05-26', checkIn: null,    lunchOut: null,    lunchReturn: null,    checkOut: null, overtime: null,    status: 'absent', value: 0,   service: 'Carga e descarga' },
  // Fri May 22
  { id: 'w6', employeeId: 'e1', companyId: 'c1', date: '2026-05-22', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w7', employeeId: 'e2', companyId: 'c2', date: '2026-05-22', checkIn: '08:00', checkOut: '18:00', status: 'completed', value: 150, service: 'Separação de mercadoria' },
  { id: 'w8', employeeId: 'e3', companyId: 'c1', date: '2026-05-22', checkIn: '07:45', checkOut: '17:45', status: 'completed', value: 150, service: 'Inventário' },
  { id: 'w9', employeeId: 'e5', companyId: 'c3', date: '2026-05-22', checkIn: '07:00', checkOut: '17:00', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w10', employeeId: 'e6', companyId: 'c2', date: '2026-05-22', checkIn: '08:00', checkOut: '18:00', status: 'completed', value: 150, service: 'Organização de estoque' },
  { id: 'w11', employeeId: 'e7', companyId: 'c1', date: '2026-05-22', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Carga e descarga' },
  // Thu May 21
  { id: 'w12', employeeId: 'e1', companyId: 'c2', date: '2026-05-21', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Separação de mercadoria' },
  { id: 'w13', employeeId: 'e2', companyId: 'c1', date: '2026-05-21', checkIn: '08:00', checkOut: '18:00', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w14', employeeId: 'e3', companyId: 'c3', date: '2026-05-21', checkIn: '07:00', checkOut: '17:00', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w15', employeeId: 'e5', companyId: 'c1', date: '2026-05-21', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Inventário' },
  { id: 'w16', employeeId: 'e7', companyId: 'c2', date: '2026-05-21', checkIn: '08:00', checkOut: '18:00', status: 'completed', value: 150, service: 'Organização de estoque' },
  // Wed May 20
  { id: 'w17', employeeId: 'e1', companyId: 'c1', date: '2026-05-20', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w18', employeeId: 'e2', companyId: 'c1', date: '2026-05-20', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w19', employeeId: 'e3', companyId: 'c2', date: '2026-05-20', checkIn: '08:00', checkOut: '18:00', status: 'completed', value: 150, service: 'Separação de mercadoria' },
  { id: 'w20', employeeId: 'e6', companyId: 'c3', date: '2026-05-20', checkIn: '07:00', checkOut: '17:00', status: 'completed', value: 150, service: 'Carga e descarga' },
  // Tue May 19
  { id: 'w21', employeeId: 'e1', companyId: 'c3', date: '2026-05-19', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w22', employeeId: 'e2', companyId: 'c1', date: '2026-05-19', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Inventário' },
  { id: 'w23', employeeId: 'e3', companyId: 'c1', date: '2026-05-19', checkIn: '08:00', checkOut: '18:00', status: 'completed', value: 150, service: 'Separação de mercadoria' },
  { id: 'w24', employeeId: 'e5', companyId: 'c2', date: '2026-05-19', checkIn: '07:00', checkOut: '17:00', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w25', employeeId: 'e7', companyId: 'c3', date: '2026-05-19', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Organização de estoque' },
  // Mon May 18
  { id: 'w26', employeeId: 'e1', companyId: 'c1', date: '2026-05-18', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w27', employeeId: 'e2', companyId: 'c2', date: '2026-05-18', checkIn: '08:00', checkOut: '18:00', status: 'completed', value: 150, service: 'Separação de mercadoria' },
  { id: 'w28', employeeId: 'e3', companyId: 'c1', date: '2026-05-18', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Inventário' },
  // Fri May 15
  { id: 'w29', employeeId: 'e1', companyId: 'c2', date: '2026-05-15', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w30', employeeId: 'e2', companyId: 'c1', date: '2026-05-15', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Separação de mercadoria' },
  { id: 'w31', employeeId: 'e3', companyId: 'c3', date: '2026-05-15', checkIn: '08:00', checkOut: '18:00', status: 'completed', value: 150, service: 'Carga e descarga' },
  { id: 'w32', employeeId: 'e5', companyId: 'c1', date: '2026-05-15', checkIn: '07:00', checkOut: '17:00', status: 'completed', value: 150, service: 'Organização de estoque' },
  { id: 'w33', employeeId: 'e6', companyId: 'c2', date: '2026-05-15', checkIn: '07:30', checkOut: '17:30', status: 'completed', value: 150, service: 'Inventário' },
  // Scheduled - Wed May 27
  { id: 's1', employeeId: 'e1', companyId: 'c1', date: '2026-05-27', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Carga e descarga' },
  { id: 's2', employeeId: 'e2', companyId: 'c2', date: '2026-05-27', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Organização de estoque' },
  { id: 's3', employeeId: 'e3', companyId: 'c1', date: '2026-05-27', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Separação de mercadoria' },
  { id: 's4', employeeId: 'e5', companyId: 'c3', date: '2026-05-27', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Carga e descarga' },
  // Scheduled - Thu May 28
  { id: 's5', employeeId: 'e1', companyId: 'c2', date: '2026-05-28', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Separação de mercadoria' },
  { id: 's6', employeeId: 'e3', companyId: 'c1', date: '2026-05-28', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Carga e descarga' },
  { id: 's7', employeeId: 'e6', companyId: 'c3', date: '2026-05-28', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Inventário' },
  { id: 's8', employeeId: 'e7', companyId: 'c1', date: '2026-05-28', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Organização de estoque' },
  // Scheduled - Fri May 29
  { id: 's9',  employeeId: 'e2', companyId: 'c1', date: '2026-05-29', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Carga e descarga' },
  { id: 's10', employeeId: 'e5', companyId: 'c2', date: '2026-05-29', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Inventário' },
  { id: 's11', employeeId: 'e6', companyId: 'c1', date: '2026-05-29', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Separação de mercadoria' },
  { id: 's12', employeeId: 'e7', companyId: 'c3', date: '2026-05-29', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Carga e descarga' },
  { id: 's13', employeeId: 'e1', companyId: 'c3', date: '2026-05-29', checkIn: null, checkOut: null, status: 'scheduled', value: 150, service: 'Organização de estoque' },
];

export const PAYMENTS = [
  { id: 'p1', companyId: 'c1', amount: 5550, dueDate: '2026-05-20', paidDate: '2026-05-20', status: 'paid', period: '01/05 - 15/05/2026', helpersCount: 37 },
  { id: 'p2', companyId: 'c1', amount: 4500, dueDate: '2026-05-05', paidDate: '2026-05-05', status: 'paid', period: '16/04 - 30/04/2026', helpersCount: 30 },
  { id: 'p3', companyId: 'c1', amount: 6150, dueDate: '2026-04-20', paidDate: '2026-04-21', status: 'paid', period: '01/04 - 15/04/2026', helpersCount: 41 },
  { id: 'p4', companyId: 'c1', amount: 3900, dueDate: '2026-06-05', paidDate: null, status: 'pending', period: '16/05 - 31/05/2026', helpersCount: null },
  { id: 'p5', companyId: 'c2', amount: 3300, dueDate: '2026-05-20', paidDate: '2026-05-20', status: 'paid', period: '01/05 - 15/05/2026', helpersCount: 22 },
  { id: 'p6', companyId: 'c2', amount: 2700, dueDate: '2026-05-05', paidDate: '2026-05-06', status: 'paid', period: '16/04 - 30/04/2026', helpersCount: 18 },
  { id: 'p7', companyId: 'c2', amount: 2400, dueDate: '2026-06-05', paidDate: null, status: 'pending', period: '16/05 - 31/05/2026', helpersCount: null },
  { id: 'p8', companyId: 'c3', amount: 2250, dueDate: '2026-05-20', paidDate: '2026-05-22', status: 'paid', period: '01/05 - 15/05/2026', helpersCount: 15 },
  { id: 'p9', companyId: 'c3', amount: 1800, dueDate: '2026-05-05', paidDate: null, status: 'overdue', period: '16/04 - 30/04/2026', helpersCount: 12 },
  { id: 'p10', companyId: 'c3', amount: 1500, dueDate: '2026-06-05', paidDate: null, status: 'pending', period: '16/05 - 31/05/2026', helpersCount: null },
];

export const MONTHLY_REVENUE = [
  { month: 'Dez/25', revenue: 18500, helpers: 62 },
  { month: 'Jan/26', revenue: 15200, helpers: 51 },
  { month: 'Fev/26', revenue: 21300, helpers: 71 },
  { month: 'Mar/26', revenue: 24800, helpers: 83 },
  { month: 'Abr/26', revenue: 22100, helpers: 74 },
  { month: 'Mai/26', revenue: 19450, helpers: 65 },
];

export const DAILY_HELPERS = [
  { day: 'Seg 18', count: 3, value: 450 },
  { day: 'Ter 19', count: 5, value: 750 },
  { day: 'Qua 20', count: 4, value: 600 },
  { day: 'Qui 21', count: 5, value: 750 },
  { day: 'Sex 22', count: 6, value: 900 },
  { day: 'Sáb 23', count: 2, value: 300 },
  { day: 'Seg 26', count: 5, value: 750 },
];

export const fmtCurrency = (val) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
