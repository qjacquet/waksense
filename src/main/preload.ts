/**
 * Preload Script - Bridge sécurisé entre le renderer et le main process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Log pour confirmer que le preload est chargé
console.log('[PRELOAD] Preload script loaded');

// Expose les API IPC au renderer de manière sécurisée
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration et personnages
  getSavedCharacters: () => ipcRenderer.invoke('get-saved-characters'),
  saveCharacter: (className: string, playerName: string) => 
    ipcRenderer.invoke('save-character', className, playerName),
  deleteCharacter: (className: string, playerName: string) => 
    ipcRenderer.invoke('delete-character', className, playerName),
  
  // Chemins de logs
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  selectLogPath: () => ipcRenderer.invoke('select-log-path'),
  
  // Surveillance des logs
  startMonitoring: (logPath?: string) => ipcRenderer.invoke('start-monitoring', logPath),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  
  // Trackers
  createTracker: (className: string, playerName: string) => 
    ipcRenderer.invoke('create-tracker', className, playerName),
  closeTracker: (trackerId: string) => ipcRenderer.invoke('close-tracker', trackerId),
  
  // Statistiques
  getDeduplicationStats: () => ipcRenderer.invoke('get-deduplication-stats'),
  getDetectedClasses: () => ipcRenderer.invoke('get-detected-classes'),
  
  // Événements du main process
  onClassDetected: (callback: (detection: { className: string; playerName: string }) => void) => {
    console.log('[PRELOAD] onClassDetected listener registered');
    ipcRenderer.on('class-detected', (_event, detection) => {
      console.log('[PRELOAD] class-detected event received in preload:', detection);
      callback(detection);
    });
  },
  onCombatStarted: (callback: () => void) => {
    ipcRenderer.on('combat-started', () => callback());
  },
  onCombatEnded: (callback: () => void) => {
    ipcRenderer.on('combat-ended', () => callback());
  },
  onLogLine: (callback: (line: string, parsed: any) => void) => {
    ipcRenderer.on('log-line', (_event, line, parsed) => callback(line, parsed));
  },
  onMonitoringStarted: (callback: () => void) => {
    ipcRenderer.on('monitoring-started', () => callback());
  },
  onLogFileNotFound: (callback: () => void) => {
    ipcRenderer.on('log-file-not-found', () => callback());
  },
  
  // Retirer les listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

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
      createTracker: (className: string, playerName: string) => Promise<string>;
      closeTracker: (trackerId: string) => Promise<void>;
      getDeduplicationStats: () => Promise<any>;
      getDetectedClasses: () => Promise<Array<{ className: string; playerName: string }>>;
      onClassDetected: (callback: (detection: { className: string; playerName: string }) => void) => void;
      onCombatStarted: (callback: () => void) => void;
      onCombatEnded: (callback: () => void) => void;
      onLogLine: (callback: (line: string, parsed: any) => void) => void;
      onMonitoringStarted: (callback: () => void) => void;
      onLogFileNotFound: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

