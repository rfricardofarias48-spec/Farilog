import { supabase } from './supabase';

// ── Mappers ────────────────────────────────────────────────────────────────

function mapRecord(r) {
  if (!r) return null;
  return {
    id:          r.id,
    employeeId:  r.funcionario_id,
    companyId:   r.empresa_id,
    escalaId:    r.escala_id,
    date:        r.date,
    service:     r.servico,
    checkIn:     r.entrada,
    lunchOut:    r.saida_almoco,
    lunchReturn: r.retorno_almoco,
    checkOut:    r.saida,
    overtime:    r.hora_extra,
    status:      r.status,
    value:       r.valor,
    confirmacao: r.confirmacao,
  };
}

function mapEmployee(r) {
  if (!r) return null;
  return {
    id:           r.id,
    name:         r.name,
    cargo:        r.cargo,
    phone:        r.phone,
    email:        r.email,
    password:     r.password,
    initials:     r.initials,
    color:        r.color,
    status:       r.status,
    dailyRate:    Number(r.diaria),
    overtimeRate: Number(r.hora_extra ?? 50),
  };
}

function mapCompany(r) {
  if (!r) return null;
  return {
    id:        r.id,
    name:      r.name,
    cnpj:      r.cnpj,
    email:     r.email,
    password:  r.password,
    phone:     r.phone,
    contact:   r.responsavel,
    address:   r.address,
    location:  r.location,
    dailyRate: Number(r.diaria ?? 150),
    isActive:  r.ativo,
  };
}

function mapDemand(escala) {
  return {
    id:          escala.id,
    companyId:   escala.empresa_id,
    date:        escala.date,
    time:        escala.horario,
    service:     escala.servico,
    employees:   (escala.work_records || []).map(wr => ({
      employeeId: wr.funcionario_id,
      status:     wr.confirmacao || 'aguardando',
    })),
    createdAt:   escala.created_at,
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
  if (!data) return null;
  return { ...data, initials: data.iniciais };
}

export async function loginEmployee(phoneOrEmail, password) {
  const field = phoneOrEmail.includes('@') ? 'email' : 'phone';
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq(field, phoneOrEmail)
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
      id:                emp.id,
      name:              emp.name,
      cargo:             emp.cargo || 'Ajudante de Logística',
      phone:             emp.phone || null,
      email:             emp.email || null,
      password:          emp.password,
      initials:          emp.initials,
      color:             emp.color,
      status:            emp.status || 'active',
      diaria:            emp.dailyRate,
      hora_extra:        emp.overtimeRate ?? 50,
      data_contratacao:  null,
    })
    .select()
    .single();
  if (error) { console.error('[db] createEmployee:', error.message); return null; }
  return mapEmployee(data);
}

export async function updateEmployee(id, emp) {
  const patch = {};
  if (emp.name         !== undefined) patch.name             = emp.name;
  if (emp.cargo        !== undefined) patch.cargo            = emp.cargo;
  if (emp.phone        !== undefined) patch.phone            = emp.phone;
  if (emp.email        !== undefined) patch.email            = emp.email;
  if (emp.password     !== undefined) patch.password         = emp.password;
  if (emp.initials     !== undefined) patch.initials         = emp.initials;
  if (emp.color        !== undefined) patch.color            = emp.color;
  if (emp.status       !== undefined) patch.status           = emp.status;
  if (emp.dailyRate    !== undefined) patch.diaria           = emp.dailyRate;
  if (emp.overtimeRate !== undefined) patch.hora_extra       = emp.overtimeRate;

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
      id:          co.id,
      name:        co.name,
      cnpj:        co.cnpj || null,
      email:       co.email,
      password:    co.password,
      phone:       co.phone || null,
      responsavel: co.contact || null,
      address:     co.address || null,
      location:    co.location || null,
      diaria:      co.dailyRate ?? 150,
    })
    .select()
    .single();
  if (error) { console.error('[db] createCompany:', error.message); return null; }
  return mapCompany(data);
}

export async function updateCompany(id, co) {
  const patch = {};
  if (co.name      !== undefined) patch.name        = co.name;
  if (co.cnpj      !== undefined) patch.cnpj        = co.cnpj;
  if (co.email     !== undefined) patch.email       = co.email;
  if (co.password  !== undefined) patch.password    = co.password;
  if (co.phone     !== undefined) patch.phone       = co.phone;
  if (co.contact   !== undefined) patch.responsavel = co.contact;
  if (co.address   !== undefined) patch.address     = co.address;
  if (co.location  !== undefined) patch.location    = co.location;
  if (co.dailyRate !== undefined) patch.diaria      = co.dailyRate;

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

// ── Demands (Escalas) ──────────────────────────────────────────────────────

export async function fetchDemands() {
  const { data, error } = await supabase
    .from('escalas')
    .select('*, work_records(*)')
    .order('date', { ascending: false });
  if (error) { console.error('[db] fetchDemands:', error.message); return []; }
  return data.map(mapDemand);
}

export async function createDemand({ companyId, date, time, service, employeeIds, adminId }) {
  const escalaId = crypto.randomUUID();

  const { data: escala, error: escErr } = await supabase
    .from('escalas')
    .insert({
      id:         escalaId,
      empresa_id: companyId,
      date,
      horario:    time || null,
      servico:    service || null,
      status:     'scheduled',
      criado_por: adminId || null,
    })
    .select()
    .single();

  if (escErr) { console.error('[db] createDemand escala:', escErr.message); return null; }

  const workRecords = employeeIds.map(empId => ({
    id:           crypto.randomUUID(),
    escala_id:    escalaId,
    funcionario_id: empId,
    empresa_id:   companyId,
    date,
    servico:      service || null,
    status:       'scheduled',
    confirmacao:  'aguardando',
    valor:        150,
  }));

  const { error: wrErr } = await supabase.from('work_records').insert(workRecords);
  if (wrErr) { console.error('[db] createDemand work_records:', wrErr.message); return null; }

  return mapDemand({ ...escala, work_records: workRecords });
}

export async function updateDemandEmployeeStatus(escalaId, employeeId, confirmacao) {
  const { error } = await supabase
    .from('work_records')
    .update({ confirmacao })
    .eq('escala_id', escalaId)
    .eq('funcionario_id', employeeId);
  if (error) { console.error('[db] updateDemandEmployeeStatus:', error.message); }
}

// ── Work Records ───────────────────────────────────────────────────────────

export async function fetchTodayRecord(employeeId, today) {
  const { data, error } = await supabase
    .from('work_records')
    .select('*')
    .eq('funcionario_id', employeeId)
    .eq('date', today)
    .maybeSingle();
  if (error) { console.error('[db] fetchTodayRecord:', error.message); return null; }
  return mapRecord(data);
}

export async function fetchEmployeeRecords(employeeId) {
  const { data, error } = await supabase
    .from('work_records')
    .select('*')
    .eq('funcionario_id', employeeId)
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
        filter: `funcionario_id=eq.${employeeId}`,
      },
      (payload) => {
        const rec = mapRecord(payload.new || payload.old);
        if (rec?.date === today) onChange(rec);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
