import { supabase } from './supabase';

// ── Mappers ────────────────────────────────────────────────────────────────

function mapRecord(r) {
  if (!r) return null;
  return {
    id:          r.id,
    employeeId:  r.employee_id,
    companyId:   r.company_id,
    date:        r.date,
    service:     r.service,
    checkIn:     r.check_in,
    lunchOut:    r.lunch_out,
    lunchReturn: r.lunch_return,
    checkOut:    r.check_out,
    overtime:    r.overtime,
    status:      r.status,
    value:       r.value,
  };
}

function mapEmployee(r) {
  if (!r) return null;
  return {
    id:        r.id,
    name:      r.name,
    cargo:     r.cargo,
    cpf:       r.cpf,
    phone:     r.phone,
    email:     r.email,
    password:  r.password,
    initials:  r.initials,
    color:     r.color,
    status:    r.status,
    dailyRate: Number(r.daily_rate),
    hireDate:  r.hire_date,
  };
}

function mapCompany(r) {
  if (!r) return null;
  return {
    id:       r.id,
    name:     r.name,
    cnpj:     r.cnpj,
    email:    r.email,
    password: r.password,
    phone:    r.phone,
    contact:  r.contact,
    address:  r.address,
    sector:   r.sector,
    isActive: r.is_active,
  };
}

// ── Auth / Login ───────────────────────────────────────────────────────────

export async function loginAdmin(email, password) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .maybeSingle();
  if (error) { console.error('[db] loginAdmin:', error.message); return null; }
  return data;
}

export async function loginEmployee(email, password) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .maybeSingle();
  if (error) { console.error('[db] loginEmployee:', error.message); return null; }
  return mapEmployee(data);
}

export async function loginCompany(email, password) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .maybeSingle();
  if (error) { console.error('[db] loginCompany:', error.message); return null; }
  return mapCompany(data);
}

// ── Employees ──────────────────────────────────────────────────────────────

export async function fetchEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name');
  if (error) { console.error('[db] fetchEmployees:', error.message); return []; }
  return data.map(mapEmployee);
}

export async function createEmployee(emp) {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      id:         emp.id,
      name:       emp.name,
      cargo:      emp.cargo || 'Ajudante de Logística',
      cpf:        emp.cpf || null,
      phone:      emp.phone || null,
      email:      emp.email,
      password:   emp.password,
      initials:   emp.initials,
      color:      emp.color,
      status:     emp.status,
      daily_rate: emp.dailyRate,
      hire_date:  emp.hireDate || null,
    })
    .select()
    .single();
  if (error) { console.error('[db] createEmployee:', error.message); return null; }
  return mapEmployee(data);
}

export async function updateEmployee(id, emp) {
  const patch = {};
  if (emp.name      !== undefined) patch.name       = emp.name;
  if (emp.cargo     !== undefined) patch.cargo      = emp.cargo;
  if (emp.cpf       !== undefined) patch.cpf        = emp.cpf;
  if (emp.phone     !== undefined) patch.phone      = emp.phone;
  if (emp.email     !== undefined) patch.email      = emp.email;
  if (emp.password  !== undefined) patch.password   = emp.password;
  if (emp.initials  !== undefined) patch.initials   = emp.initials;
  if (emp.color     !== undefined) patch.color      = emp.color;
  if (emp.status    !== undefined) patch.status     = emp.status;
  if (emp.dailyRate !== undefined) patch.daily_rate = emp.dailyRate;
  if (emp.hireDate  !== undefined) patch.hire_date  = emp.hireDate || null;

  const { data, error } = await supabase
    .from('employees')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('[db] updateEmployee:', error.message); return null; }
  return mapEmployee(data);
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) { console.error('[db] deleteEmployee:', error.message); return false; }
  return true;
}

// ── Companies ──────────────────────────────────────────────────────────────

export async function fetchCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');
  if (error) { console.error('[db] fetchCompanies:', error.message); return []; }
  return data.map(mapCompany);
}

export async function createCompany(co) {
  const { data, error } = await supabase
    .from('companies')
    .insert({
      id:       co.id,
      name:     co.name,
      cnpj:     co.cnpj || null,
      email:    co.email,
      password: co.password,
      phone:    co.phone || null,
      contact:  co.contact || null,
      address:  co.address || null,
      sector:   co.sector || null,
    })
    .select()
    .single();
  if (error) { console.error('[db] createCompany:', error.message); return null; }
  return mapCompany(data);
}

export async function updateCompany(id, co) {
  const patch = {};
  if (co.name     !== undefined) patch.name     = co.name;
  if (co.cnpj     !== undefined) patch.cnpj     = co.cnpj;
  if (co.email    !== undefined) patch.email    = co.email;
  if (co.password !== undefined) patch.password = co.password;
  if (co.phone    !== undefined) patch.phone    = co.phone;
  if (co.contact  !== undefined) patch.contact  = co.contact;
  if (co.address  !== undefined) patch.address  = co.address;
  if (co.sector   !== undefined) patch.sector   = co.sector;

  const { data, error } = await supabase
    .from('companies')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('[db] updateCompany:', error.message); return null; }
  return mapCompany(data);
}

export async function deleteCompany(id) {
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) { console.error('[db] deleteCompany:', error.message); return false; }
  return true;
}

// ── Work Records ───────────────────────────────────────────────────────────

export async function fetchTodayRecord(employeeId, today) {
  const { data, error } = await supabase
    .from('work_records')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle();
  if (error) { console.error('[db] fetchTodayRecord:', error.message); return null; }
  return mapRecord(data);
}

export async function fetchEmployeeRecords(employeeId) {
  const { data, error } = await supabase
    .from('work_records')
    .select('*')
    .eq('employee_id', employeeId)
    .order('date', { ascending: false });
  if (error) { console.error('[db] fetchEmployeeRecords:', error.message); return []; }
  return data.map(mapRecord);
}

export function subscribeToRecord(employeeId, today, onChange) {
  const channel = supabase
    .channel(`wr_${employeeId}_${today}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'work_records',
        filter: `employee_id=eq.${employeeId}`,
      },
      (payload) => {
        const rec = mapRecord(payload.new || payload.old);
        if (rec?.date === today) onChange(rec);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
