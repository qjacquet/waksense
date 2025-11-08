/**
 * Log Patterns - Patterns regex réutilisables pour le parsing des logs
 */

export const LOG_PATTERNS = {
  TIMESTAMP: /^(\d{2}:\d{2}:\d{2},\d{3})/,
  CONTENT: /^\d{2}:\d{2}:\d{2},\d{3}\s*-\s*(.+)$/,
  SPELL_CAST_PRIMARY: /\[Information \(combat\)\]\s*([^:]+?)[:\s]+\s*lance le sort\s+(.+?)(?:\s*\(|$)/,
  SPELL_CAST_FALLBACK: /\[Information \(combat\)\]\s*([^:]+?)[:\s]+lance le sort\s+(.+)/,
  COMBAT_START: /\[_FL_\]\s+fightId=(\d+)\s+(.+?)\s+breed\s*:\s*(\d+)\s+\[(\d+)\]\s+.*?isControlledByAI=(true|false)/,
  COMBAT_END: /\[FIGHT\]\s+End fight with id\s+(\d+)/,
  FIGHTER_ID_PATTERN1: /fighterId[=:](\d+)/i,
  FIGHTER_ID_PATTERN2: /\[(\d+)\]/,
} as const;

