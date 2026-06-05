import { supabase } from './supabase';

// ── Helpers ────────────────────────────────────────────────────────────────

// Normaliza qualquer string de hora para HH:MM (descarta segundos se presentes)
function fmtHHMM(t) {
  if (!t) return null;
  const parts = String(t).split(':');
  return `${parts[0].padStart(2,'0')}:${(parts[1] ?? '00').padStart(2,'0')}`;
}

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
    checkIn:     fmtHHMM(r.entrada),
    lunchOut:    fmtHHMM(r.saida_almoco),
    lunchReturn: fmtHHMM(r.retorno_almoco),
    checkOut:    fmtHHMM(r.saida),
    overtime:    r.hora_extra,
    status:      r.status,
    value:       r.valor,
    confirmacao: r.confirmacao,
  };
}

function mapEmployee(r) {
  if (!r) return null;
  return {
    id:              r.id,
    name:            r.nome,
    cargo:           r.cargo,
    phone:           r.telefone,
    email:           r.email,
    password:        r.senha,
    initials:        r.iniciais,
    color:           r.cor,
    status:          r.status,
    dailyRate:       Number(r.diaria),
    overtimeRate:    Number(r.hora_extra ?? 50),
    cidade:          r.cidade || '',
    dataContratacao: r.data_contratacao || null,
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
    id:              escala.id,
    companyId:       escala.empresa_id,
    companyName:     escala.empresas?.nome || escala.companyName || null,
    date:            escala.data,
    time:            fmtHHMM(escala.horario),
    service:         escala.servico,
    responsavelDia:  escala.responsavel_dia || '',
    contatoDia:      escala.contato_dia     || '',
    liderNome:       escala.lideres_equipe?.nome || escala.liderNome || null,
    employees: (escala.registros || []).map(wr => ({
      employeeId:    wr.funcionario_id,
      status:        wr.confirmacao || 'aguardando',
      entrada:       wr.entrada        || null,
      saidaAlmoco:   wr.saida_almoco   || null,
      retornoAlmoco: wr.retorno_almoco || null,
      saida:         wr.saida          || null,
      observacoes:   wr.observacoes    || '',
    })),
    createdAt: escala.criado_em,
  };
}

// ── Auth / Login ───────────────────────────────────────────────────────────

export async function loginLider(email, password) {
  const { data, error } = await supabase
    .from('lideres_equipe')
    .select('*')
    .eq('email', email)
    .eq('senha', password)
    .maybeSingle();
  if (error) { console.error('[db] loginLider:', error.message); return null; }
  if (!data) return null;

  // Busca o nome da empresa principal separadamente (evita falha por FK inválida)
  let companyName = null;
  if (data.empresa_id) {
    const { data: emp } = await supabase
      .from('empresas')
      .select('nome')
      .eq('id', data.empresa_id)
      .maybeSingle();
    companyName = emp?.nome || null;
  }

  return {
    ...data,
    name:        data.nome,
    initials:    data.iniciais,
    color:       data.cor,
    companyName,
  };
}

export async function loginRH(email, password) {
  const { data, error } = await supabase
    .from('usuarios_rh')
    .select('*')
    .eq('email', email)
    .eq('senha', password)
    .maybeSingle();
  if (error) { console.error('[db] loginRH:', error.message); return null; }
  if (!data) return null;
  return { ...data, name: data.nome, initials: data.iniciais };
}

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
      cpf:      emp.cpf || null,
      telefone: emp.phone || null,
      email:    emp.email || null,
      senha:    emp.password,
      iniciais: emp.initials,
      cor:      emp.color,
      status:   emp.status || 'active',
      diaria:   emp.dailyRate,
      hora_extra: emp.overtimeRate ?? 50,
      data_contratacao: emp.dataContratacao || null,
      cidade: emp.cidade || null,
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
  if (emp.cidade       !== undefined) patch.cidade     = emp.cidade;

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
    .select('*, registros(*), empresas(nome), lideres_equipe(nome)')
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

