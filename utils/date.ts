/**
 * Formata uma data para o formato YYYY-MM-DD usado nas consultas às APIs (IGDB/Steam/RAWG fallback)
 */
export const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Retorna o primeiro dia do mês atual
 */
export const getFirstDayOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

/**
 * Retorna a data atual
 */
export const getToday = (): Date => {
  return new Date();
};

/**
 * Retorna uma data X dias atrás de hoje
 */
export const getDaysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

/**
 * Retorna o range de datas do mês atual formatado para a API
 */
export const getCurrentMonthDateRange = (): { startDate: string; endDate: string } => {
  return {
    startDate: formatDateForAPI(getFirstDayOfCurrentMonth()),
    endDate: formatDateForAPI(getToday()),
  };
};

/**
 * Retorna o range dos últimos X dias formatado para a API
 */
export const getLastDaysDateRange = (days: number): { startDate: string; endDate: string } => {
  return {
    startDate: formatDateForAPI(getDaysAgo(days)),
    endDate: formatDateForAPI(getToday()),
  };
};
