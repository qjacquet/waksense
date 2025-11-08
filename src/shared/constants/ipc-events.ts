/**
 * Constantes pour les événements IPC entre le main process et les renderers
 */
export const IPC_EVENTS = {
  COMBAT_STARTED: "combat-started",
  COMBAT_ENDED: "combat-ended",
  LOG_LINE: "log-line",
  REFRESH_UI: "refresh-ui",
  CLASS_DETECTED: "class-detected",
} as const;