// ── Líderes de Equipe ─────────────────────────────────────────────────────

export async function fetchLideres() {
  const { data, error } = await supabase
    .from('lideres_equipe')
    .select('*, lider_empresas(empresa_id, empresas(nome))')
    .order('nome');
  if (error) { console.error('[db] fetchLideres:', error.message); return []; }
  return data.map(l => ({
    ...l,
    name:      l.nome,
    initials:  l.iniciais,
    color:     l.cor,
    companyName: l.lider_empresas?.map(le => le.empresas?.nome).filter(Boolean).join(', ') || '—',
    companyIds:  l.lider_empresas?.map(le => le.empresa_id) || [],
  }));
}

export async function createLider(lider) {
  const { data, error } = await supabase
    .from('lideres_equipe')
    .insert({ id: crypto.randomUUID(), nome: lider.name, email: lider.email, telefone: lider.phone, senha: lider.password, iniciais: lider.initials, cor: lider.color || '#FF4D0C', empresa_id: lider.companyId || null })
    .select('*, empresas(nome)')
    .single();
  if (error) { console.error('[db] createLider:', error.message); return null; }
  return { ...data, name: data.nome, initials: data.iniciais, color: data.cor, companyName: data.empresas?.nome };
}

export async function updateLider(id, patch) {
  const p = {};
  if (patch.name      !== undefined) p.nome       = patch.name;
  if (patch.email     !== undefined) p.email      = patch.email;
  if (patch.phone     !== undefined) p.telefone   = patch.phone;
  if (patch.password  !== undefined) p.senha      = patch.password;
  if (patch.initials  !== undefined) p.iniciais   = patch.initials;
  if (patch.color     !== undefined) p.cor        = patch.color;
  if (patch.companyId !== undefined) p.empresa_id = patch.companyId;
  if (patch.status    !== undefined) p.status     = patch.status;
  const { error } = await supabase.from('lideres_equipe').update(p).eq('id', id);
  if (error) { console.error('[db] updateLider:', error.message); return false; }
  return true;
}

export async function deleteLider(id) {
  const { error } = await supabase.from('lideres_equipe').delete().eq('id', id);
  if (error) { console.error('[db] deleteLider:', error.message); return false; }
  return true;
}

// ── Empresas do Líder (N:N) ───────────────────────────────────────────────

export async function fetchEmpresasDoLider(liderId) {
  const { data, error } = await supabase
    .from('lider_empresas')
    .select('empresa_id, empresas(id, nome, telefone, responsavel)')
    .eq('lider_id', liderId);
  if (error) { console.error('[db] fetchEmpresasDoLider:', error.message); return []; }
  return (data || []).map(r => ({
    id:          r.empresa_id,
    name:        r.empresas?.nome        || '—',
    telefone:    r.empresas?.telefone    || null,
    responsavel: r.empresas?.responsavel || null,
  }));
}

export async function fetchLiderEmpresasIds(liderId) {
  const { data, error } = await supabase
    .from('lider_empresas').select('empresa_id').eq('lider_id', liderId);
  if (error) { console.error('[db] fetchLiderEmpresasIds:', error.message); return []; }
  return (data || []).map(r => r.empresa_id);
}

export async function upsertLiderEmpresas(liderId, empresaIds) {
  await supabase.from('lider_empresas').delete().eq('lider_id', liderId);
  if (!empresaIds.length) return;
  const rows = empresaIds.map(id => ({ lider_id: liderId, empresa_id: id }));
  const { error } = await supabase.from('lider_empresas').insert(rows);
  if (error) { console.error('[db] upsertLiderEmpresas:', error.message); }
}

// ── Usuários RH ───────────────────────────────────────────────────────────

