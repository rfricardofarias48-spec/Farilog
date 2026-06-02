import { supabase } from './supabase';

// ── Mappers ────────────────────────────────────────────────────────────────

function mapRecord(r) {
  if (!r) return null;
  return {
    id:          r.id,
    employeeId:  r.funcionario_id,
    companyId:   r.empresa_id,
    escalaId:    r.escala_id,
    date:        r.data,
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
    name:         r.nome,
    cargo:        r.cargo,
    phone:        r.telefone,
    email:        r.email,
    password:     r.senha,
    initials:     r.iniciais,
    color:        r.cor,
    status:       r.status,
    dailyRate:    Number(r.diaria),
    overtimeRate: Number(r.hora_extra ?? 50),
  };
}

function mapCompany(r) {
  if (!r) return null;
  return {
    id:        r.id,
    name:      r.nome,
    cnpj:      r.cnpj,
    email:     r.email,
    password:  r.senha,
    phone:     r.telefone,
    contact:   r.responsavel,
    address:   r.endereco,
    location:  r.localizacao,
    dailyRate: Number(r.diaria ?? 150),
    isActive:  r.ativo,
  };
}

function mapDemand(escala) {
  return {
    id:        escala.id,
    companyId: escala.empresa_id,
    date:      escala.data,
    time:      escala.horario,
    service:   escala.servico,
    employees: (escala.registros || []).map(wr => ({
      employeeId:    wr.funcionario_id,
      status:        wr.confirmacao || 'aguardando',
      entrada:       wr.entrada       || null,
      saidaAlmoco:   wr.saida_almoco  || null,
      retornoAlmoco: wr.retorno_almoco|| null,
      saida:         wr.saida         || null,
    })),
    createdAt: escala.criado_em,
  };
}

// ── Auth / Login ───────────────────────────────────────────────────────────

export async function loginAdmin(email, password) {
  const { data, error } = await supabase
    .from('usuarios_admin')
    .select('*')
    .eq('email', email)
    .eq('senha', password)
    .maybeSingle();
  if (error) { console.error('[db] loginAdmin:', error.message); return null; }
  if (!data) return null;
  return { ...data, initials: data.iniciais, name: data.nome, password: data.senha };
}

export async function loginEmployee(phoneOrEmail, password) {
  const field = phoneOrEmail.includes('@') ? 'email' : 'telefone';
  const { data, error } = await supabase
    .from('funcionarios')
    .select('*')
    .eq(field, phoneOrEmail)
    .eq('senha', password)
    .maybeSingle();
  if (error) { console.error('[db] loginEmployee:', error.message); return null; }
  return mapEmployee(data);
}

export async function loginCompany(email, password) {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('email', email)
    .eq('senha', password)
    .maybeSingle();
  if (error) { console.error('[db] loginCompany:', error.message); return null; }
  return mapCompany(data);
}

// ── Funcionários ───────────────────────────────────────────────────────────

export async function fetchEmployees() {
  const { data, error } = await supabase
    .from('funcionarios')
    .select('*')
    .order('nome');
  if (error) { console.error('[db] fetchEmployees:', error.message); return []; }
  return data.map(mapEmployee);
}

export async function createEmployee(emp) {
  const { data, error } = await supabase
    .from('funcionarios')
    .insert({
      id:       emp.id,
      nome:     emp.name,
      cargo:    emp.cargo || 'Ajudante de Logística',
      telefone: emp.phone || null,
      email:    emp.email || null,
      senha:    emp.password,
      iniciais: emp.initials,
      cor:      emp.color,
      status:   emp.status || 'active',
      diaria:   emp.dailyRate,
      hora_extra: emp.overtimeRate ?? 50,
    })
    .select()
    .single();
  if (error) { console.error('[db] createEmployee:', error.message); return null; }
  return mapEmployee(data);
}

export async function updateEmployee(id, emp) {
  const patch = {};
  if (emp.name         !== undefined) patch.nome       = emp.name;
  if (emp.cargo        !== undefined) patch.cargo      = emp.cargo;
  if (emp.phone        !== undefined) patch.telefone   = emp.phone;
  if (emp.email        !== undefined) patch.email      = emp.email;
  if (emp.password     !== undefined) patch.senha      = emp.password;
  if (emp.initials     !== undefined) patch.iniciais   = emp.initials;
  if (emp.color        !== undefined) patch.cor        = emp.color;
  if (emp.status       !== undefined) patch.status     = emp.status;
  if (emp.dailyRate    !== undefined) patch.diaria     = emp.dailyRate;
  if (emp.overtimeRate !== undefined) patch.hora_extra = emp.overtimeRate;

  const { data, error } = await supabase
    .from('funcionarios')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('[db] updateEmployee:', error.message); return null; }
  return mapEmployee(data);
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from('funcionarios').delete().eq('id', id);
  if (error) { console.error('[db] deleteEmployee:', error.message); return false; }
  return true;
}

// ── Empresas ───────────────────────────────────────────────────────────────

export async function fetchCompanies() {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('nome');
  if (error) { console.error('[db] fetchCompanies:', error.message); return []; }
  return data.map(mapCompany);
}

export async function createCompany(co) {
  const { data, error } = await supabase
    .from('empresas')
    .insert({
      id:          co.id,
      nome:        co.name,
      cnpj:        co.cnpj || null,
      email:       co.email,
      senha:       co.password,
      telefone:    co.phone || null,
      responsavel: co.contact || null,
      endereco:    co.address || null,
      localizacao: co.location || null,
      diaria:      co.dailyRate ?? 150,
    })
    .select()
    .single();
  if (error) { console.error('[db] createCompany:', error.message); return null; }
  return mapCompany(data);
}

