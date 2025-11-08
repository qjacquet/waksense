/**
 * Types globaux pour les fichiers renderer
 */
export type ClassType = "Iop" | "Cra" | "Ouginak";

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
      createTracker: (className: string, playerName: string) => Promise<string>;
      closeTracker: (trackerId: string) => Promise<void>;
      getDeduplicationStats: () => Promise<any>;
      getDetectedClasses: () => Promise<
        Array<{ className: string; playerName: string }>
      >;
      getAssetPath: (...pathSegments: string[]) => Promise<string>;
      openDebug: () => Promise<void>;
      toggleCraJauge: (playerName: string) => Promise<string>;
      toggleCraTracker: (playerName: string) => Promise<string>;
      onClassDetected: (
        callback: (detection: { className: string; playerName: string }) => void
      ) => void;
      onCombatStarted: (callback: () => void) => void;
      onCombatEnded: (callback: () => void) => void;
      onLogLine: (callback: (line: string, parsed: any) => void) => void;
      onMonitoringStarted: (callback: () => void) => void;
      onLogFileNotFound: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
