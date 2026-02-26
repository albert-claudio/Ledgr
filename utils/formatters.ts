/**
 * Formata minutos em horas de forma amigável
 * - Remove decimais se for número redondo (12.0h → 12h)
 * - Usa vírgula como separador decimal (12.5h → 12,5h)
 * - Retorna null se minutes for 0 (para esconder)
 */
export function formatHours(minutes: number): string | null {
  if (!minutes || minutes === 0) return null;
  
  const hours = minutes / 60;
  
  // Se for número redondo, não mostra decimal
  if (hours % 1 === 0) {
    return `${hours.toFixed(0)}h`;
  }
  
  // Usa vírgula como separador decimal
  return `${hours.toFixed(1).replace('.', ',')}h`;
}

/**
 * Formata data relativa de forma amigável
 * - Retorna null se não houver data (para esconder)
 */
export function formatLastSession(date: string | null | undefined): string | null {
  if (!date) return null;
  
  // Implementação usando date-fns será feita no componente
  return date;
}
