// ── Utilidades de Cálculo de Horas e Horas Extras ─────────────────────────

/**
 * Normaliza string para formato HH:MM
 */
export function formatTimeHHMM(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return null;
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

/**
 * Converte HH:MM para total em minutos
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Converte total de minutos para formato legível (ex: "8h 30m" ou "1h")
 */
export function minutesToFormattedTime(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '0h';
  const isNegative = minutes < 0;
  const absMin = Math.abs(minutes);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  const sign = isNegative ? '-' : '';
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Regra de cálculo de jornada e horas extras:
 * - Jornada base: 8 horas de trabalho (480 minutos).
 * - Intervalo de almoço: 1 hora (ou tempo real preenchido entre saída e retorno).
 * - Se almoço preenchido: permanência de 9h = 8h trabalhadas. O que passar de 8h trabalhadas é hora extra.
 * - Se almoço NÃO preenchido: a base de contagem é de 8h diretas. O que passar de 8h é hora extra.
 */
export function calculateWorkAndOvertime(entrada, saida, saidaAlmoco = null, retornoAlmoco = null) {
  const entMin = timeStringToMinutes(entrada);
  const saiMin = timeStringToMinutes(saida);

  // Se não tiver entrada ou saída, não é possível fechar a jornada
  if (entMin === null || saiMin === null) {
    return {
      hasTimes: false,
      isComplete: false,
      netWorkedMinutes: 0,
      overtimeMinutes: 0,
      overtimeHoursDecimal: 0,
      workedFormatted: '—',
      overtimeFormatted: '0h',
      hasOvertime: false,
      intervalMinutes: 0,
      hasLunch: false,
      lunchFormatted: 'Sem almoço',
      baseHours: 8,
    };
  }

  // Diferença bruta entre entrada e saída
  let rawMinutes = saiMin - entMin;
  if (rawMinutes < 0) {
    // Caso de jornada que ultrapassou a meia-noite
    rawMinutes += 24 * 60;
  }

  // Intervalo de almoço
  let intervalMinutes = 0;
  let hasLunch = false;
  const almocoSaiMin = timeStringToMinutes(saidaAlmoco);
  const almocoRetMin = timeStringToMinutes(retornoAlmoco);

  if (almocoSaiMin !== null && almocoRetMin !== null) {
    let intv = almocoRetMin - almocoSaiMin;
    if (intv < 0) intv += 24 * 60;
    if (intv > 0) {
      intervalMinutes = intv;
      hasLunch = true;
    }
  }

  // Horas líquidas trabalhadas
  const netWorkedMinutes = Math.max(0, rawMinutes - intervalMinutes);
  
  // Base contratual padrão: 8 horas de trabalho efetivo (480 minutos)
  const baseMinutes = 8 * 60;
  
  // Hora extra é tudo que exceder a base de 8h
  const overtimeMinutes = Math.max(0, netWorkedMinutes - baseMinutes);
  const overtimeHoursDecimal = Number((overtimeMinutes / 60).toFixed(2));

  return {
    hasTimes: true,
    isComplete: true,
    rawMinutes,
    netWorkedMinutes,
    overtimeMinutes,
    overtimeHoursDecimal,
    workedFormatted: minutesToFormattedTime(netWorkedMinutes),
    overtimeFormatted: overtimeMinutes > 0 ? `+${minutesToFormattedTime(overtimeMinutes)}` : '0h',
    hasOvertime: overtimeMinutes > 0,
    intervalMinutes,
    hasLunch,
    lunchFormatted: hasLunch ? minutesToFormattedTime(intervalMinutes) : 'Sem intervalo',
    baseHours: 8,
  };
}

/**
 * Converte minutos de hora extra para o formato compatível com coluna TIME do PostgreSQL (HH:MM:00)
 */
export function overtimeMinutesToTimeString(overtimeMinutes) {
  if (!overtimeMinutes || overtimeMinutes <= 0) return null;
  const h = Math.floor(overtimeMinutes / 60);
  const m = overtimeMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}
