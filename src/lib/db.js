import { supabase } from './supabase';
import { calculateWorkAndOvertime, overtimeMinutesToTimeString, recordRevenue } from './timeUtils';
import { getCompanyCity, rankCandidatos, avatarTone, compararProximidade } from './notas';
import { coordsFuncionario, coordsEmpresa, distanciaKm, jitterCoords } from './geo';
import { parseCidade, parseEmpresaLocalizacao, normalizarCidade, cidadeMaisProxima, coordsDeLink } from './cidades.js';

// ── Helpers ────────────────────────────────────────────────────────────────

// Normaliza qualquer string de hora para HH:MM (descarta segundos se presentes)
function fmtHHMM(t) {
  if (!t) return null;
  const parts = String(t).split(':');
  return `${parts[0].padStart(2,'0')}:${(parts[1] ?? '00').padStart(2,'0')}`;
}

// Colunas base do funcionário e extensão opcional com o endereço residencial.
const EMPLOYEE_BASE_COLUMNS =
  'id, nome, iniciais, cor, cargo, telefone, cidade, latitude, longitude, diaria, status';
const EMPLOYEE_ADDRESS_COLUMNS =
  `${EMPLOYEE_BASE_COLUMNS}, endereco, bairro, cep, localizacao`;

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
    observacoes: r.observacoes || null,
    tipoServico: r.escalas?.tipo_servico || 'entrega',
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
    color:           avatarTone(r.id || r.nome),
    status:          r.status,
    dailyRate:       Number(r.diaria),
    overtimeRate:    Number(r.hora_extra ?? 50),
    vtDiario:        Number(r.vt_diario ?? 0),
    vrDiario:        Number(r.vr_diario ?? 0),
    cidade:          normalizarCidade(r.cidade),
    address:         r.endereco || '',
    neighborhood:    r.bairro || '',
    zip:             r.cep || '',
    location:        r.localizacao || '',
    latitude:        r.latitude == null ? null : Number(r.latitude),
    longitude:       r.longitude == null ? null : Number(r.longitude),
    dataContratacao: r.data_contratacao || null,
    documentoUrl:    r.documento_url || null,
  };
}

function mapCompany(r) {
  if (!r) return null;
  const local = parseEmpresaLocalizacao({ endereco: r.endereco, localizacao: r.localizacao });
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
    city:      local.display || '',
    cityUf:    local.uf || null,
    latitude:  r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    dailyRate:      Number(r.diaria ?? 150),
    valorDescarga:  Number(r.valor_descarga ?? 0),
    prazoPagamento: Number(r.prazo_pagamento ?? 5),
    isActive:       r.ativo,
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
    tipoServico:     escala.tipo_servico || 'entrega',
    vagas:           escala.vagas ?? null,
    totalReservas:   escala.total_reservas ?? 2,
    pagamentoEm:     escala.pagamento_em || null,
    responsavelDia:  escala.responsavel_dia || '',
    contatoDia:      escala.contato_dia     || '',
    liderId:         escala.lider_id        || null,
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
    color:       avatarTone(data.id || data.nome),
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

// Colunas de endereço são opcionais no banco: se a migração ainda não rodou,
// o salvamento continua funcionando sem elas (a busca cai para a cidade).
function missingColumnName(error) {
  const msg = String(error?.message || '');
  if (!isMissingColumn(error)) return null;
  const m = msg.match(/column "([^"]+)" of relation/i)
    || msg.match(/column (?:[a-z_]+\.)?([a-z_]+) does not exist/i)
    || msg.match(/the '([^']+)' column/i);
  return m ? (m[1] || m[2] || m[3]) : null;
}

function coordsDoCadastro(emp) {
  const latRaw = emp?.latitude;
  const lngRaw = emp?.longitude;
  if (latRaw !== null && latRaw !== undefined && latRaw !== '' &&
      lngRaw !== null && lngRaw !== undefined && lngRaw !== '') {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { lat, lng };
    }
  }
  return coordsDeLink(emp?.location || emp?.localizacao);
}

async function insertEmployeeRow(payload) {
  let atual = { ...payload };
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const { data, error } = await supabase.from('funcionarios').insert(atual).select().single();
    if (!error) return { data, error: null };
    const col = missingColumnName(error);
    if (!col || !(col in atual)) return { data: null, error };
    console.warn(`[db] createEmployee: coluna ${col} ausente — rode supabase/funcionario-endereco.sql. Salvando sem ela.`);
    delete atual[col];
  }
  return { data: null, error: new Error('Não foi possível salvar o funcionário.') };
}

async function updateEmployeeRow(id, patch) {
  let atual = { ...patch };
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const { data, error } = await supabase
      .from('funcionarios')
      .update(atual)
      .eq('id', id)
      .select()
      .single();
    if (!error) return { data, error: null };
    const col = missingColumnName(error);
    if (!col || !(col in atual)) return { data: null, error };
    console.warn(`[db] updateEmployee: coluna ${col} ausente — rode supabase/funcionario-endereco.sql. Salvando sem ela.`);
    delete atual[col];
  }
  return { data: null, error: new Error('Não foi possível salvar o funcionário.') };
}

export async function createEmployee(emp) {
  const coords = coordsDoCadastro(emp);
  const payload = {
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
    cidade:   normalizarCidade(emp.cidade) || null,
    documento_url: emp.documentoUrl || null,
    latitude:  coords?.lat ?? null,
    longitude: coords?.lng ?? null,
  };
  if (emp.address)      payload.endereco    = emp.address;
  if (emp.neighborhood) payload.bairro      = emp.neighborhood;
  if (emp.zip)          payload.cep         = emp.zip;
  if (emp.location)     payload.localizacao = emp.location;

  const { data, error } = await insertEmployeeRow(payload);
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
  if (emp.vtDiario     !== undefined) patch.vt_diario  = emp.vtDiario;
  if (emp.vrDiario     !== undefined) patch.vr_diario  = emp.vrDiario;
  if (emp.cidade       !== undefined) patch.cidade     = normalizarCidade(emp.cidade);
  if (emp.documentoUrl !== undefined) patch.documento_url = emp.documentoUrl;

  if (emp.address      !== undefined) patch.endereco    = emp.address || null;
  if (emp.neighborhood !== undefined) patch.bairro      = emp.neighborhood || null;
  if (emp.zip          !== undefined) patch.cep         = emp.zip || null;
  if (emp.location     !== undefined) patch.localizacao = emp.location || null;

  const latInformada = emp.latitude;
  const lngInformada = emp.longitude;
  const linkCoords   = coordsDeLink(emp.location || emp.localizacao);
  if (latInformada !== undefined || lngInformada !== undefined) {
    const lat = Number(latInformada);
    const lng = Number(lngInformada);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      patch.latitude  = lat;
      patch.longitude = lng;
    } else if (linkCoords) {
      patch.latitude  = linkCoords.lat;
      patch.longitude = linkCoords.lng;
    } else {
      patch.latitude  = null;
      patch.longitude = null;
    }
  } else if (linkCoords) {
    patch.latitude  = linkCoords.lat;
    patch.longitude = linkCoords.lng;
  }

  const { data, error } = await updateEmployeeRow(id, patch);
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

export async function fetchCompanyById(id) {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) { console.error('[db] fetchCompanyById:', error.message); return null; }
  return data ? mapCompany(data) : null;
}

// Diária vigente da empresa (configurada no admin) — usada ao gravar novos registros.
export async function getCompanyDiaria(companyId) {
  if (!companyId) return 150;
  const { data, error } = await supabase
    .from('empresas')
    .select('diaria')
    .eq('id', companyId)
    .maybeSingle();
  if (error) { console.error('[db] getCompanyDiaria:', error.message); return 150; }
  const v = Number(data?.diaria);
  return Number.isFinite(v) && v > 0 ? v : 150;
}

// A coluna prazo_pagamento exige o migration supabase/prazo-pagamento.sql;
// se ainda não existir no Supabase, salva/altera sem o campo para não travar o cadastro.
function missingPrazoColumn(error) {
  return error && /prazo_pagamento/.test(error.message || '');
}

export async function createCompany(co) {
  const coords = coordsDoCadastro(co);
  const payload = {
    id:          co.id,
    nome:        co.name,
    cnpj:        co.cnpj || null,
    email:       co.email,
    senha:       co.password,
    telefone:    co.phone || null,
    responsavel: co.contact || null,
    endereco:    co.address || null,
    localizacao: co.location || null,
    latitude:    coords?.lat ?? null,
    longitude:   coords?.lng ?? null,
    diaria:          co.dailyRate ?? 150,
    valor_descarga:  co.valorDescarga ?? 0,
    prazo_pagamento: co.prazoPagamento ?? 5,
  };
  let { data, error } = await supabase.from('empresas').insert(payload).select().single();
  if (error && missingPrazoColumn(error)) {
    console.warn('[db] createCompany: coluna prazo_pagamento ausente — rode supabase/prazo-pagamento.sql no Supabase.');
    delete payload.prazo_pagamento;
    ({ data, error } = await supabase.from('empresas').insert(payload).select().single());
  }
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
  if (co.dailyRate      !== undefined) patch.diaria          = co.dailyRate;
  if (co.valorDescarga  !== undefined) patch.valor_descarga  = co.valorDescarga;
  if (co.prazoPagamento !== undefined) patch.prazo_pagamento = co.prazoPagamento;

  const latInformada = co.latitude;
  const lngInformada = co.longitude;
  const linkCoords   = coordsDeLink(co.location || co.localizacao);
  if (latInformada !== undefined || lngInformada !== undefined) {
    const lat = Number(latInformada);
    const lng = Number(lngInformada);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      patch.latitude  = lat;
      patch.longitude = lng;
    } else if (linkCoords) {
      patch.latitude  = linkCoords.lat;
      patch.longitude = linkCoords.lng;
    } else {
      patch.latitude  = null;
      patch.longitude = null;
    }
  } else if (linkCoords) {
    patch.latitude  = linkCoords.lat;
    patch.longitude = linkCoords.lng;
  }

  let { data, error } = await supabase
    .from('empresas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error && missingPrazoColumn(error)) {
    console.warn('[db] updateCompany: coluna prazo_pagamento ausente — rode supabase/prazo-pagamento.sql no Supabase.');
    delete patch.prazo_pagamento;
    ({ data, error } = await supabase
      .from('empresas')
      .update(patch)
      .eq('id', id)
      .select()
      .single());
  }
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