export async function fetchRHUsers() {
  const { data, error } = await supabase.from('usuarios_rh').select('*').order('nome');
  if (error) { console.error('[db] fetchRHUsers:', error.message); return []; }
  return data.map(r => ({ ...r, name: r.nome, initials: r.iniciais }));
}

export async function createRHUser(rh) {
  const { data, error } = await supabase
    .from('usuarios_rh')
    .insert({ id: crypto.randomUUID(), nome: rh.name, email: rh.email, senha: rh.password, iniciais: rh.initials })
    .select().single();
  if (error) { console.error('[db] createRHUser:', error.message); return null; }
  return { ...data, name: data.nome, initials: data.iniciais };
}

export async function updateRHUser(id, patch) {
  const p = {};
  if (patch.name     !== undefined) p.nome     = patch.name;
  if (patch.email    !== undefined) p.email    = patch.email;
  if (patch.password !== undefined) p.senha    = patch.password;
  if (patch.initials !== undefined) p.iniciais = patch.initials;
  const { error } = await supabase.from('usuarios_rh').update(p).eq('id', id);
  if (error) { console.error('[db] updateRHUser:', error.message); return false; }
  return true;
}

export async function deleteRHUser(id) {
  const { error } = await supabase.from('usuarios_rh').delete().eq('id', id);
  if (error) { console.error('[db] deleteRHUser:', error.message); return false; }
  return true;
}

// ── Ocorrências ───────────────────────────────────────────────────────────

export async function fetchOcorrencias(filters = {}) {
  let q = supabase.from('ocorrencias')
    .select('*, funcionarios(nome, iniciais, cor)')
    .order('criado_em', { ascending: false });
  if (filters.liderId)    q = q.eq('lider_id', filters.liderId);
  if (filters.empresaId)  q = q.eq('empresa_id', filters.empresaId);
  if (filters.data)       q = q.eq('data', filters.data);
  if (filters.escalaId)   q = q.eq('escala_id', filters.escalaId);
  if (filters.ajudanteId) q = q.eq('ajudante_id', filters.ajudanteId);
  const { data, error } = await q;
  if (error) { console.error('[db] fetchOcorrencias:', error.message); return []; }
  return data;
}

export async function createOcorrencia(oc) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .insert({ id: crypto.randomUUID(), escala_id: oc.escalaId, lider_id: oc.liderId, ajudante_id: oc.ajudanteId, empresa_id: oc.empresaId, data: oc.data, descricao: oc.descricao, foto_url: oc.fotoUrl || null })
    .select().single();
  if (error) { console.error('[db] createOcorrencia:', error.message); return null; }
  return data;
}

export async function updateOcorrenciaStatus(id, status) {
  const { error } = await supabase.from('ocorrencias').update({ status }).eq('id', id);
  if (error) { console.error('[db] updateOcorrenciaStatus:', error.message); }
}

// ── Relatórios Diários ────────────────────────────────────────────────────

export async function fetchRelatoriosDiarios(liderId) {
  const { data, error } = await supabase
    .from('relatorios_diarios')
    .select('*')
    .eq('lider_id', liderId)
    .order('data', { ascending: false });
  if (error) { console.error('[db] fetchRelatoriosDiarios:', error.message); return []; }
  return data;
}

export async function upsertRelatorioDiario(rel) {
  const { data, error } = await supabase
    .from('relatorios_diarios')
    .upsert({ id: rel.id || crypto.randomUUID(), lider_id: rel.liderId, empresa_id: rel.empresaId, data: rel.data, presentes: rel.presentes, ausentes: rel.ausentes, ocorrencias_count: rel.ocorrenciasCount, observacoes: rel.observacoes, finalizado: rel.finalizado, fotos_urls: rel.fotosUrls || [] }, { onConflict: 'lider_id,data' })
    .select().single();
  if (error) { console.error('[db] upsertRelatorioDiario:', error.message); return null; }
  return data;
}