export async function updateCompany(id, co) {
  const patch = {};
  if (co.name      !== undefined) patch.nome        = co.name;
  if (co.cnpj      !== undefined) patch.cnpj        = co.cnpj;
  if (co.email     !== undefined) patch.email       = co.email;
  if (co.password  !== undefined) patch.senha       = co.password;
  if (co.phone     !== undefined) patch.telefone    = co.phone;
  if (co.contact   !== undefined) patch.responsavel = co.contact;
  if (co.address   !== undefined) patch.endereco    = co.address;
  if (co.location  !== undefined) patch.localizacao = co.location;
  if (co.dailyRate !== undefined) patch.diaria      = co.dailyRate;

  const { data, error } = await supabase
    .from('empresas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('[db] updateCompany:', error.message); return null; }
  return mapCompany(data);
}

export async function deleteCompany(id) {
  const { error } = await supabase.from('empresas').delete().eq('id', id);
  if (error) { console.error('[db] deleteCompany:', error.message); return false; }
  return true;
}

// ── Demandas (Escalas) ─────────────────────────────────────────────────────

export async function fetchDemands() {
  const { data, error } = await supabase
    .from('escalas')
    .select('*, registros(*)')
    .order('data', { ascending: false });
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
      data:       date,
      horario:    time || null,
      servico:    service || null,
      status:     'scheduled',
      criado_por: adminId || null,
    })
    .select()
    .single();

  if (escErr) { console.error('[db] createDemand escala:', escErr.message); return null; }

  const workRecords = employeeIds.map(empId => ({
    id:             crypto.randomUUID(),
    escala_id:      escalaId,
    funcionario_id: empId,
    empresa_id:     companyId,
    data:           date,
    servico:        service || null,
    status:         'scheduled',
    confirmacao:    'aguardando',
    valor:          150,
  }));

  const { error: wrErr } = await supabase.from('registros').insert(workRecords);
  if (wrErr) { console.error('[db] createDemand registros:', wrErr.message); return null; }

  return mapDemand({ ...escala, registros: workRecords });
}

export async function updateDemandEmployeeStatus(escalaId, employeeId, confirmacao) {
  const { error } = await supabase
    .from('registros')
    .update({ confirmacao })
    .eq('escala_id', escalaId)
    .eq('funcionario_id', employeeId);
  if (error) { console.error('[db] updateDemandEmployeeStatus:', error.message); }
}

export async function deleteDemand(id) {
  await supabase.from('registros').delete().eq('escala_id', id);
  const { error } = await supabase.from('escalas').delete().eq('id', id);
  if (error) { console.error('[db] deleteDemand:', error.message); return false; }
  return true;
}

export async function editDemand(id, { companyId, date, time, service, selectedEmployees }) {
  const { error: escErr } = await supabase
    .from('escalas')
    .update({ empresa_id: companyId, data: date, horario: time, servico: service })
    .eq('id', id);
  if (escErr) { console.error('[db] editDemand escala:', escErr.message); return false; }

  const { data: existing } = await supabase
    .from('registros')
    .select('funcionario_id')
    .eq('escala_id', id);

  const existingIds = (existing || []).map(r => r.funcionario_id);
  const toRemove = existingIds.filter(eId => !selectedEmployees.includes(eId));
  const toAdd    = selectedEmployees.filter(eId => !existingIds.includes(eId));

  if (toRemove.length > 0) {
    await supabase.from('registros').delete().eq('escala_id', id).in('funcionario_id', toRemove);
  }
  if (toAdd.length > 0) {
    await supabase.from('registros').insert(toAdd.map(empId => ({
      id: crypto.randomUUID(),
      escala_id: id, funcionario_id: empId, empresa_id: companyId,
      data: date, servico: service || null, status: 'scheduled',
      confirmacao: 'aguardando', valor: 150,
    })));
  }
  return true;
}

// ── Consultas de registros (admin) ────────────────────────────────────────

export async function fetchTodayAllRecords(today) {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .eq('data', today);
  if (error) { console.error('[db] fetchTodayAllRecords:', error.message); return []; }
  return data.map(mapRecord);
}

export async function fetchWorkRecordsByPeriod(companyId, employeeId, start, end) {
  let query = supabase
    .from('registros')
    .select('*')
    .gte('data', start)
    .lte('data', end)
    .order('data');
  if (companyId)  query = query.eq('empresa_id',    companyId);
  if (employeeId) query = query.eq('funcionario_id', employeeId);
  const { data, error } = await query;
  if (error) { console.error('[db] fetchWorkRecordsByPeriod:', error.message); return []; }
  return data.map(mapRecord);
}

// ── Registros de trabalho ──────────────────────────────────────────────────

export async function fetchCompanyRecords(companyId) {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .eq('empresa_id', companyId)
    .order('data', { ascending: false });
  if (error) { console.error('[db] fetchCompanyRecords:', error.message); return []; }
  return data.map(mapRecord);
}

export function subscribeToCompanyRecords(companyId, onChange) {
  const reload = () => fetchCompanyRecords(companyId).then(onChange);
  const channel = supabase
    .channel(`co_recs_${companyId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'registros',
      filter: `empresa_id=eq.${companyId}`,
    }, reload)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function fetchTodayRecord(employeeId, today) {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .eq('funcionario_id', employeeId)
    .eq('data', today)
    .maybeSingle();
  if (error) { console.error('[db] fetchTodayRecord:', error.message); return null; }
  return mapRecord(data);
}

export async function fetchEmployeeRecords(employeeId) {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .eq('funcionario_id', employeeId)
    .order('data', { ascending: false });
  if (error) { console.error('[db] fetchEmployeeRecords:', error.message); return []; }
  return data.map(mapRecord);
}

export function subscribeToRecord(employeeId, today, onChange) {
  const channel = supabase
    .channel(`reg_${employeeId}_${today}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'registros',
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