export async function createDemand({
  companyId, date, time, service, employeeIds, adminId, liderId, tipoServico,
  entrada, saida, saidaAlmoco, retornoAlmoco, employeeTimes,
}) {
  const diaria = await getCompanyDiaria(companyId);
  const escalaId = crypto.randomUUID();
  const escalaStatus = saida ? 'completed' : (entrada || time) ? 'active' : 'scheduled';

  const { data: escala, error: escErr } = await supabase
    .from('escalas')
    .insert({
      id:           escalaId,
      empresa_id:   companyId,
      data:         date,
      horario:      time || entrada || null,
      servico:      service || null,
      tipo_servico: tipoServico || 'entrega',
      status:       escalaStatus,
      criado_por:   adminId || null,
      lider_id:     liderId || null,
    })
    .select()
    .single();

  if (escErr) { console.error('[db] createDemand escala:', escErr.message); return null; }

  const workRecords = employeeIds.map(empId => {
    const custom = employeeTimes?.[empId] || {};
    const empEntrada = custom.entrada !== undefined ? (custom.entrada || null) : (entrada || time || null);
    const empSaida   = custom.saida   !== undefined ? (custom.saida   || null) : (saida || null);
    const empAlmocoS = custom.saidaAlmoco   !== undefined ? (custom.saidaAlmoco   || null) : (saidaAlmoco || null);
    const empAlmocoR = custom.retornoAlmoco !== undefined ? (custom.retornoAlmoco || null) : (retornoAlmoco || null);

    let status = 'scheduled';
    let confirmacao = 'aguardando';
    if (custom.status) {
      status = custom.status === 'falta' ? 'absent' : custom.status === 'finalizado' ? 'completed' : 'active';
      confirmacao = custom.status;
    } else if (empSaida) {
      status = 'completed';
      confirmacao = 'finalizado';
    } else if (empEntrada) {
      status = 'active';
      confirmacao = 'confirmado';
    }

    const calc = calculateWorkAndOvertime(empEntrada, empSaida, empAlmocoS, empAlmocoR);

    return {
      id:             crypto.randomUUID(),
      escala_id:      escalaId,
      funcionario_id: empId,
      empresa_id:     companyId,
      data:           date,
      servico:        service || null,
      status,
      confirmacao,
      entrada:        empEntrada,
      saida:          empSaida,
      saida_almoco:   empAlmocoS,
      retorno_almoco: empAlmocoR,
      hora_extra:     overtimeMinutesToTimeString(calc.overtimeMinutes),
      valor:          diaria,
    };
  });

  const { error: wrErr } = await supabase.from('registros').insert(workRecords);
  if (wrErr) { console.error('[db] createDemand registros:', wrErr.message); return null; }

  return mapDemand({ ...escala, registros: workRecords });
}

export async function updateDemandEmployeeStatus(escalaId, employeeId, confirmacao) {
  const statusMap = {
    falta: 'absent',
    finalizado: 'completed',
    confirmado: 'active',
    atrasado: 'active',
    aguardando: 'scheduled',
  };
  const patch = {
    confirmacao,
    status: statusMap[confirmacao] || 'active',
  };
  const { error } = await supabase
    .from('registros')
    .update(patch)
    .eq('escala_id', escalaId)
    .eq('funcionario_id', employeeId);
  if (error) { console.error('[db] updateDemandEmployeeStatus:', error.message); }
}

export async function updateDemandEmployeeTimes(escalaId, employeeId, times) {
  const patch = {};
  if (times.entrada       !== undefined) patch.entrada        = times.entrada       || null;
  if (times.saidaAlmoco   !== undefined) patch.saida_almoco   = times.saidaAlmoco   || null;
  if (times.retornoAlmoco !== undefined) patch.retorno_almoco = times.retornoAlmoco || null;
  if (times.saida         !== undefined) patch.saida          = times.saida         || null;

  if (patch.saida) {
    patch.status = 'completed';
    patch.confirmacao = 'finalizado';
  } else if (patch.entrada) {
    patch.status = 'active';
    patch.confirmacao = 'confirmado';
  } else if (times.entrada === '' && times.saida === '') {
    patch.status = 'scheduled';
    patch.confirmacao = 'aguardando';
  }

  // Recalcula hora extra caso tenha entrada e saída
  if (patch.entrada !== undefined || patch.saida !== undefined || patch.saida_almoco !== undefined || patch.retorno_almoco !== undefined) {
    // Busca dados atuais caso algum campo não esteja no patch
    const { data: curr } = await supabase
      .from('registros')
      .select('entrada, saida, saida_almoco, retorno_almoco')
      .eq('escala_id', escalaId)
      .eq('funcionario_id', employeeId)
      .maybeSingle();

    const finalEntrada = patch.entrada !== undefined ? patch.entrada : curr?.entrada;
    const finalSaida   = patch.saida   !== undefined ? patch.saida   : curr?.saida;
    const finalAlmocoS = patch.saida_almoco !== undefined ? patch.saida_almoco : curr?.saida_almoco;
    const finalAlmocoR = patch.retorno_almoco !== undefined ? patch.retorno_almoco : curr?.retorno_almoco;

    const calc = calculateWorkAndOvertime(finalEntrada, finalSaida, finalAlmocoS, finalAlmocoR);
    patch.hora_extra = overtimeMinutesToTimeString(calc.overtimeMinutes);
  }

  const { error } = await supabase
    .from('registros')
    .update(patch)
    .eq('escala_id', escalaId)
    .eq('funcionario_id', employeeId);
  if (error) { console.error('[db] updateDemandEmployeeTimes:', error.message); }
}

export async function updateDemandAllTimes(escalaId, times) {
  const patch = {};
  if (times.entrada       !== undefined) patch.entrada        = times.entrada       || null;
  if (times.saidaAlmoco   !== undefined) patch.saida_almoco   = times.saidaAlmoco   || null;
  if (times.retornoAlmoco !== undefined) patch.retorno_almoco = times.retornoAlmoco || null;
  if (times.saida         !== undefined) patch.saida          = times.saida         || null;

  if (patch.saida) {
    patch.status = 'completed';
    patch.confirmacao = 'finalizado';
  } else if (patch.entrada) {
    patch.status = 'active';
    patch.confirmacao = 'confirmado';
  }

  const calc = calculateWorkAndOvertime(patch.entrada, patch.saida, patch.saidaAlmoco, patch.retornoAlmoco);
  if (calc.isComplete) {
    patch.hora_extra = overtimeMinutesToTimeString(calc.overtimeMinutes);
  }

  const { error } = await supabase
    .from('registros')
    .update(patch)
    .eq('escala_id', escalaId);
  if (error) { console.error('[db] updateDemandAllTimes:', error.message); return false; }
  return true;
}

export async function deleteDemand(id) {
  await supabase.from('registros').delete().eq('escala_id', id);
  const { error } = await supabase.from('escalas').delete().eq('id', id);
  if (error) { console.error('[db] deleteDemand:', error.message); return false; }
  return true;
}

// Exclui a escala/convocação; as convocações e respostas caem por cascade.
export async function deleteConvocacao(escalaId) {
  return deleteDemand(escalaId);
}

// Arquiva: marca como concluído preservando a escala e os registros no histórico
export async function archiveDemand(id) {
  const { error } = await supabase.from('escalas').update({ status: 'completed' }).eq('id', id);
  if (error) { console.error('[db] archiveDemand:', error.message); return false; }
  return true;
}

export async function editDemand(id, {
  companyId, date, time, service, selectedEmployees, liderId, tipoServico,
  entrada, saida, saidaAlmoco, retornoAlmoco, employeeTimes,
}) {
  const { error: escErr } = await supabase
    .from('escalas')
    .update({
      empresa_id: companyId,
      data: date,
      horario: time || entrada || null,
      servico: service,
      lider_id: liderId || null,
      tipo_servico: tipoServico || 'entrega',
    })
    .eq('id', id);
  if (escErr) { console.error('[db] editDemand escala:', escErr.message); return false; }

  // Atualiza também data, empresa_id e servico nos registros existentes
  await supabase
    .from('registros')
    .update({ data: date, empresa_id: companyId, servico: service || null })
    .eq('escala_id', id);

  const { data: existing } = await supabase
    .from('registros')
    .select('*')
    .eq('escala_id', id);

  const existingIds = (existing || []).map(r => r.funcionario_id);
  const toRemove = existingIds.filter(eId => !selectedEmployees.includes(eId));
  const toAdd    = selectedEmployees.filter(eId => !existingIds.includes(eId));

  if (toRemove.length > 0) {
    await supabase.from('registros').delete().eq('escala_id', id).in('funcionario_id', toRemove);
  }
  if (toAdd.length > 0) {
    const diaria = await getCompanyDiaria(companyId);
    const toInsert = toAdd.map(empId => {
      const custom = employeeTimes?.[empId] || {};
      const empEntrada = custom.entrada !== undefined ? (custom.entrada || null) : (entrada || time || null);
      const empSaida   = custom.saida   !== undefined ? (custom.saida   || null) : (saida || null);
      const empAlmocoS = custom.saidaAlmoco   !== undefined ? (custom.saidaAlmoco   || null) : (saidaAlmoco || null);
      const empAlmocoR = custom.retornoAlmoco !== undefined ? (custom.retornoAlmoco || null) : (retornoAlmoco || null);

      let status = 'scheduled';
      let confirmacao = 'aguardando';
      if (custom.status) {
        status = custom.status === 'falta' ? 'absent' : custom.status === 'finalizado' ? 'completed' : 'active';
        confirmacao = custom.status;
      } else if (empSaida) {
        status = 'completed';
        confirmacao = 'finalizado';
      } else if (empEntrada) {
        status = 'active';
        confirmacao = 'confirmado';
      }

      const calc = calculateWorkAndOvertime(empEntrada, empSaida, empAlmocoS, empAlmocoR);

      return {
        id: crypto.randomUUID(),
        escala_id: id,
        funcionario_id: empId,
        empresa_id: companyId,
        data: date,
        servico: service || null,
        status,
        confirmacao,
        entrada: empEntrada,
        saida: empSaida,
        saida_almoco: empAlmocoS,
        retorno_almoco: empAlmocoR,
        hora_extra: overtimeMinutesToTimeString(calc.overtimeMinutes),
        valor: diaria,
      };
    });
    await supabase.from('registros').insert(toInsert);
  }

  // Atualiza os registros que continuam existindo caso tenham novos horários passados
  if (employeeTimes) {
    for (const [empId, times] of Object.entries(employeeTimes)) {
      if (selectedEmployees.includes(empId)) {
        await updateDemandEmployeeTimes(id, empId, times);
      }
    }
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
    .select('*, escalas(tipo_servico)')
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
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'escalas',
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
    color:     avatarTone(l.id || l.nome),
    companyName: l.lider_empresas?.map(le => le.empresas?.nome).filter(Boolean).join(', ') || '—',
    companyIds:  l.lider_empresas?.map(le => le.empresa_id) || [],
  }));
}