export async function uploadFotoRelatorio(file, liderId) {
  const ext  = file.name.split('.').pop();
  const path = `relatorios/${liderId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('relatorios').upload(path, file, { upsert: true });
  if (error) { console.error('[db] uploadFotoRelatorio:', error.message); return null; }
  const { data } = supabase.storage.from('relatorios').getPublicUrl(path);
  return data.publicUrl;
}

// ── Tarefas RH ────────────────────────────────────────────────────────────

export async function fetchTarefasRH() {
  const { data, error } = await supabase
    .from('tarefas_rh')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchTarefasRH:', error.message); return []; }
  return data;
}

export async function createTarefaRH(tarefa) {
  const { error } = await supabase
    .from('tarefas_rh')
    .insert({ id: crypto.randomUUID(), tipo: tarefa.tipo, descricao: tarefa.descricao, referencia_id: tarefa.referenciaId || null, prioridade: tarefa.prioridade || 'normal' });
  if (error) { console.error('[db] createTarefaRH:', error.message); }
}

export async function concluirTarefaRH(id) {
  const { error } = await supabase.from('tarefas_rh').update({ status: 'concluido' }).eq('id', id);
  if (error) { console.error('[db] concluirTarefaRH:', error.message); }
}

// ── Tarefas do Admin → Líder / RH ────────────────────────────────────────

export async function createTarefaAdmin({ titulo, descricao, prioridade, destinatarioTipo, destinatarioId }) {
  const { error } = await supabase.from('tarefas').insert({
    titulo, descricao: descricao || '', prioridade: prioridade || 'normal',
    destinatario_tipo: destinatarioTipo, destinatario_id: destinatarioId || null,
  });
  if (error) { console.error('[db] createTarefaAdmin:', error.message); return false; }
  return true;
}

export async function fetchTarefasParaLider(liderId) {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*')
    .or(`destinatario_tipo.eq.todos_lideres,and(destinatario_tipo.eq.lider,destinatario_id.eq.${liderId})`)
    .order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchTarefasParaLider:', error.message); return []; }
  return data || [];
}

export async function fetchTarefasParaRH() {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*')
    .eq('destinatario_tipo', 'rh')
    .order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchTarefasParaRH:', error.message); return []; }
  return data || [];
}

export async function fetchTodasTarefasAdmin() {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, lideres_equipe:destinatario_id(nome)')
    .order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchTodasTarefasAdmin:', error.message); return []; }
  return (data || []).map(t => ({
    ...t,
    destinatarioNome: t.destinatario_tipo === 'rh' ? 'RH'
      : t.destinatario_tipo === 'todos_lideres' ? 'Todos os Líderes'
      : t['lideres_equipe']?.nome || '—',
  }));
}

export async function concluirTarefaAdmin(id) {
  const { error } = await supabase.from('tarefas')
    .update({ status: 'concluido', concluido_em: new Date().toISOString() })
    .eq('id', id);
  if (error) { console.error('[db] concluirTarefaAdmin:', error.message); }
}

export async function fetchLideres() {
  const { data, error } = await supabase.from('lideres_equipe').select('id, nome').order('nome');
  if (error) { console.error('[db] fetchLideres:', error.message); return []; }
  return data || [];
}

// ── Solicitações de Ajudantes (Líder → RH) ───────────────────────────────

export async function createSolicitacaoAjudantes({ liderId, cidade, funcao, quantidade, observacoes }) {
  const { error } = await supabase.from('solicitacoes_ajudantes').insert({
    lider_id: liderId, cidade, funcao, quantidade: Number(quantidade), observacoes: observacoes || '',
  });
  if (error) { console.error('[db] createSolicitacaoAjudantes:', error.message); return false; }
  return true;
}

export async function fetchSolicitacoesAjudantes() {
  const { data, error } = await supabase
    .from('solicitacoes_ajudantes')
    .select('*, lideres_equipe(nome)')
    .order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchSolicitacoesAjudantes:', error.message); return []; }
  return (data || []).map(r => ({
    id:          r.id,
    liderNome:   r.lideres_equipe?.nome || '—',
    cidade:      r.cidade,
    funcao:      r.funcao,
    quantidade:  r.quantidade,
    observacoes: r.observacoes,
    status:      r.status,
    criadoEm:    r.criado_em,
  }));
}

export async function updateStatusSolicitacao(id, status) {
  const { error } = await supabase.from('solicitacoes_ajudantes').update({ status }).eq('id', id);
  if (error) { console.error('[db] updateStatusSolicitacao:', error.message); }
}

// ── Checklist Diário ──────────────────────────────────────────────────────

export async function fetchChecklist(funcionarioId, data) {
  const { data: row, error } = await supabase
    .from('checklist_diario')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .eq('data', data)
    .maybeSingle();
  if (error) { console.error('[db] fetchChecklist:', error.message); return null; }
  return row;
}

export async function saveChecklist(check) {
  const { data, error } = await supabase
    .from('checklist_diario')
    .upsert({ id: check.id || crypto.randomUUID(), funcionario_id: check.funcionarioId, data: check.data, uniforme: check.uniforme, cracha: check.cracha, celular: check.celular, apto: check.apto, respondido_em: new Date().toISOString() }, { onConflict: 'funcionario_id,data' })
    .select().single();
  if (error) { console.error('[db] saveChecklist:', error.message); return null; }
  return data;
}

// ── Escalas por Líder ─────────────────────────────────────────────────────

export async function fetchEscalasByLider(liderId) {
  const { data, error } = await supabase
    .from('escalas')
    .select('*, registros(*), empresas(nome)')
    .eq('lider_id', liderId)
    .order('data', { ascending: false });
  if (error) { console.error('[db] fetchEscalasByLider:', error.message); return []; }
  return data.map(mapDemand);
}

export async function assignLiderToEscala(escalaId, liderId) {
  const { error } = await supabase.from('escalas').update({ lider_id: liderId }).eq('id', escalaId);
  if (error) { console.error('[db] assignLiderToEscala:', error.message); }
}

export async function createEscalaByLider({ liderId, companyId, date, time, service, employees, responsavelDia, contatoDia }) {
  const escalaId = crypto.randomUUID();
  const { data: escala, error: escErr } = await supabase
    .from('escalas')
    .insert({ id: escalaId, empresa_id: companyId, data: date, horario: time || null, servico: service || null, status: 'scheduled', lider_id: liderId, responsavel_dia: responsavelDia || null, contato_dia: contatoDia || null })
    .select()
    .single();
  if (escErr) { console.error('[db] createEscalaByLider:', escErr.message); return null; }

  if (employees.length > 0) {
    const registros = employees.map(({ id: empId, observacoes }) => ({
      id: crypto.randomUUID(), escala_id: escalaId, funcionario_id: empId, empresa_id: companyId,
      data: date, servico: service || null, status: 'scheduled', confirmacao: 'aguardando', valor: 150,
      observacoes: observacoes || null,
    }));
    const { error: rErr } = await supabase.from('registros').insert(registros);
    if (rErr) { console.error('[db] createEscalaByLider registros:', rErr.message); return null; }
    return mapDemand({ ...escala, registros });
  }
  return mapDemand({ ...escala, registros: [] });
}

export async function updateEscalaByLider({ escalaId, time, service, responsavelDia, contatoDia, newEmployees, companyId, date }) {
  const { error: upErr } = await supabase
    .from('escalas')
    .update({ horario: time || null, servico: service || null, responsavel_dia: responsavelDia || null, contato_dia: contatoDia || null })
    .eq('id', escalaId);
  if (upErr) { console.error('[db] updateEscalaByLider:', upErr.message); return false; }

  if (newEmployees && newEmployees.length > 0) {
    const registros = newEmployees.map(({ id: empId, observacoes }) => ({
      id: crypto.randomUUID(), escala_id: escalaId, funcionario_id: empId, empresa_id: companyId,
      data: date, servico: service || null, status: 'scheduled', confirmacao: 'aguardando', valor: 150,
      observacoes: observacoes || null,
    }));
    const { error: rErr } = await supabase.from('registros').insert(registros);
    if (rErr) { console.error('[db] updateEscalaByLider registros:', rErr.message); return false; }
  }
  return true;
}

export async function addRegistroToEscala(escalaId, employeeId, companyId, date, service) {
  const { error } = await supabase.from('registros').insert({
    id: crypto.randomUUID(), escala_id: escalaId, funcionario_id: employeeId, empresa_id: companyId,
    data: date, servico: service || null, status: 'scheduled', confirmacao: 'aguardando', valor: 150,
  });
  if (error) { console.error('[db] addRegistroToEscala:', error.message); return false; }
  return true;
}

// ── Banco de Ajudantes (ajudantes disponíveis) ────────────────────────────

export async function fetchAjudantesDisponiveis(data) {
  const { data: escalados, error: eErr } = await supabase
    .from('registros')
    .select('funcionario_id')
    .eq('data', data);
  if (eErr) { console.error('[db] fetchAjudantesDisponiveis:', eErr.message); return []; }

  const escaladosIds = (escalados || []).map(r => r.funcionario_id);

  let q = supabase.from('funcionarios').select('*').eq('status', 'active');
  if (escaladosIds.length > 0) q = q.not('id', 'in', `(${escaladosIds.join(',')})`);

  const { data: rows, error } = await q.order('nome');
  if (error) { console.error('[db] fetchAjudantesDisponiveis rows:', error.message); return []; }
  return rows.map(r => ({ ...r, name: r.nome, initials: r.iniciais, color: r.cor, dailyRate: Number(r.diaria), cidade: r.cidade || '' }));
}

export async function fetchTodosAjudantes() {
  const { data, error } = await supabase
    .from('funcionarios')
    .select('id, nome, iniciais, cor, status, cargo, cidade, data_contratacao')
    .eq('status', 'active')
    .order('nome');
  if (error) { console.error('[db] fetchTodosAjudantes:', error.message); return []; }
  return (data || []).map(r => ({
    id:              r.id,
    name:            r.nome,
    initials:        r.iniciais,
    color:           r.cor,
    cargo:           r.cargo || '—',
    cidade:          r.cidade || '—',
    dataContratacao: r.data_contratacao || null,
  }));
}

// ── Presença por equipe (hoje) ─────────────────────────────────────────────

export async function fetchPresencaEquipeHoje(today) {
  const { data, error } = await supabase
    .from('escalas')
    .select('id, lider_id, lideres_equipe(nome, iniciais, cor), registros(confirmacao)')
    .eq('data', today)
    .not('lider_id', 'is', null);
  if (error) { console.error('[db] fetchPresencaEquipeHoje:', error.message); return []; }
  return (data || []).map(e => {
    const regs      = e.registros || [];
    const total     = regs.length;
    const presentes = regs.filter(r => ['confirmado','finalizado'].includes(r.confirmacao)).length;
    const ausentes  = regs.filter(r => r.confirmacao === 'falta').length;
    const atrasados = regs.filter(r => r.confirmacao === 'atrasado').length;
    return {
      escalaId:   e.id,
      liderId:    e.lider_id,
      liderNome:  e.lideres_equipe?.nome || '—',
      liderIni:   e.lideres_equipe?.iniciais || '?',
      liderCor:   e.lideres_equipe?.cor || '#FF4D0C',
      total, presentes, ausentes, atrasados,
      sla: total > 0 ? Math.round((presentes / total) * 100) : null,
    };
  });
}

// ── Ocorrências (admin — com nomes) ───────────────────────────────────────

export async function fetchOcorrenciasAdmin() {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('*, funcionarios(nome, iniciais, cor), lideres_equipe(nome), empresas(nome)')
    .order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchOcorrenciasAdmin:', error.message); return []; }
  return (data || []).map(o => ({
    ...o,
    ajudanteNome: o.funcionarios?.nome || '—',
    ajudanteIni:  o.funcionarios?.iniciais || '?',
    ajudanteCor:  o.funcionarios?.cor || '#94A3B8',
    liderNome:    o.lideres_equipe?.nome || '—',
    empresaNome:  o.empresas?.nome || '—',
  }));
}

export async function updateOcorrenciaStatusAdmin(id, status) {
  const { error } = await supabase.from('ocorrencias').update({ status }).eq('id', id);
  if (error) { console.error('[db] updateOcorrenciaStatusAdmin:', error.message); }
}

// ── Todas as escalas de uma empresa (com líder) ───────────────────────────

export async function fetchEscalasComLiderByEmpresa(companyId) {
  const { data, error } = await supabase
    .from('escalas')
    .select('id, data, horario, servico, status, lider_id, lideres_equipe(id, nome, telefone, iniciais, cor)')
    .eq('empresa_id', companyId)
    .order('data', { ascending: false });
  if (error) { console.error('[db] fetchEscalasComLiderByEmpresa:', error.message); return []; }
  return (data || []).map(e => ({
    id:      e.id,
    date:    e.data,
    time:    e.horario,
    service: e.servico,
    status:  e.status,
    lider:   e.lideres_equipe || null,
  }));
}

// ── Escala de hoje por empresa (com líder) ────────────────────────────────

export async function fetchEscalaHojeByEmpresa(empresaId, today) {
  const { data, error } = await supabase
    .from('escalas')
    .select('*, lideres_equipe(nome, telefone, email, cor, iniciais)')
    .eq('empresa_id', empresaId)
    .eq('data', today)
    .maybeSingle();
  if (error) { console.error('[db] fetchEscalaHojeByEmpresa:', error.message); return null; }
  if (!data) return null;
  return {
    ...data,
    lider: data.lideres_equipe ? {
      nome:     data.lideres_equipe.nome,
      telefone: data.lideres_equipe.telefone,
      email:    data.lideres_equipe.email,
      cor:      data.lideres_equipe.cor,
      iniciais: data.lideres_equipe.iniciais,
    } : null,
  };
}

// ── Relatórios do líder por empresa ───────────────────────────────────────

export async function fetchRelatoriosByEmpresa(empresaId) {
  const { data, error } = await supabase
    .from('relatorios_diarios')
    .select('*, lideres_equipe(nome, iniciais, cor)')
    .eq('empresa_id', empresaId)
    .order('data', { ascending: false })
    .limit(30);
  if (error) { console.error('[db] fetchRelatoriosByEmpresa:', error.message); return []; }
  return (data || []).map(r => ({
    ...r,
    liderNome: r.lideres_equipe?.nome || '—',
    liderIni:  r.lideres_equipe?.iniciais || '?',
    liderCor:  r.lideres_equipe?.cor || '#FF4D0C',
  }));
}

// ── Ajudantes sem ponto hoje ───────────────────────────────────────────────

export async function fetchAjudantesSemPontoHoje(today) {
  const { data, error } = await supabase
    .from('registros')
    .select('*, funcionarios(nome, iniciais, cor)')
    .eq('data', today)
    .is('entrada', null)
    .neq('confirmacao', 'falta');
  if (error) { console.error('[db] fetchAjudantesSemPontoHoje:', error.message); return []; }
  return (data || []).map(r => ({
    ...r,
    funcionarioNome: r.funcionarios?.nome || '—',
    funcionarioIni:  r.funcionarios?.iniciais || '?',
    funcionarioCor:  r.funcionarios?.cor || '#94A3B8',
  }));
}
