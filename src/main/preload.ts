/**
 * Preload Script - Bridge sécurisé entre le renderer et le main process
 */

import { contextBridge, ipcRenderer } from "electron";

// IPC Events constants - inlined to avoid module resolution issues in sandboxed context
const IPC_EVENTS = {
  COMBAT_STARTED: "combat-started",
  COMBAT_ENDED: "combat-ended",
  LOG_LINE: "log-line",
  REFRESH_UI: "refresh-ui",
  CLASS_DETECTED: "class-detected",
} as const;

// Expose les API IPC au renderer de manière sécurisée
contextBridge.exposeInMainWorld("electronAPI", {
  // Configuration et personnages
  getSavedCharacters: () => ipcRenderer.invoke("get-saved-characters"),
  saveCharacter: (className: string, playerName: string) =>
    ipcRenderer.invoke("save-character", className, playerName),
  deleteCharacter: (className: string, playerName: string) =>
    ipcRenderer.invoke("delete-character", className, playerName),

  // Chemins de logs
  getLogPath: () => ipcRenderer.invoke("get-log-path"),
  selectLogPath: () => ipcRenderer.invoke("select-log-path"),

  // Surveillance des logs
  startMonitoring: (logPath?: string) =>
    ipcRenderer.invoke("start-monitoring", logPath),
  stopMonitoring: () => ipcRenderer.invoke("stop-monitoring"),

  // Trackers
  closeTracker: (trackerId: string) =>
    ipcRenderer.invoke("close-tracker", trackerId),

  // Statistiques
  getDeduplicationStats: () => ipcRenderer.invoke("get-deduplication-stats"),
  getDetectedClasses: () => ipcRenderer.invoke("get-detected-classes"),

  // Assets
  getAssetPath: (...pathSegments: string[]) =>
    ipcRenderer.invoke("get-asset-path", ...pathSegments),

  // Debug
  openDebug: () => ipcRenderer.invoke("open-debug"),

  // Événements du main process
  onClassDetected: (
    callback: (detection: { className: string; playerName: string }) => void
  ) => {
    ipcRenderer.on(IPC_EVENTS.CLASS_DETECTED, (_event, detection) => {
      callback(detection);
    });
  },
  onCombatStarted: (callback: () => void) => {
    ipcRenderer.on(IPC_EVENTS.COMBAT_STARTED, () => callback());
  },
  onCombatEnded: (callback: () => void) => {
    ipcRenderer.on(IPC_EVENTS.COMBAT_ENDED, () => callback());
  },
  onLogLine: (callback: (line: string, parsed: any) => void) => {
    ipcRenderer.on(IPC_EVENTS.LOG_LINE, (_event, line, parsed) =>
      callback(line, parsed)
    );
  },
  onRefreshUI: (callback: () => void) => {
    ipcRenderer.on(IPC_EVENTS.REFRESH_UI, () => callback());
  },
  onMonitoringStarted: (callback: () => void) => {
    ipcRenderer.on("monitoring-started", () => callback());
  },
  onLogFileNotFound: (callback: () => void) => {
    ipcRenderer.on("log-file-not-found", () => callback());
  },

  // Retirer les listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// lottie-web sera chargé via CDN dans le HTML, pas besoin de l'exposer ici

// Déclarer les types pour TypeScript
declare global {
  interface Window {
    electronAPI: {
      getSavedCharacters: () => Promise<{ [className: string]: string[] }>;
      saveCharacter: (className: string, playerName: string) => Promise<void>;
      deleteCharacter: (className: string, playerName: string) => Promise<void>;
      getLogPath: () => Promise<string>;
      selectLogPath: () => Promise<string | null>;
      startMonitoring: (logPath?: string) => Promise<string>;
      stopMonitoring: () => Promise<void>;
      closeTracker: (trackerId: string) => Promise<void>;
      getDeduplicationStats: () => Promise<any>;
      getDetectedClasses: () => Promise<
        Array<{ className: string; playerName: string }>
      >;
      getAssetPath: (...pathSegments: string[]) => Promise<string>;
      openDebug: () => Promise<void>;
      onClassDetected: (
        callback: (detection: { className: string; playerName: string }) => void
      ) => void;
      onCombatStarted: (callback: () => void) => void;
      onCombatEnded: (callback: () => void) => void;
      onLogLine: (callback: (line: string, parsed: any) => void) => void;
      onRefreshUI: (callback: () => void) => void;
      onMonitoringStarted: (callback: () => void) => void;
      onLogFileNotFound: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