// Retorna { lider, error }. O erro real precisa subir até a tela: sem isso o
// admin só via a mensagem genérica de e-mail em uso.
// Obs.: não usar embed de empresas aqui — lideres_equipe tem duas relações com
// empresas (empresa_id e lider_empresas), e o PostgREST recusa o embed ambíguo
// (PGRST201), fazendo a criação da conta falhar.
export async function createLider(lider) {
  const { data, error } = await supabase
    .from('lideres_equipe')
    .insert({ id: crypto.randomUUID(), nome: lider.name, email: lider.email, telefone: lider.phone, senha: lider.password, iniciais: lider.initials, cor: lider.color || '#0B0B0B', empresa_id: lider.companyId || null })
    .select('*')
    .single();
  if (error) { console.error('[db] createLider:', error.message); return { lider: null, error }; }
  return { lider: { ...data, name: data.nome, initials: data.iniciais, color: avatarTone(data.id || data.nome) }, error: null };
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
    .select('empresa_id, empresas(id, nome, telefone, responsavel, endereco, localizacao, latitude, longitude)')
    .eq('lider_id', liderId);
  if (error) { console.error('[db] fetchEmpresasDoLider:', error.message); return []; }
  return (data || []).map(r => ({
    id:          r.empresa_id,
    name:        r.empresas?.nome        || '—',
    telefone:    r.empresas?.telefone    || null,
    responsavel: r.empresas?.responsavel || null,
    address:     r.empresas?.endereco    || '',
    location:    r.empresas?.localizacao || '',
    city:        getCompanyCity({ address: r.empresas?.endereco, location: r.empresas?.localizacao }),
    latitude:    r.empresas?.latitude == null ? null : Number(r.empresas.latitude),
    longitude:   r.empresas?.longitude == null ? null : Number(r.empresas.longitude),
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

// ── Encarregados: vínculos com período, desempenho e atividade ─────────────

const isoDay = d => d.toISOString().slice(0, 10);

// Últimos 30 dias (inclusive hoje)
function defaultLiderPeriod() {
  const to   = new Date();
  const from = new Date(to.getTime() - 29 * 86400000);
  return { from: isoDay(from), to: isoDay(to) };
}

function presencaDe({ diarias, faltas }) {
  const base = diarias + faltas;
  return base ? Math.round((diarias / base) * 100) : 100;
}

// Vínculos do encarregado com as empresas e o período de responsabilidade.
// Depende das colunas de/ate (supabase/lider-vinculos.sql); enquanto o SQL não
// for aplicado, cai no formato antigo para a tela não quebrar.
export async function fetchLiderVinculos(liderId) {
  const { data, error } = await supabase
    .from('lider_empresas')
    .select('empresa_id, de, ate, empresas(nome)')
    .eq('lider_id', liderId)
    .order('de', { ascending: true });

  if (error) {
    const { data: old, error: oldErr } = await supabase
      .from('lider_empresas')
      .select('empresa_id, empresas(nome)')
      .eq('lider_id', liderId);
    if (oldErr) { console.error('[db] fetchLiderVinculos:', oldErr.message); return []; }
    return (old || []).map(r => ({ empresaId: r.empresa_id, nome: r.empresas?.nome || '—', de: null, ate: null, atual: true }));
  }

  return (data || []).map(r => ({
    empresaId: r.empresa_id,
    nome:      r.empresas?.nome || '—',
    de:        r.de  || null,
    ate:       r.ate || null,
    atual:     !r.ate,
  }));
}

// Encarregado responsável hoje por cada empresa (para rotular as substituições)
export async function fetchResponsaveisAtivos(empresaIds) {
  if (!empresaIds?.length) return {};
  const { data, error } = await supabase
    .from('lider_empresas')
    .select('empresa_id, lider_id, lideres_equipe(nome)')
    .in('empresa_id', empresaIds)
    .is('ate', null);
  if (error) { console.error('[db] fetchResponsaveisAtivos:', error.message); return {}; }
  return Object.fromEntries((data || []).map(r => [
    r.empresa_id, { liderId: r.lider_id, nome: r.lideres_equipe?.nome || null },
  ]));
}

// Desempenho do encarregado por empresa no período (padrão: últimos 30 dias).
// Só conta os lançamentos dentro do intervalo em que ele foi o responsável por
// cada empresa, então trocas de encarregado não misturam o desempenho.
export async function fetchLiderDesempenho(liderId, period) {
  const { from, to } = period || defaultLiderPeriod();
  const vazio = { empresas: [], total: { diarias: 0, faltas: 0, pend: 0, faturado: 0 }, presenca: 0, from, to };

  const { data, error } = await supabase
    .from('escalas')
    .select('id, data, empresa_id, empresas(nome, diaria), registros(status, hora_extra)')
    .eq('lider_id', liderId)
    .gte('data', from)
    .lte('data', to)
    .order('data', { ascending: false });

  if (error) { console.error('[db] fetchLiderDesempenho:', error.message); return vazio; }

  const vinculos = await fetchLiderVinculos(liderId);
  const porEmpresa = new Map();

  for (const esc of data || []) {
    const vinculado = vinculos.filter(v => v.empresaId === esc.empresa_id);
    const dentro = (date) => !vinculado.length || vinculado.some(v =>
      (!v.de || date >= v.de) && (!v.ate || date <= v.ate));
    if (!dentro(esc.data)) continue;

    const diaria = Number(esc.empresas?.diaria ?? 150);
    if (!porEmpresa.has(esc.empresa_id)) {
      porEmpresa.set(esc.empresa_id, {
        empresaId: esc.empresa_id, nome: esc.empresas?.nome || '—',
        diaria, diarias: 0, faltas: 0, pend: 0, faturado: 0,
      });
    }
    const row = porEmpresa.get(esc.empresa_id);

    for (const reg of esc.registros || []) {
      if (reg.status === 'completed') {
        row.diarias  += 1;
        row.faturado += recordRevenue({ companyId: esc.empresa_id, overtime: reg.hora_extra }, { [esc.empresa_id]: { dailyRate: diaria } });
      } else if (reg.status === 'absent') {
        row.faltas   += 1;
      } else {
        row.pend     += 1;   // aguardando ou em andamento, sem fechamento
      }
    }
  }

  const empresas = [...porEmpresa.values()]
    .map(r => ({ ...r, presenca: presencaDe(r) }))
    .sort((a, b) => b.faturado - a.faturado);

  const total = empresas.reduce((s, r) => ({
    diarias: s.diarias + r.diarias, faltas: s.faltas + r.faltas,
    pend: s.pend + r.pend, faturado: s.faturado + r.faturado,
  }), { diarias: 0, faltas: 0, pend: 0, faturado: 0 });

  const presenca = empresas.length
    ? Math.round(empresas.reduce((s, r) => s + r.presenca, 0) / empresas.length)
    : 0;

  return { empresas, total, presenca, from, to };
}

// Atividade recente do encarregado: lançamentos de diárias e ocorrências.
export async function fetchLiderAtividade(liderId, limite = 6) {
  const { data, error } = await supabase
    .from('escalas')
    .select('id, data, empresas(nome), registros(confirmacao, entrada, saida)')
    .eq('lider_id', liderId)
    .order('data', { ascending: false })
    .limit(limite);

  if (error) { console.error('[db] fetchLiderAtividade:', error.message); return []; }

  const eventos = (data || []).map(esc => {
    const regs    = esc.registros || [];
    const empresa = esc.empresas?.nome || '—';
    const faltas  = regs.filter(r => r.confirmacao === 'falta').length;
    const fechados = regs.filter(r => r.confirmacao === 'finalizado').length;
    const abertos = regs.filter(r => r.confirmacao !== 'falta' && r.confirmacao !== 'finalizado').length;

    if (faltas)        return { data: esc.data, ok: false, txt: `Registrou ${faltas} falta${faltas > 1 ? 's' : ''} · ${empresa}` };
    if (fechados)      return { data: esc.data, ok: true,  txt: `Finalizou ${fechados} diária${fechados > 1 ? 's' : ''} · ${empresa}` };
    if (abertos)       return { data: esc.data, ok: true,  txt: `${abertos} lançamento${abertos > 1 ? 's' : ''} em andamento · ${empresa}` };
    return { data: esc.data, ok: true, txt: `Escala lançada · ${empresa}` };
  });

  return eventos.slice(0, limite);
}

// Cria a conta do encarregado e registra os vínculos iniciais (período começa hoje)
// Retorna { lider, error } para a tela distinguir e-mail duplicado de falha real.
export async function createEncarregado({ name, email, phone, password, initials, color, empresaIds }) {
  const { lider, error } = await createLider({ name, email, phone, password, initials, color });
  if (!lider) return { lider: null, error };
  if (empresaIds?.length) await setLiderEmpresasComPeriodo(lider.id, empresaIds);
  return { lider, error: null };
}

// Ajusta as empresas do encarregado preservando o histórico: encerra (ate = hoje)
// os vínculos que saíram e abre (de = hoje) os que entraram. Quando a empresa
// passa para outro encarregado, o vínculo ativo desse outro também é encerrado.
export async function setLiderEmpresasComPeriodo(liderId, empresaIds) {
  const hoje = isoDay(new Date());
  const ids  = [...new Set(empresaIds || [])];

  const atuais    = await fetchLiderVinculos(liderId);
  const atuaisIds = atuais.filter(v => v.atual).map(v => v.empresaId);

  const remover  = atuaisIds.filter(id => !ids.includes(id));
  const adicionar = ids.filter(id => !atuaisIds.includes(id));

  if (remover.length) {
    const { error } = await supabase.from('lider_empresas')
      .update({ ate: hoje }).eq('lider_id', liderId).in('empresa_id', remover).is('ate', null);
    if (error) {
      console.error('[db] setLiderEmpresasComPeriodo encerrar:', error.message);
      // Sem as colunas de período (supabase/lider-vinculos.sql pendente) o
      // vínculo sai de vez, senão a empresa continuaria como responsabilidade dele.
      if (error.code === 'PGRST204') {
        await supabase.from('lider_empresas').delete().eq('lider_id', liderId).in('empresa_id', remover);
      }
    }
  }

  if (adicionar.length) {
    const { error: errTroca } = await supabase.from('lider_empresas')
      .update({ ate: hoje }).in('empresa_id', adicionar).neq('lider_id', liderId).is('ate', null);
    if (errTroca) console.error('[db] setLiderEmpresasComPeriodo troca:', errTroca.message);

    const rows = adicionar.map(id => ({ lider_id: liderId, empresa_id: id, de: hoje, ate: null }));
    const { error } = await supabase.from('lider_empresas').insert(rows);
    if (error) {
      // Sem as colunas de período (SQL pendente) grava só o vínculo, para a
      // empresa não ficar de fora da conta do encarregado.
      console.error('[db] setLiderEmpresasComPeriodo inserir:', error.message);
      await supabase.from('lider_empresas')
        .insert(adicionar.map(id => ({ lider_id: liderId, empresa_id: id })));
    }
  }

  return true;
}

// ── Relatórios Diários ────────────────────────────────────────────────────

export async function fetchRelatorioByEmpresaData(empresaId, date) {
  const { data, error } = await supabase
    .from('relatorios_diarios')
    .select('*, lideres_equipe(nome, iniciais, cor)')
    .eq('empresa_id', empresaId)
    .eq('data', date)
    .maybeSingle();
  if (error) { console.error('[db] fetchRelatorioByEmpresaData:', error.message); return null; }
  return data;
}

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
    .upsert({ id: rel.id || crypto.randomUUID(), lider_id: rel.liderId, empresa_id: rel.empresaId, data: rel.data, presentes: rel.presentes, ausentes: rel.ausentes, observacoes: rel.observacoes, finalizado: rel.finalizado, fotos_urls: rel.fotosUrls || [] }, { onConflict: 'lider_id,data' })
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

export async function uploadDocumentoFuncionario(file, employeeId) {
  const path = `${employeeId}/${Date.now()}.pdf`;
  const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
  if (error) { console.error('[db] uploadDocumentoFuncionario:', error.message); return null; }
  const { data } = supabase.storage.from('documentos').getPublicUrl(path);
  return data.publicUrl;
}

// ── Tarefas do Admin → Líder ─────────────────────────────────────────────

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

export async function fetchTodasTarefasAdmin() {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, lideres_equipe:destinatario_id(nome)')
    .order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchTodasTarefasAdmin:', error.message); return []; }
  return (data || []).map(t => ({
    ...t,
    destinatarioNome: t.destinatario_tipo === 'todos_lideres' ? 'Todos os Líderes'
      : t['lideres_equipe']?.nome || '—',
  }));
}

export async function concluirTarefaAdmin(id) {
  const { error } = await supabase.from('tarefas')
    .update({ status: 'concluido', concluido_em: new Date().toISOString() })
    .eq('id', id);
  if (error) { console.error('[db] concluirTarefaAdmin:', error.message); }
}

// ── Solicitações de Ajudantes (Líder → Admin) ────────────────────────────

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

export async function createEscalaByLider({ liderId, companyId, date, time, service, employees, responsavelDia, contatoDia, tipoServico }) {
  const diaria = await getCompanyDiaria(companyId);
  const escalaId = crypto.randomUUID();
  const { data: escala, error: escErr } = await supabase
    .from('escalas')
    .insert({ id: escalaId, empresa_id: companyId, data: date, horario: time || null, servico: service || null, tipo_servico: tipoServico || 'entrega', status: 'scheduled', lider_id: liderId, responsavel_dia: responsavelDia || null, contato_dia: contatoDia || null })
    .select()
    .single();
  if (escErr) { console.error('[db] createEscalaByLider:', escErr.message); return null; }

  if (employees.length > 0) {
    const registros = employees.map(({ id: empId, observacoes }) => ({
      id: crypto.randomUUID(), escala_id: escalaId, funcionario_id: empId, empresa_id: companyId,
      data: date, servico: service || null, status: 'scheduled', confirmacao: 'aguardando', valor: diaria,
      observacoes: observacoes || null,
    }));
    const { error: rErr } = await supabase.from('registros').insert(registros);
    if (rErr) { console.error('[db] createEscalaByLider registros:', rErr.message); return null; }
    return mapDemand({ ...escala, registros });
  }
  return mapDemand({ ...escala, registros: [] });
}

export async function updateEscalaByLider({ escalaId, time, service, responsavelDia, contatoDia, newEmployees, companyId, date, tipoServico }) {
  const diaria = await getCompanyDiaria(companyId);
  const { error: upErr } = await supabase
    .from('escalas')
    .update({ horario: time || null, servico: service || null, tipo_servico: tipoServico || 'entrega', responsavel_dia: responsavelDia || null, contato_dia: contatoDia || null })
    .eq('id', escalaId);
  if (upErr) { console.error('[db] updateEscalaByLider:', upErr.message); return false; }

  if (newEmployees && newEmployees.length > 0) {
    const registros = newEmployees.map(({ id: empId, observacoes }) => ({
      id: crypto.randomUUID(), escala_id: escalaId, funcionario_id: empId, empresa_id: companyId,
      data: date, servico: service || null, status: 'scheduled', confirmacao: 'aguardando', valor: diaria,
      observacoes: observacoes || null,
    }));
    const { error: rErr } = await supabase.from('registros').insert(registros);
    if (rErr) { console.error('[db] updateEscalaByLider registros:', rErr.message); return false; }
  }
  return true;
}

export async function addRegistroToEscala(escalaId, employeeId, companyId, date, service) {
  const diaria = await getCompanyDiaria(companyId);
  const { error } = await supabase.from('registros').insert({
    id: crypto.randomUUID(), escala_id: escalaId, funcionario_id: employeeId, empresa_id: companyId,
    data: date, servico: service || null, status: 'scheduled', confirmacao: 'aguardando', valor: diaria,
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
  return rows.map(r => ({ ...r, name: r.nome, initials: r.iniciais, color: avatarTone(r.id || r.nome), dailyRate: Number(r.diaria), cidade: normalizarCidade(r.cidade) }));
}

export async function fetchTodosAjudantes() {
  const base = 'id, nome, iniciais, cor, status, cargo, cidade, latitude, longitude, data_contratacao';
  let res = await supabase
    .from('funcionarios')
    .select(`${base}, endereco, bairro, cep, localizacao`)
    .eq('status', 'active')
    .order('nome');
  if (res.error && isMissingColumn(res.error)) {
    res = await supabase
      .from('funcionarios')
      .select(base)
      .eq('status', 'active')
      .order('nome');
  }
  if (res.error) { console.error('[db] fetchTodosAjudantes:', res.error.message); return []; }
  return (res.data || []).map(r => ({
    id:              r.id,
    name:            r.nome,
    initials:        r.iniciais,
    color:           avatarTone(r.id || r.nome),
    cargo:           r.cargo || '—',
    cidade:          normalizarCidade(r.cidade) || '—',
    address:         r.endereco || '',
    neighborhood:    r.bairro || '',
    zip:             r.cep || '',
    location:        r.localizacao || '',
    latitude:        r.latitude == null ? null : Number(r.latitude),
    longitude:       r.longitude == null ? null : Number(r.longitude),
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
      liderCor:   avatarTone(e.lideres_equipe?.id || e.lideres_equipe?.nome),
      total, presentes, ausentes, atrasados,
      sla: total > 0 ? Math.round((presentes / total) * 100) : null,
    };
  });
}

// ── Todas as escalas de uma empresa (com líder) ───────────────────────────

export async function fetchEscalasComLiderByEmpresa(companyId) {
  const { data, error } = await supabase
    .from('escalas')
    .select('id, data, horario, servico, status, tipo_servico, lider_id, lideres_equipe(id, nome, telefone, iniciais, cor)')
    .eq('empresa_id', companyId)
    .order('data', { ascending: false });
  if (error) { console.error('[db] fetchEscalasComLiderByEmpresa:', error.message); return []; }
  return (data || []).map(e => ({
    id:          e.id,
    date:        e.data,
    time:        e.horario,
    service:     e.servico,
    status:      e.status,
    tipoServico: e.tipo_servico || 'entrega',
    lider:       e.lideres_equipe || null,
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
      cor:      avatarTone(data.lideres_equipe.id || data.lideres_equipe.nome),
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
    liderCor:  avatarTone(r.lideres_equipe?.id || r.lideres_equipe?.nome),
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
    funcionarioCor:  avatarTone(r.funcionarios?.id || r.funcionarios?.nome),
  }));
}

// ── Financeiro ─────────────────────────────────────────────────────────────

// Classificações do financeiro (Benefícios, Folha de Pagamento, Custo Fixo...).
export async function fetchClassificacoes() {
  const { data, error } = await supabase
    .from('financeiro_classificacoes').select('*').order('nome');
  if (error) { console.error('[db] fetchClassificacoes:', error.message); return []; }
  return data || [];
}

export async function createClassificacao({ nome, tipo = 'despesa', cor = '#4A4A4A' }) {
  const { data, error } = await supabase
    .from('financeiro_classificacoes')
    .insert({ nome, tipo, cor })
    .select().single();
  if (error) { console.error('[db] createClassificacao:', error.message); return null; }
  return data;
}

// Id de uma classificação pelo nome (retorna null se a tabela ainda não existir).
async function getClassificacaoId(nome) {
  const { data, error } = await supabase
    .from('financeiro_classificacoes').select('id').eq('nome', nome).maybeSingle();
  if (error) { console.error('[db] getClassificacaoId:', error.message); return null; }
  return data?.id || null;
}

// origem_id é uuid; gera um UUID determinístico por quinzena (folha-<idx>).
function folhaOrigemId(quinzenaIdx) {
  const hex = (Number(quinzenaIdx) >>> 0).toString(16).padStart(12, '0').slice(-12);
  return `f01a0000-0000-4000-8000-${hex}`;
}

export async function fetchDividas() {
  const { data, error } = await supabase
    .from('financeiro_dividas').select('*').order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchDividas:', error.message); return []; }
  return data || [];
}

// ── Lançamentos: status automático e inserção tolerante ────────────────────
function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

// O app identifica o status pela data do lançamento: vencimento até hoje = já
// liquidado ('pago'/'recebido'); vencimento futuro = ainda a pagar/receber ('pendente').
export function statusPorVencimento(tipo, dataVencimento) {
  if (!dataVencimento) return 'pendente';
  if (dataVencimento > hojeISO()) return 'pendente';
  return tipo === 'a_receber' ? 'recebido' : 'pago';
}

// Insere lançamentos tolerando colunas ainda não migradas no banco
// (status / classificacao_id): em vez de falhar, reenvia sem a coluna.
async function insertLancamentos(rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  let data = list;
  for (let i = 0; i < 4; i++) {
    const { error } = await supabase.from('financeiro_lancamentos').insert(data);
    if (!error) return null;
    if (/status/.test(error.message))          { data = data.map(({ status, ...r }) => r); continue; }
    if (/classificacao_id/.test(error.message)) { data = data.map(({ classificacao_id, ...r }) => r); continue; }
    return error;
  }
  return new Error('insertLancamentos: falha ao remover colunas ausentes');
}

export async function createDivida({ nome, valorPrincipal, valorParcela, numParcelas, dataInicio }) {
  // valor_total é o total a pagar (parcela x quantidade); valor_principal é o
  // valor financiado, base para juros e taxa mensal.
  const payload = {
    nome,
    valor_total: Number(valorParcela) * Number(numParcelas),
    valor_parcela: valorParcela,
    num_parcelas: numParcelas,
    data_inicio: dataInicio,
  };
  if (valorPrincipal != null && valorPrincipal !== '') payload.valor_principal = Number(valorPrincipal);

  let { data: divida, error } = await supabase
    .from('financeiro_dividas')
    .insert(payload)
    .select().single();
  if (error && isMissingColumn(error) && 'valor_principal' in payload) {
    console.warn('[db] createDivida: coluna valor_principal ausente — rode supabase/dividas-detalhes.sql. Salvando sem ela.');
    delete payload.valor_principal;
    ({ data: divida, error } = await supabase.from('financeiro_dividas').insert(payload).select().single());
  }
  if (error) { console.error('[db] createDivida:', error.message); return null; }

  const classId = await getClassificacaoId('Endividamento');
  const [year, month, day] = dataInicio.split('-').map(Number);
  const lancamentos = Array.from({ length: numParcelas }, (_, i) => {
    let m = month - 1 + i, y = year;
    while (m >= 12) { m -= 12; y++; }
    const last = new Date(y, m + 1, 0).getDate();
    const d    = String(Math.min(day, last)).padStart(2, '0');
    const venc = `${y}-${String(m + 1).padStart(2, '0')}-${d}`;
    const row = {
      id: crypto.randomUUID(),
      tipo: 'a_pagar',
      descricao: `${nome} — Parcela ${i + 1}/${numParcelas}`,
      valor: valorParcela,
      data_vencimento: venc,
      origem_tipo: 'divida',
      origem_id: divida.id,
      status: statusPorVencimento('a_pagar', venc),
    };
    if (classId) row.classificacao_id = classId;
    return row;
  });
  await insertLancamentos(lancamentos);
  return divida;
}

export async function deleteDivida(id) {
  await supabase.from('financeiro_lancamentos').delete().eq('origem_id', id).eq('origem_tipo', 'divida');
  const { error } = await supabase.from('financeiro_dividas').delete().eq('id', id);
  if (error) { console.error('[db] deleteDivida:', error.message); return false; }
  return true;
}

export async function fetchCustosFixos() {
  const { data, error } = await supabase
    .from('financeiro_custos_fixos').select('*').order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchCustosFixos:', error.message); return []; }
  return data || [];
}

// Meses lançados no fluxo de caixa quando o custo fixo é por tempo indeterminado.
export const CUSTO_FIXO_HORIZONTE = 24;

// Datas de vencimento de um custo fixo: uma por mês, a partir do mês de início.
// Regras:
//  - o dia de cada vencimento é `diaVencimento` (limitado ao último dia do mês);
//  - se o dia de pagamento for anterior ao dia do início, a 1ª cobrança cai no
//    mês seguinte (nunca se lança uma data anterior ao início);
//  - `meses` finito gera exatamente N parcelas; 0/ausente usa o horizonte padrão.
export function gerarVencimentosCustoFixo({ dataInicio, diaVencimento, meses } = {}) {
  const inicio = dataInicio || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [sy, sm, sd] = inicio.split('-').map(Number); // sm: 1-indexado
  const dia   = Math.min(Math.max(Number(diaVencimento) || sd, 1), 31);
  const total = Number(meses) > 0 ? Math.floor(Number(meses)) : CUSTO_FIXO_HORIZONTE;
  const offset = dia < sd ? 1 : 0;

  return Array.from({ length: total }, (_, i) => {
    const idx = (sm - 1) + i + offset;
    const y = sy + Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const last = new Date(y, m, 0).getDate();          // último dia do mês
    const d = String(Math.min(dia, last)).padStart(2, '0');
    return `${y}-${String(m).padStart(2, '0')}-${d}`;
  });
}

export async function createCustoFixo({ nome, valor, diaVencimento, dataInicio, meses }) {
  const { data: custo, error } = await supabase
    .from('financeiro_custos_fixos')
    .insert({ nome, valor, dia_vencimento: diaVencimento })
    .select().single();
  if (error) { console.error('[db] createCustoFixo:', error.message); return null; }

  const classId = await getClassificacaoId('Custo Fixo');
  // Uma lançamento por mês no Fluxo de Caixa, respeitando o início e o dia de pagamento.
  const vencimentos = gerarVencimentosCustoFixo({ dataInicio, diaVencimento, meses });
  const lancamentos = vencimentos.map(data => {
    const row = {
      id: crypto.randomUUID(),
      tipo: 'a_pagar',
      descricao: nome,
      valor,
      data_vencimento: data,
      origem_tipo: 'custo_fixo',
      origem_id: custo.id,
      status: statusPorVencimento('a_pagar', data),
    };
    if (classId) row.classificacao_id = classId;
    return row;
  });

  await insertLancamentos(lancamentos);
  return custo;
}

export async function updateCustoFixo(id, { nome, valor, diaVencimento }) {
  const { data: custo, error } = await supabase
    .from('financeiro_custos_fixos')
    .update({ nome, valor, dia_vencimento: diaVencimento })
    .eq('id', id).select().single();
  if (error) { console.error('[db] updateCustoFixo:', error.message); return null; }

  // Sincroniza os lançamentos futuros (a partir de hoje) com o novo nome, valor
  // e dia de vencimento. O histórico já lançado (meses passados) é preservado.
  const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const { data: lancs } = await supabase
    .from('financeiro_lancamentos')
    .select('id, data_vencimento')
    .eq('origem_id', id).eq('origem_tipo', 'custo_fixo')
    .gte('data_vencimento', todayISO);

  if (lancs && lancs.length) {
    await Promise.all(lancs.map(l => {
      const [y, m] = l.data_vencimento.split('-').map(Number); // m 1-indexado
      const last = new Date(y, m, 0).getDate();                // último dia do mês
      const d = String(Math.min(diaVencimento, last)).padStart(2, '0');
      return supabase.from('financeiro_lancamentos')
        .update({ descricao: nome, valor, data_vencimento: `${y}-${String(m).padStart(2, '0')}-${d}` })
        .eq('id', l.id);
    }));
  }
  return custo;
}

export async function deleteCustoFixo(id) {
  await supabase.from('financeiro_lancamentos').delete().eq('origem_id', id).eq('origem_tipo', 'custo_fixo');
  const { error } = await supabase.from('financeiro_custos_fixos').delete().eq('id', id);
  if (error) { console.error('[db] deleteCustoFixo:', error.message); return false; }
  return true;
}

export async function fetchLancamentos(start, end) {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*')
    .gte('data_vencimento', start)
    .lte('data_vencimento', end)
    .order('data_vencimento');
  if (error) { console.error('[db] fetchLancamentos:', error.message); return []; }
  return data || [];
}

export async function createLancamentoManual({ tipo, descricao, valor, dataVencimento, classificacaoId }) {
  const fallback = classificacaoId
    ? null
    : await getClassificacaoId(tipo === 'a_receber' ? 'Receitas' : 'Despesas Variáveis');
  const payload = {
    id: crypto.randomUUID(), tipo, descricao, valor,
    data_vencimento: dataVencimento, origem_tipo: 'manual',
    status: statusPorVencimento(tipo, dataVencimento),
  };
  if (classificacaoId || fallback) payload.classificacao_id = classificacaoId || fallback;

  let { data, error } = await supabase
    .from('financeiro_lancamentos').insert(payload).select().single();
  if (error && /status/.test(error.message)) {
    const { status, ...rest } = payload;
    ({ data, error } = await supabase.from('financeiro_lancamentos').insert(rest).select().single());
  }
  if (error && /classificacao_id/.test(error.message)) {
    delete payload.classificacao_id;
    ({ data, error } = await supabase.from('financeiro_lancamentos').insert(payload).select().single());
  }
  if (error) { console.error('[db] createLancamentoManual:', error.message); return null; }
  return data;
}

// Lançamento da folha de uma quinzena (criado ao "fechar a folha").
export async function fetchLancamentoFolha(quinzenaIdx) {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*')
    .eq('origem_id', folhaOrigemId(quinzenaIdx))
    .maybeSingle();
  if (error) { console.error('[db] fetchLancamentoFolha:', error.message); return null; }
  return data || null;
}

export async function fecharFolha({ quinzenaIdx, total, dataVencimento, label }) {
  await supabase.from('financeiro_lancamentos').delete().eq('origem_id', folhaOrigemId(quinzenaIdx));
  if (!(Number(total) > 0)) return null;

  const classId = await getClassificacaoId('Folha de Pagamento');
  const base = {
    id: crypto.randomUUID(),
    tipo: 'a_pagar',
    descricao: `Folha de Pagamento — ${label}`,
    valor: total,
    data_vencimento: dataVencimento,
    origem_id: folhaOrigemId(quinzenaIdx),
    status: statusPorVencimento('a_pagar', dataVencimento),
  };
  if (classId) base.classificacao_id = classId;

  let payload = { ...base, origem_tipo: 'folha' };
  let { data, error } = await supabase
    .from('financeiro_lancamentos').insert(payload).select().single();
  if (error && /origem_tipo|23514/.test(error.message)) {
    payload = { ...base, origem_tipo: 'manual' };
    ({ data, error } = await supabase.from('financeiro_lancamentos').insert(payload).select().single());
  }
  if (error && /status/.test(error.message)) {
    const { status, ...rest } = payload;
    payload = rest;
    ({ data, error } = await supabase.from('financeiro_lancamentos').insert(payload).select().single());
  }
  if (error && /classificacao_id/.test(error.message)) {
    delete payload.classificacao_id;
    ({ data, error } = await supabase.from('financeiro_lancamentos').insert(payload).select().single());
  }
  if (error) { console.error('[db] fecharFolha:', error.message); return null; }
  return data;
}

export async function deleteLancamento(id) {
  const { error } = await supabase.from('financeiro_lancamentos').delete().eq('id', id);
  if (error) { console.error('[db] deleteLancamento:', error.message); return false; }
  return true;
}

// Edita um lançamento específico. Importante: altera SOMENTE esta linha —
// não propaga data/valor para os demais lançamentos da série (custo fixo/dívida).
export async function updateLancamento(id, patch) {
  let payload = { ...patch };
  let { data, error } = await supabase
    .from('financeiro_lancamentos').update(payload).eq('id', id).select().single();
  if (error && /status/.test(error.message) && 'status' in payload) {
    const { status, ...rest } = payload;
    payload = rest;
    ({ data, error } = await supabase.from('financeiro_lancamentos').update(payload).eq('id', id).select().single());
  }
  if (error && /classificacao_id/.test(error.message) && 'classificacao_id' in payload) {
    const { classificacao_id, ...rest } = payload;
    ({ data, error } = await supabase.from('financeiro_lancamentos').update(rest).eq('id', id).select().single());
  }
  if (error) { console.error('[db] updateLancamento:', error.message); return null; }
  return data;
}

// Status de um lançamento: 'pendente' | 'pago' | 'recebido' (null = pendente).
export async function updateLancamentoStatus(id, status) {
  const { data, error } = await supabase
    .from('financeiro_lancamentos').update({ status }).eq('id', id).select().single();
  if (error) { console.error('[db] updateLancamentoStatus:', error.message); return null; }
  return data;
}

// Reagenda o vencimento de um lançamento (mudar a data).
export async function updateLancamentoData(id, dataVencimento) {
  const { data, error } = await supabase
    .from('financeiro_lancamentos').update({ data_vencimento: dataVencimento }).eq('id', id).select().single();
  if (error) { console.error('[db] updateLancamentoData:', error.message); return null; }
  return data;
}

// ── Benefícios (VT/VR) ────────────────────────────────────────────────────

function mapRecarga(r) {
  const func = r.funcionarios || {};
  return {
    id:              r.id,
    loteId:          r.lote_id || null,
    nome:            r.nome || null,
    funcionarioId:   r.funcionario_id,
    nomeFuncionario: func.nome || '—',
    iniciais:        func.iniciais || '?',
    cor:             avatarTone(func.id || func.nome),
    cidade:          normalizarCidade(func.cidade),
    tipo:            r.tipo,
    dias:            Number(r.dias || 0),
    diasUso:         Array.isArray(r.dias_uso) ? r.dias_uso : [],
    valorDia:        Number(r.valor_dia),
    total:           Number(r.total),
    quinzena:        r.quinzena || null,
    dataPagamento:   r.data_pagamento || null,
    dataRecarga:     r.data_recarga || null,
    dataInicio:      r.data_inicio || null,
    dataFim:         r.data_fim || null,
    criadoEm:        r.criado_em || null,
  };
}

// tipo null/undefined devolve VT e VR (usado pelo histórico com filtro "Todos").
export async function fetchRecargas(tipo = null) {
  let query = supabase
    .from('beneficios_recargas')
    .select('*, funcionarios(id, nome, iniciais, cor, cidade)')
    .order('criado_em', { ascending: false });
  if (tipo) query = query.eq('tipo', tipo);
  const { data, error } = await query;
  if (error) { console.error('[db] fetchRecargas:', error.message); return []; }
  return (data || []).map(mapRecarga);
}

// Cria uma recarga inteira (um lote nomeado) e um único lançamento a pagar
// no fluxo de caixa, com vencimento na data de pagamento escolhida.
// Retorna { ok, loteId, error } — a tela usa error para exibir conflitos.
export async function createRecarga({ nome, tipo, dataPagamento, dataRecarga, dataInicio, dataFim, itens }) {
  const loteId = crypto.randomUUID();
  const rows = (itens || []).map(i => ({
    id:              crypto.randomUUID(),
    lote_id:         loteId,
    nome,
    funcionario_id:  i.funcionarioId,
    tipo,
    dias:            i.dias,
    dias_uso:        i.diasUso,
    valor_dia:       i.valorDia,
    total:           i.total,
    quinzena:        i.quinzena || null,
    data_pagamento:  dataPagamento || null,
    data_recarga:    dataRecarga || null,
    data_inicio:     dataInicio || null,
    data_fim:        dataFim || null,
  }));
  if (rows.length === 0) return { ok: false, error: 'Nenhum ajudante selecionado.' };

  let atual = rows;
  let inserido = false;
  const colunasAusentes = new Set();
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const { error } = await supabase.from('beneficios_recargas').insert(atual);
    if (!error) { inserido = true; break; }

    if (/DIAS_DUPLICADOS/.test(error.message)) {
      return { ok: false, error: 'conflito', detalhe: error.message };
    }
    const col = missingColumnName(error);
    if (!col || !(col in atual[0])) {
      console.error('[db] createRecarga:', error.message);
      return { ok: false, error: error.message };
    }
    console.warn(`[db] createRecarga: coluna ${col} ausente — rode supabase/beneficios-recargas-v2.sql. Salvando sem ela.`);
    colunasAusentes.add(col);
    atual = atual.map(({ [col]: _ignorado, ...resto }) => resto);
  }
  if (!inserido) return { ok: false, error: 'Não foi possível salvar a recarga.' };

  const total = atual.reduce((s, r) => s + Number(r.total || 0), 0);
  const classId = await getClassificacaoId('Benefícios');
  if (classId && total > 0) {
    const nomeBeneficio = tipo === 'VT' ? 'Vale Transporte (VT)' : 'Vale Refeição (VR)';
    const lancamento = {
      id: crypto.randomUUID(),
      tipo: 'a_pagar',
      descricao: `${nomeBeneficio} — ${nome} · ${atual.length} ajudante${atual.length !== 1 ? 's' : ''}`,
      valor: total,
      data_vencimento: dataPagamento || dataRecarga || null,
      origem_tipo: 'beneficio',
      origem_id: loteId,
      status: statusPorVencimento('a_pagar', dataPagamento || dataRecarga),
      classificacao_id: classId,
    };
    let err = await insertLancamentos([lancamento]);
    if (err && /origem_tipo|23514/.test(err.message)) {
      // Constraint antiga ainda não aceita 'beneficio' → grava como 'manual'.
      err = await insertLancamentos([{ ...lancamento, origem_tipo: 'manual' }]);
    }
    if (err) console.error('[db] createRecarga lancamento:', err.message);
  }
  return { ok: true, loteId, colunasAusentes: [...colunasAusentes] };
}

// ── Carretas ───────────────────────────────────────────────────────────────

export async function fetchCarretasByEscala(escalaId) {
  if (!escalaId) return [];
  const { data, error } = await supabase
    .from('carretas')
    .select('*')
    .eq('escala_id', escalaId)
    .order('criado_em', { ascending: true });
  if (error) { console.error('[db] fetchCarretasByEscala:', error.message); return []; }
  return (data || []).map(r => ({ id: r.id, value: r.valor }));
}

export async function addCarreta(escalaId, valor = '') {
  const { data, error } = await supabase
    .from('carretas')
    .insert({ escala_id: escalaId, valor })
    .select()
    .single();
  if (error) { console.error('[db] addCarreta:', error.message); return null; }
  return { id: data.id, value: data.valor };
}

export async function updateCarreta(id, valor) {
  const { error } = await supabase
    .from('carretas')
    .update({ valor })
    .eq('id', id);
  if (error) { console.error('[db] updateCarreta:', error.message); }
}

export async function deleteCarreta(id) {
  const { error } = await supabase.from('carretas').delete().eq('id', id);
  if (error) { console.error('[db] deleteCarreta:', error.message); }
}

export async function fetchCarretasByEscalas(escalaIds) {
  if (!escalaIds?.length) return [];
  const { data, error } = await supabase
    .from('carretas')
    .select('*')
    .in('escala_id', escalaIds)
    .order('criado_em', { ascending: true });
  if (error) { console.error('[db] fetchCarretasByEscalas:', error.message); return []; }
  return (data || []).map(r => ({ id: r.id, escalaId: r.escala_id, value: r.valor }));
}

// ── Adiantamentos (Folha de Pagamento) ─────────────────────────────────────
// Valor pago antecipadamente a um ajudante, descontado do total a pagar
// da quinzena (quinzena_idx: idx = (ano-2000)*24 + (mes-1)*2 + quinzena).

function mapAdiantamento(r) {
  return {
    id:          r.id,
    employeeId:  r.funcionario_id,
    quinzenaIdx: r.quinzena_idx,
    valor:       Number(r.valor),
    data:        r.data,
    criadoEm:    r.criado_em,
  };
}

export async function fetchAdiantamentosPorQuinzena(quinzenaIdx) {
  const { data, error } = await supabase
    .from('folha_adiantamentos')
    .select('*')
    .eq('quinzena_idx', quinzenaIdx)
    .order('data', { ascending: true });
  if (error) { console.error('[db] fetchAdiantamentosPorQuinzena:', error.message); return []; }
  return (data || []).map(mapAdiantamento);
}

export async function createAdiantamento({ employeeId, quinzenaIdx, valor, data }) {
  const { data: row, error } = await supabase
    .from('folha_adiantamentos')
    .insert({ funcionario_id: employeeId, quinzena_idx: quinzenaIdx, valor, data })
    .select()
    .single();
  if (error) { console.error('[db] createAdiantamento:', error.message); return null; }
  return mapAdiantamento(row);
}

export async function deleteAdiantamento(id) {
  const { error } = await supabase.from('folha_adiantamentos').delete().eq('id', id);
  if (error) { console.error('[db] deleteAdiantamento:', error.message); }
}

// ── Pagamentos efetuados (Folha de Pagamento) ──────────────────────────────
// Marca que o valor de um ajudante em uma quinzena foi pago (checkbox verde).

export async function fetchPagosPorQuinzena(quinzenaIdx) {
  const { data, error } = await supabase
    .from('folha_pagos')
    .select('*')
    .eq('quinzena_idx', quinzenaIdx);
  if (error) { console.error('[db] fetchPagosPorQuinzena:', error.message); return []; }
  return (data || []).map(r => ({
    id:            r.id,
    employeeId:    r.funcionario_id,
    quinzenaIdx:   r.quinzena_idx,
    pagoEm:        r.pago_em,
  }));
}

export async function marcarPago(employeeId, quinzenaIdx) {
  const { data, error } = await supabase
    .from('folha_pagos')
    .insert({ funcionario_id: employeeId, quinzena_idx: quinzenaIdx })
    .select()
    .single();
  if (error) { console.error('[db] marcarPago:', error.message); return null; }
  return { id: data.id, employeeId: data.funcionario_id, quinzenaIdx: data.quinzena_idx, pagoEm: data.pago_em };
}

export async function desmarcarPago(employeeId, quinzenaIdx) {
  const { error } = await supabase
    .from('folha_pagos')
    .delete()
    .eq('funcionario_id', employeeId)
    .eq('quinzena_idx', quinzenaIdx);
  if (error) { console.error('[db] desmarcarPago:', error.message); }
}

// ── Avaliações / Notas dos Ajudantes ───────────────────────────────────────
// Uma nota (0-5) por ajudante em cada diária. A média consolidada vem da view
// vw_funcionarios_notas (rode supabase/notas-ajudantes.sql no Supabase).

function mapAvaliacao(r) {
  if (!r) return null;
  return {
    id:              r.id,
    escalaId:        r.escala_id,
    registroId:      r.registro_id,
    funcionarioId:   r.funcionario_id,
    empresaId:       r.empresa_id,
    empresaNome:     r.empresas?.nome || null,
    liderId:         r.lider_id || null,
    data:            r.data,
    nota:            Number(r.nota),
    observacao:      r.observacao || '',
    servico:         r.escalas?.servico || null,
    tipoServico:     r.escalas?.tipo_servico || null,
    avaliadoPorTipo: r.avaliado_por_tipo || 'encarregado',
    avaliadoPorNome: r.avaliado_por_nome || null,
    criadoEm:        r.criado_em,
    atualizadoEm:    r.atualizado_em,
  };
}

export async function fetchNotasFuncionario(funcionarioId) {
  if (!funcionarioId) return [];
  const { data, error } = await supabase
    .from('avaliacoes_diarias')
    .select('*, empresas(nome), escalas(servico, tipo_servico)')
    .eq('funcionario_id', funcionarioId)
    .order('data', { ascending: false });
  if (error) {
    console.error('[db] fetchNotasFuncionario:', error.message);
    return [];
  }
  return (data || []).map(mapAvaliacao);
}

export async function fetchMediasNotas() {
  const { data, error } = await supabase
    .from('vw_funcionarios_notas')
    .select('*');
  if (error) {
    console.error('[db] fetchMediasNotas:', error.message);
    return {};
  }
  return Object.fromEntries((data || []).map(r => [
    r.funcionario_id,
    {
      media:   r.media == null ? null : Number(r.media),
      total:   Number(r.total_avaliacoes ?? 0),
      primeira: r.primeira_avaliacao || null,
      ultima:   r.ultima_avaliacao || null,
    },
  ]));
}

export async function fetchNotasByEscala(escalaId) {
  if (!escalaId) return [];
  const { data, error } = await supabase
    .from('avaliacoes_diarias')
    .select('*')
    .eq('escala_id', escalaId);
  if (error) {
    console.error('[db] fetchNotasByEscala:', error.message);
    return [];
  }
  return (data || []).map(mapAvaliacao);
}

export async function fetchNotasResumo() {
  const { data, error } = await supabase
    .from('avaliacoes_diarias')
    .select('escala_id');
  if (error) {
    console.error('[db] fetchNotasResumo:', error.message);
    return {};
  }
  const resumo = {};
  for (const row of data || []) {
    if (!row.escala_id) continue;
    resumo[row.escala_id] = (resumo[row.escala_id] || 0) + 1;
  }
  return resumo;
}

export async function upsertNotaDiaria({
  escalaId, registroId, funcionarioId, empresaId, liderId, data,
  nota, observacao, avaliadoPorTipo, avaliadoPorNome,
}) {
  const n = Number(nota);
  if (!escalaId || !funcionarioId || !data) {
    console.error('[db] upsertNotaDiaria: escala, funcionário e data são obrigatórios.');
    return null;
  }
  if (!Number.isFinite(n) || n < 0 || n > 5) {
    console.error('[db] upsertNotaDiaria: nota deve estar entre 0 e 5.');
    return null;
  }

  const payload = {
    escala_id:         escalaId,
    registro_id:       registroId || null,
    funcionario_id:    funcionarioId,
    empresa_id:        empresaId || null,
    lider_id:          liderId || null,
    data,
    nota:              Math.round(n),
    observacao:        observacao?.trim() || null,
    avaliado_por_tipo: avaliadoPorTipo || 'encarregado',
    avaliado_por_nome: avaliadoPorNome || null,
    atualizado_em:     new Date().toISOString(),
  };

  const { data: row, error } = await supabase
    .from('avaliacoes_diarias')
    .upsert(payload, { onConflict: 'funcionario_id,escala_id' })
    .select()
    .single();
  if (error) {
    console.error('[db] upsertNotaDiaria:', error.message);
    return null;
  }
  return mapAvaliacao(row);
}

export async function deleteNotaDiaria(id) {
  const { error } = await supabase
    .from('avaliacoes_diarias')
    .delete()
    .eq('id', id);
  if (error) { console.error('[db] deleteNotaDiaria:', error.message); return false; }
  return true;
}

// Candidatos para uma nova escala: ajudantes ativos ainda não escalados no dia,
// ordenados por proximidade da cidade da empresa e depois pela média de notas.
export async function fetchCandidatosEscala({ companyId, date, incluirEscalados = false }) {
  if (!companyId || !date) return { company: null, candidates: [], escaladosNoDia: 0 };

  const [companyRes, empsRes, medias, regsRes] = await Promise.all([
    supabase
      .from('empresas')
      .select('id, nome, endereco, localizacao, diaria, latitude, longitude')
      .eq('id', companyId)
      .maybeSingle(),
    (async () => {
      let res = await supabase
        .from('funcionarios')
        .select(EMPLOYEE_ADDRESS_COLUMNS)
        .eq('status', 'active')
        .order('nome');
      if (res.error && isMissingColumn(res.error)) {
        res = await supabase
          .from('funcionarios')
          .select(EMPLOYEE_BASE_COLUMNS)
          .eq('status', 'active')
          .order('nome');
      }
      return res;
    })(),
    fetchMediasNotas(),
    supabase
      .from('registros')
      .select('funcionario_id, escala_id')
      .eq('data', date),
  ]);

  if (companyRes.error) console.error('[db] fetchCandidatosEscala empresa:', companyRes.error.message);
  if (empsRes.error)    console.error('[db] fetchCandidatosEscala funcionarios:', empsRes.error.message);
  if (regsRes.error)    console.error('[db] fetchCandidatosEscala registros:', regsRes.error.message);

  const companyRow = companyRes.data;
  const escalados  = new Set((regsRes.data || []).map(r => r.funcionario_id));
  const empresaLocal = parseEmpresaLocalizacao({
    endereco:    companyRow?.endereco,
    localizacao: companyRow?.localizacao,
  });
  let empresaCidade = empresaLocal.display || empresaLocal.city || '';
  let empresaUf     = empresaLocal.uf || null;
  let empresaKey    = empresaLocal.key || '';
  let empresaSource = empresaLocal.source || null;

  // Endereço sem cidade, mas com coordenada (link completo do Maps): usa a
  // cidade conhecida mais próxima para não perder o ranking por proximidade.
  if (!empresaCidade) {
    const coords = coordsEmpresa({
      endereco: companyRow?.endereco,
      localizacao: companyRow?.localizacao,
      latitude: companyRow?.latitude,
      longitude: companyRow?.longitude,
    });
    const near = cidadeMaisProxima(coords, 30);
    if (near) {
      empresaCidade = near.name;
      empresaUf = near.uf;
      empresaKey = near.key;
      empresaSource = 'coordenadas';
    }
  }

  const candidates = (empsRes.data || [])
    .filter(e => incluirEscalados || !escalados.has(e.id))
    .map(e => {
      const m = medias[e.id] || {};
      const local = parseCidade(e.cidade);
      return {
        id:              e.id,
        name:            e.nome,
        initials:        e.iniciais,
        color:           avatarTone(e.id || e.nome),
        cargo:           e.cargo,
        phone:           e.telefone,
        cidade:          local.display || normalizarCidade(e.cidade) || '',
        cidadeUf:        local.uf || null,
        cidadeKey:       local.key || '',
        address:         e.endereco || '',
        neighborhood:    e.bairro || '',
        zip:             e.cep || '',
        location:        e.localizacao || '',
        latitude:        e.latitude ?? null,
        longitude:       e.longitude ?? null,
        dailyRate:       Number(e.diaria ?? 0),
        media:           m.media ?? null,
        totalAvaliacoes: m.total ?? 0,
        ultimaAvaliacao: m.ultima ?? null,
        jaEscalado:      escalados.has(e.id),
      };
    });

  return {
    company: companyRow ? {
      id:         companyRow.id,
      name:       companyRow.nome,
      city:       empresaCidade,
      cityUf:     empresaUf,
      cityKey:    empresaKey,
      citySource: empresaSource,
      dailyRate:  Number(companyRow.diaria ?? 0),
    } : null,
    candidates: rankCandidatos(candidates, empresaCidade),
    escaladosNoDia: escalados.size,
  };
}

// ── Convocação de escala (encarregado → agente de WhatsApp) ────────────────
// O app grava a intenção (linhas em public.convocacoes com status 'pendente') e
// mostra o status ao vivo; o agente externo envia as mensagens e atualiza.
// Ver supabase/convocacoes.sql e supabase/agente-whatsapp.md.

function isMissingConvocacoes(error) {
  const msg = String(error?.message || '');
  return error?.code === '42P01' || error?.code === 'PGRST205' || /convocac|schema cache/i.test(msg);
}

function isMissingColumn(error) {
  const msg = String(error?.message || '');
  return error?.code === '42703' || error?.code === 'PGRST204' ||
    /column .* does not exist|could not find the .* column/i.test(msg);
}

// Data prevista de pagamento: prazo da empresa em dias após o fechamento da
// quinzena (1ª fecha dia 15; 2ª fecha no último dia do mês).
export function computePagamentoEm(dateIso, prazoDias = 5) {
  if (!dateIso) return null;
  const [y, m, d] = String(dateIso).split('-').map(Number);
  if (!y || !m || !d) return null;
  const prazo = Number.isFinite(Number(prazoDias)) ? Number(prazoDias) : 5;
  const base = d <= 15 ? new Date(Date.UTC(y, m - 1, 15)) : new Date(Date.UTC(y, m, 0));
  base.setUTCDate(base.getUTCDate() + prazo);
  return base.toISOString().slice(0, 10);
}

function mapConvocacao(r) {
  if (!r) return null;
  const f  = r.funcionarios || {};
  const es = r.escalas || {};
  const em = r.empresas || {};
  return {
    id:            r.id,
    escalaId:      r.escala_id,
    funcionarioId: r.funcionario_id,
    empresaId:     r.empresa_id,
    liderId:       r.lider_id,
    papel:         r.papel || 'titular',
    ordem:         r.ordem ?? null,
    status:        r.status || 'pendente',
    distanciaKm:   r.distancia_km == null ? null : Number(r.distancia_km),
    notaSnapshot:  r.nota_snapshot == null ? null : Number(r.nota_snapshot),
    conviteEnviadoEm:  r.convite_enviado_em  || null,
    followupEnviadoEm: r.followup_enviado_em || null,
    respondidoEm:      r.respondido_em       || null,
    name:     f.nome || r.funcionario_nome || r.ajudante || '—',
    initials: f.iniciais || r.iniciais || '?',
    phone:    f.telefone || r.telefone || null,
    color:    avatarTone(r.funcionario_id || f.nome || r.ajudante),
    data:        es.data || r.data_servico || null,
    horario:     fmtHHMM(es.horario || r.horario) || null,
    empresaNome: em.nome || r.empresa || null,
    endereco:    em.endereco || r.endereco || null,
    valorDiaria: (em.diaria ?? r.valor_diaria) == null ? null : Number(em.diaria ?? r.valor_diaria),
    vagas:       es.vagas ?? r.vagas ?? null,
    pagamentoEm: es.pagamento_em || r.pagamento_em || null,
  };
}

// Ordena: distância (1ª prioridade) → nota média (2ª) → nome.
function cmpDistanciaNota(a, b) {
  const da = a.distanciaKm == null ? Infinity : a.distanciaKm;
  const db_ = b.distanciaKm == null ? Infinity : b.distanciaKm;
  if (da !== db_) return da - db_;
  return (b.media ?? -1) - (a.media ?? -1) || String(a.name).localeCompare(String(b.name), 'pt-BR');
}

// Resumo da empresa com coordenadas resolvidas (mapa + pagamento).
export async function fetchEmpresaResumo(companyId) {
  if (!companyId) return null;
  const { data, error } = await supabase
    .from('empresas')
    .select('id, nome, endereco, localizacao, diaria, prazo_pagamento, latitude, longitude, raio_km')
    .eq('id', companyId)
    .maybeSingle();
  if (error) { console.error('[db] fetchEmpresaResumo:', error.message); return null; }
  if (!data) return null;
  const coords = coordsEmpresa(data);
  const local = parseEmpresaLocalizacao({ endereco: data.endereco, localizacao: data.localizacao });
  let city      = local.display || local.city || '';
  let cityUf    = local.uf || null;
  let cityKey   = local.key || '';
  let citySource = local.source || null;

  // Sem cidade no endereço, mas com coordenada (link completo do Maps ou
  // cadastro): usa a cidade conhecida mais próxima como rótulo.
  if (!city && coords) {
    const near = cidadeMaisProxima(coords, 30);
    if (near) {
      city = near.name;
      cityUf = near.uf;
      cityKey = near.key;
      citySource = 'coordenadas';
    }
  }

  return {
    id:        data.id,
    name:      data.nome,
    address:   data.endereco || '',
    location:  data.localizacao || '',
    city,
    cityUf,
    cityKey,
    citySource,
    dailyRate: Number(data.diaria ?? 0),
    prazoPagamento: Number(data.prazo_pagamento ?? 5),
    raioKm:    Number(data.raio_km ?? 40),
    coords,
    temCoords: !!coords?.exata,
  };
}

// Últimos ajudantes escalados nesta empresa antes de `excludeDate` — alimenta a
// pergunta "quer manter algum deles na escala?".
export async function fetchUltimosEscaladosDaEmpresa(companyId, excludeDate) {
  const company = await fetchEmpresaResumo(companyId);
  if (!company) return { company: null, list: [], lastDate: null };

  const { data: escalas, error } = await supabase
    .from('escalas')
    .select('id, data')
    .eq('empresa_id', companyId)
    .lt('data', excludeDate)
    .order('data', { ascending: false })
    .limit(1);
  if (error || !escalas?.length) return { company, list: [], lastDate: null };

  const lastEscala = escalas[0];
  const { data: regs } = await supabase
    .from('registros')
    .select('funcionario_id')
    .eq('escala_id', lastEscala.id);
  const ids = [...new Set((regs || []).map(r => r.funcionario_id))];
  if (!ids.length) return { company, list: [], lastDate: lastEscala.data };

  const [empsRes, medias] = await Promise.all([
    (async () => {
      let res = await supabase.from('funcionarios').select(EMPLOYEE_ADDRESS_COLUMNS).in('id', ids);
      if (res.error && isMissingColumn(res.error)) {
        res = await supabase.from('funcionarios').select(EMPLOYEE_BASE_COLUMNS).in('id', ids);
      }
      return res;
    })(),
    fetchMediasNotas(),
  ]);

  const list = (empsRes.data || [])
    .filter(e => e.status !== 'inactive' && e.status !== 'inativo')
    .map(e => {
      const m = medias[e.id] || {};
      const ponto = coordsFuncionario(e);
      const local = parseCidade(e.cidade);
      const cidade = local.display || normalizarCidade(e.cidade) || '';
      return {
        id:        e.id,
        name:      e.nome,
        initials:  e.iniciais,
        phone:     e.telefone,
        cidade,
        cidadeUf:  local.uf || null,
        address:       e.endereco || '',
        neighborhood:  e.bairro || '',
        zip:           e.cep || '',
        location:      e.localizacao || '',
        latitude:      e.latitude ?? null,
        longitude:     e.longitude ?? null,
        dailyRate: Number(e.diaria ?? 0),
        media:     m.media ?? null,
        totalAvaliacoes: m.total ?? 0,
        distanciaKm: distanciaKm(ponto, company.coords),
        distanciaExata: !!ponto?.exata,
        proximidadeLabel: compararProximidade(cidade, company.city).label,
        color:     avatarTone(e.id || e.nome),
      };
    })
    .sort((a, b) => (b.media ?? -1) - (a.media ?? -1));

  return { company, list, lastDate: lastEscala.data };
}

// Candidatos com distância calculada, ranqueados por distância → nota.
export async function fetchCandidatosComDistancia({ companyId, date, incluirEscalados = false }) {
  const base = await fetchCandidatosEscala({ companyId, date, incluirEscalados });
  const company = await fetchEmpresaResumo(companyId);
  const empCoords = company?.coords || null;

  // Distância real (do centroide da cidade ou da coordenada exata). O ranking
  // segue estritamente distância → nota. Só o ponto desenhado no mapa recebe um
  // pequeno deslocamento quando não há coordenada exata, para não empilhar.
  const candidatos = (base.candidates || []).map(c => {
    const ponto = coordsFuncionario({
      cidade: c.cidade,
      endereco: c.address,
      localizacao: c.location,
      latitude: c.latitude,
      longitude: c.longitude,
    });
    const exata = !!ponto?.exata;
    return {
      ...c,
      coords: exata ? ponto : jitterCoords(ponto, c.id),
      distanciaKm: distanciaKm(ponto, empCoords),
      distanciaExata: exata,
    };
  }).sort(cmpDistanciaNota);

  return {
    ...base,
    company: company ? { ...(base.company || {}), ...company } : base.company,
    candidates: candidatos.map((c, i) => ({ ...c, ordem: i + 1 })),
  };
}

// Verifica se já existe escala/convocação para a empresa no dia.
// O índice único no banco é a garantia final; esta consulta permite avisar
// antes de gravar e oferecer a exclusão da escala existente.
export async function fetchEscalaDoDia({ companyId, date }) {
  if (!companyId || !date) return null;
  const { data, error } = await supabase
    .from('escalas')
    .select('id, empresa_id, data')
    .eq('empresa_id', companyId)
    .eq('data', date)
    .limit(1)
    .maybeSingle();
  if (error) { console.error('[db] fetchEscalaDoDia:', error.message); return null; }
  return data ? { escalaId: data.id, empresaId: data.empresa_id, date: data.data } : null;
}

// Cria a escala com os titulares (registros) e as convocações (titulares +
// reservas) com status 'pendente' — a fila que o agente vai consumir.
export async function createEscalaComConvocacoes({
  liderId, companyId, date, time, service, employees = [], reservas = [],
  vagas, totalReservas = 2, responsavelDia, contatoDia, tipoServico,
}) {
  const [diaria, company] = await Promise.all([getCompanyDiaria(companyId), fetchEmpresaResumo(companyId)]);
  const escalaId    = crypto.randomUUID();
  const pagamentoEm = computePagamentoEm(date, company?.prazoPagamento ?? 5);
  const nVagas      = Number.isFinite(Number(vagas)) ? Number(vagas) : employees.length;

  // Não permite duas convocações para a mesma empresa no mesmo dia.
  const duplicada = await fetchEscalaDoDia({ companyId, date });
  if (duplicada) {
    return { erro: 'convocacao_duplicada', escalaId: duplicada.escalaId, convocacoesOk: false };
  }

  const payload = {
    id: escalaId, empresa_id: companyId, data: date, horario: time || null,
    servico: service || null, tipo_servico: tipoServico || 'entrega', status: 'scheduled',
    lider_id: liderId, responsavel_dia: responsavelDia || null, contato_dia: contatoDia || null,
    vagas: nVagas, total_reservas: Number(totalReservas) || 2, pagamento_em: pagamentoEm,
  };

  let { data: escala, error: escErr } = await supabase.from('escalas').insert(payload).select().single();
  if (escErr && isMissingColumn(escErr)) {
    console.warn('[db] createEscalaComConvocacoes: colunas de convocação ausentes — rode supabase/convocacoes.sql.');
    const { vagas: _v, total_reservas: _t, pagamento_em: _p, ...legacy } = payload;
    ({ data: escala, error: escErr } = await supabase.from('escalas').insert(legacy).select().single());
  }
  if (escErr && escErr.code === '23505') {
    const existente = await fetchEscalaDoDia({ companyId, date });
    return { erro: 'convocacao_duplicada', escalaId: existente?.escalaId || null, convocacoesOk: false };
  }
  if (escErr) { console.error('[db] createEscalaComConvocacoes escala:', escErr.message); return null; }

  const registros = employees.map(({ id: empId, observacoes }) => ({
    id: crypto.randomUUID(), escala_id: escalaId, funcionario_id: empId, empresa_id: companyId,
    data: date, servico: service || null, status: 'scheduled', confirmacao: 'aguardando',
    valor: diaria, observacoes: observacoes || null,
  }));
  if (registros.length) {
    const { error } = await supabase.from('registros').insert(registros);
    if (error) console.error('[db] createEscalaComConvocacoes registros:', error.message);
  }

  // Convocação: titulares (com ordem) + reservas (sem ordem). Deduplica.
  const vistos = new Set();
  const convRows = [
    ...employees.map((e, i) => ({
      papel: 'titular', ordem: i + 1, id: e.id,
      distanciaKm: e.distanciaKm ?? null, media: e.media ?? null,
    })),
    ...reservas.map(r => ({
      papel: 'reserva', ordem: null, id: r.id,
      distanciaKm: r.distanciaKm ?? null, media: r.media ?? null,
    })),
  ].filter(c => c.id && !vistos.has(c.id) && vistos.add(c.id))
   .map(c => ({
     id: crypto.randomUUID(), escala_id: escalaId, funcionario_id: c.id, empresa_id: companyId,
     lider_id: liderId, papel: c.papel, ordem: c.ordem, status: 'pendente',
     distancia_km: c.distanciaKm, nota_snapshot: c.media,
   }));

  let convocacoesOk = true;
  if (convRows.length) {
    const { error } = await supabase.from('convocacoes').insert(convRows);
    if (error) {
      convocacoesOk = false;
      console.error('[db] createEscalaComConvocacoes convocações:', error.message);
      if (isMissingConvocacoes(error)) {
        console.warn('[db] tabela public.convocacoes ausente — rode supabase/convocacoes.sql.');
      }
    }
  }

  return { ...mapDemand({ ...escala, registros }), pagamentoEm, convocacoesOk };
}

export async function fetchConvocacoesByEscala(escalaId) {
  if (!escalaId) return [];
  const { data, error } = await supabase
    .from('convocacoes')
    .select('*, funcionarios(nome, iniciais, telefone), escalas(data, horario, vagas, pagamento_em)')
    .eq('escala_id', escalaId);
  if (error) {
    if (!isMissingConvocacoes(error)) console.error('[db] fetchConvocacoesByEscala:', error.message);
    return [];
  }
  return (data || []).map(mapConvocacao).sort((a, b) => {
    if (a.papel !== b.papel) return a.papel === 'titular' ? -1 : 1;
    return (a.ordem ?? 999) - (b.ordem ?? 999);
  });
}

// Escalas do encarregado de uma data (para marcar convocação nos detalhes).
export async function fetchConvocacoesByEscalas(escalaIds = []) {
  if (!escalaIds.length) return {};
  const { data, error } = await supabase
    .from('convocacoes')
    .select('*, funcionarios(nome, iniciais, telefone), escalas(data, horario, vagas, pagamento_em)')
    .in('escala_id', escalaIds);
  if (error) {
    if (!isMissingConvocacoes(error)) console.error('[db] fetchConvocacoesByEscalas:', error.message);
    return {};
  }
  return (data || []).map(mapConvocacao).reduce((acc, c) => {
    (acc[c.escalaId] ||= []).push(c);
    return acc;
  }, {});
}

// Fila/prateleira do agente (direto da view com o payload pronto).
// `from`/`to` filtram o dia do serviço (datas ISO YYYY-MM-DD).
export async function fetchConvocacoesAgente({ statuses, from, to, limit = 300 } = {}) {
  let q = supabase.from('vw_convocacoes_agente')
    .select('*')
    .order('data_servico', { ascending: true })
    .limit(limit);
  if (statuses?.length) q = q.in('status', statuses);
  if (from) q = q.gte('data_servico', from);
  if (to) q = q.lte('data_servico', to);
  const { data, error } = await q;
  if (error) {
    if (!isMissingConvocacoes(error)) console.error('[db] fetchConvocacoesAgente:', error.message);
    return [];
  }
  return (data || []).map(r => ({
    ...mapConvocacao({ ...r, id: r.convocacao_id }),
    convocacaoId: r.convocacao_id,
    confirmados:  Number(r.confirmados || 0),
    liderId:      r.lider_id || null,
  }));
}

export function subscribeConvocacoes(escalaId, onChange) {
  const channel = supabase
    .channel(`conv_${escalaId || 'all'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'convocacoes',
        ...(escalaId ? { filter: `escala_id=eq.${escalaId}` } : {}) },
      (payload) => onChange?.(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function updateConvocacaoStatus(id, status, { respondido = false } = {}) {
  const patch = { status };
  if (respondido) patch.respondido_em = new Date().toISOString();
  const { error } = await supabase.from('convocacoes').update(patch).eq('id', id);
  if (error) { console.error('[db] updateConvocacaoStatus:', error.message); return false; }
  return true;
}

export async function insertConvocacaoEvento(convocacaoId, direcao, tipo, conteudo) {
  const { error } = await supabase.from('convocacao_eventos').insert({
    id: crypto.randomUUID(), convocacao_id: convocacaoId, direcao, tipo, conteudo: conteudo || null,
  });
  if (error && !isMissingConvocacoes(error)) console.error('[db] insertConvocacaoEvento:', error.message);
}

// Espelha o status da convocação em registros (para a pessoa aparecer na escala).
async function espelharRegistro(conv, confirmacao) {
  const statusMap = { confirmado: 'active', falta: 'absent' };
  const { data: existing } = await supabase.from('registros')
    .select('id').eq('escala_id', conv.escalaId).eq('funcionario_id', conv.funcionarioId).maybeSingle();
  if (existing) {
    await supabase.from('registros')
      .update({ confirmacao, status: statusMap[confirmacao] || 'scheduled' })
      .eq('id', existing.id);
    return;
  }
  const diaria = await getCompanyDiaria(conv.empresaId);
  await supabase.from('registros').insert({
    id: crypto.randomUUID(), escala_id: conv.escalaId, funcionario_id: conv.funcionarioId,
    empresa_id: conv.empresaId, data: conv.data, status: statusMap[confirmacao] || 'scheduled',
    confirmacao, valor: diaria,
  });
}

// Aceite com regra de vagas: se a lista lotou, o excedente vira reserva.
// Devolve o status final gravado ('confirmado' ou 'reserva').
export async function aceitarConvocacao(conv) {
  const [{ count }, escalaRes] = await Promise.all([
    supabase.from('convocacoes').select('id', { count: 'exact', head: true })
      .eq('escala_id', conv.escalaId).eq('status', 'confirmado'),
    supabase.from('escalas').select('vagas').eq('id', conv.escalaId).maybeSingle(),
  ]);
  const vagas = escalaRes?.data?.vagas ?? conv.vagas ?? null;
  const jaConfirmados = count ?? 0;
  const lotado = vagas != null && jaConfirmados >= vagas;

  const final = lotado ? 'reserva' : 'confirmado';
  await updateConvocacaoStatus(conv.id, final, { respondido: true });
  if (final === 'confirmado') {
    await espelharRegistro(conv, 'confirmado');
    await insertConvocacaoEvento(conv.id, 'in', 'resposta', 'Aceitou a convocação.');
  } else {
    await insertConvocacaoEvento(conv.id, 'sistema', 'reserva',
      'Lista cheia no aceite — registrado como reserva.');
  }
  return final;
}

export async function recusarConvocacao(conv) {
  await updateConvocacaoStatus(conv.id, 'recusado', { respondido: true });
  await insertConvocacaoEvento(conv.id, 'in', 'resposta', 'Recusou a convocação.');
}

export async function marcarSemResposta(conv) {
  await updateConvocacaoStatus(conv.id, 'sem_resposta');
  await insertConvocacaoEvento(conv.id, 'sistema', 'resposta', 'Sem resposta do ajudante.');
}
