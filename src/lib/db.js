/**
 * Funções de acesso ao banco de dados (Supabase).
 * Converte o formato snake_case do banco para o camelCase usado no app.
 */
import { supabase } from './supabase';

function mapRecord(r) {
  if (!r) return null;
  return {
    id:           r.id,
    employeeId:   r.employee_id,
    companyId:    r.company_id,
    date:         r.date,
    service:      r.service,
    checkIn:      r.check_in,
    lunchOut:     r.lunch_out,
    lunchReturn:  r.lunch_return,
    checkOut:     r.check_out,
    overtime:     r.overtime,
    status:       r.status,
    value:        r.value,
  };
}

/** Busca o registro de hoje de um ajudante no banco. */
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

/** Busca todos os registros de um ajudante. */
export async function fetchEmployeeRecords(employeeId) {
  const { data, error } = await supabase
    .from('work_records')
    .select('*')
    .eq('employee_id', employeeId)
    .order('date', { ascending: false });

  if (error) { console.error('[db] fetchEmployeeRecords:', error.message); return null; }
  return data.map(mapRecord);
}

/** Assina mudanças em tempo real nos registros do ajudante. */
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
