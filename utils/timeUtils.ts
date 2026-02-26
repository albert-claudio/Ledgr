/**
 * Utility functions for formatting time and duration
 */

/**
 * Formats playtime in hours to a human-readable string
 * @param hours - Time in hours (can be decimal)
 * @returns Formatted string like "2h 30min", "45min", or "15h"
 * 
 * @example
 * formatPlaytime(2.5) // "2h 30min"
 * formatPlaytime(0.75) // "45min"
 * formatPlaytime(15) // "15h"
 * formatPlaytime(0.1) // "6min"
 */
export function formatPlaytime(hours: number): string {
  if (hours <= 0) return '0min';
  
  const totalMinutes = Math.round(hours * 60);
  
  // Less than 1 hour: show only minutes
  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }
  
  const h = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  
  // Exact hours: show only hours
  if (min === 0) {
    return `${h}h`;
  }
  
  // Hours + minutes
  return `${h}h ${min}min`;
}

/**
 * Formats duration in minutes to a human-readable string
 * @param minutes - Time in minutes
 * @returns Formatted string like "2h 30min", "45min", or "15h"
 * 
 * @example
 * formatDuration(150) // "2h 30min"
 * formatDuration(45) // "45min"
 * formatDuration(900) // "15h"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0min';
  
  const totalMinutes = Math.round(minutes);
  
  // Less than 1 hour: show only minutes
  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }
  
  const h = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  
  // Exact hours: show only hours
  if (min === 0) {
    return `${h}h`;
  }
  
  // Hours + minutes
  return `${h}h ${min}min`;
}

/**
 * Formats playtime to a compact format for display
 * @param hours - Time in hours (can be decimal)
 * @returns Compact string like "2.5h" or "45m"
 */
export function formatPlaytimeCompact(hours: number): string {
  if (hours <= 0) return '0m';
  
  const totalMinutes = Math.round(hours * 60);
  
  // Less than 1 hour: show minutes
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  
  // 1 hour or more: show decimal hours
  return `${hours.toFixed(1)}h`;
}
