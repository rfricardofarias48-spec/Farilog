// Funções utilitárias — os dados reais vêm do Supabase.

export const fmtCurrency = (val) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/R\$\s/, 'R$');

export const fmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS   = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Arrays vazios mantidos para compatibilidade com páginas que ainda não migraram
export const WORK_RECORDS    = [];
export const PAYMENTS        = [];
export const MONTHLY_REVENUE = [];
export const DAILY_HELPERS   = [];
export const EMPLOYEES       = [];
export const COMPANIES       = [];
