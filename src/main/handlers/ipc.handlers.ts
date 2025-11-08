/**
 * IPC Handlers - Gestionnaires IPC pour la communication main/renderer
 */

import { BrowserWindow, dialog, ipcMain } from "electron";
import { Config } from "../core/config";
import { ClassDetection, LogMonitor } from "../core/log-monitor";
import { TrackerManager } from "../core/tracker-manager";
import { getClassConfig, getTrackerTypes } from "../../shared/domain/class-tracker-config";
import { WindowManager } from "../windows/window-manager";

export function setupIpcHandlers(
  launcherWindow: BrowserWindow | null,
  getLogMonitor: () => LogMonitor | null,
  detectedClasses: Map<string, ClassDetection>,
  ensureLogMonitoring: () => void,
  startLogMonitoring: (logFilePath: string) => void,
  stopLogMonitoring: () => void
): void {
  // Supprimer les handlers existants pour éviter les doublons
  const handlers = [
    "get-saved-characters",
    "save-character",
    "delete-character",
    "get-log-path",
    "select-log-path",
    "start-monitoring",
    "stop-monitoring",
    "create-tracker",
    "close-tracker",
    "get-deduplication-stats",
    "get-detected-classes",
    "get-asset-path",
    "open-debug",
  ];

  handlers.forEach((handler) => {
    if (ipcMain.listenerCount(handler) > 0) {
      ipcMain.removeHandler(handler);
    }
  });

  // Ajouter les nouveaux handlers pour CRA
  const craHandlers = [
    "toggle-cra-jauge",
    "toggle-cra-tracker",
  ];

  craHandlers.forEach((handler) => {
    if (ipcMain.listenerCount(handler) > 0) {
      ipcMain.removeHandler(handler);
    }
  });

  // Personnages
  ipcMain.handle("get-saved-characters", () => {
    return Config.getSavedCharacters();
  });

  ipcMain.handle(
    "save-character",
    (_event, className: string, playerName: string) => {
      Config.saveCharacter(className, playerName);
    }
  );

  ipcMain.handle(
    "delete-character",
    (_event, className: string, playerName: string) => {
      Config.deleteCharacter(className, playerName);
    }
  );

  // Chemins de logs
  ipcMain.handle("get-log-path", () => {
    const savedDir = Config.getLogPath();
    if (savedDir) {
      return savedDir;
    }
    const defaultLogFile = Config.getDefaultLogPath();
    return require("path").dirname(defaultLogFile);
  });

  ipcMain.handle("select-log-path", async () => {
    const result = await dialog.showOpenDialog(launcherWindow!, {
      properties: ["openDirectory"],
      title: "Sélectionnez le dossier de logs Wakfu",
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const logsDir = result.filePaths[0];
      const logFilePath = Config.getLogFilePath(logsDir);

      Config.setLogPath(logsDir);
      startLogMonitoring(logFilePath);

      return logsDir;
    }

    return null;
  });

  ipcMain.handle("start-monitoring", (_event, logsDir?: string) => {
    const dirToUse = logsDir || Config.getLogPath();
    const chatLogPath = Config.getLogFilePath(dirToUse);
    const combatLogPath = Config.getCombatLogFilePath(dirToUse);

    if (logsDir) {
      Config.setLogPath(logsDir);
    }

    startLogMonitoring(chatLogPath);
    // Note: startCombatLogMonitoring est appelé dans ensureLogMonitoring si nécessaire
    // Mais ici on le force aussi pour être sûr
    const { startCombatLogMonitoring } = require("../index");
    startCombatLogMonitoring(combatLogPath);

    return dirToUse || Config.getDefaultLogPath();
  });

  ipcMain.handle("stop-monitoring", () => {
    stopLogMonitoring();
  });

  // Trackers
  ipcMain.handle(
    "create-tracker",
    (_event, className: string, playerName: string) => {
      const character = { className, playerName };
      const classConfig = getClassConfig(className);

      // Si la classe a une configuration, utiliser TrackerManager
      if (classConfig) {
        const result = TrackerManager.toggleAllTrackers(character);
        const trackerIds = getTrackerTypes(className)
          .map((type) => TrackerManager.getTrackerId(className, playerName, type))
          .join(",");

        // Positionner les trackers les uns par rapport aux autres
        const trackerTypes = getTrackerTypes(className);
        for (let i = 1; i < trackerTypes.length; i++) {
          TrackerManager.positionTrackerRelative(
            character,
            trackerTypes[i],
            trackerTypes[i - 1]
          );
        }

        ensureLogMonitoring();
        return `${trackerIds}:${result.isVisible}`;
      }

      // Comportement par défaut pour les classes non configurées
      const trackerId = `tracker-${className}-${playerName}`;

      if (WindowManager.hasWindow(trackerId)) {
        const existingWindow = WindowManager.getWindow(trackerId);
        const { result } = WindowManager.toggleWindow(existingWindow);
        return `${trackerId}:${result}`;
      }

      WindowManager.createTrackerWindow(trackerId, "index.html", className, {
        width: 320,
        height: 200,
        resizable: false,
      });

      ensureLogMonitoring();
      return `${trackerId}:true`;
    }
  );

  ipcMain.handle("close-tracker", (_event, trackerId: string) => {
    WindowManager.closeWindow(trackerId);
  });

  // Statistiques
  ipcMain.handle("get-deduplication-stats", () => {
    return getLogMonitor()?.getDeduplicationStats() || null;
  });

  ipcMain.handle("get-detected-classes", () => {
    return Array.from(detectedClasses.values());
  });

  // Assets
  ipcMain.handle("get-asset-path", (_event, ...pathSegments: string[]) => {
    // Retourner une URL avec le protocole personnalisé assets://
    const url = pathSegments.join("/");
    return `assets://${url}`;
  });

  // Debug
  ipcMain.handle("open-debug", () => {
    WindowManager.createDebugWindow();
  });

  // Handlers spécifiques pour CRA (génériques via TrackerManager)
  ipcMain.handle(
    "toggle-cra-jauge",
    (_event, playerName: string) => {
      const character = { className: "Cra", playerName };
      const result = TrackerManager.toggleTracker(character, "jauge");
      const jaugeTrackerId = TrackerManager.getTrackerId("Cra", playerName, "jauge");
      ensureLogMonitoring();
      return `${jaugeTrackerId}:${result.isVisible}`;
    }
  );

  ipcMain.handle(
    "toggle-cra-tracker",
    (_event, playerName: string) => {
      const character = { className: "Cra", playerName };
      const result = TrackerManager.toggleTracker(character, "main");
      const trackerId = TrackerManager.getTrackerId("Cra", playerName, "main");
      ensureLogMonitoring();
      return `${trackerId}:${result.isVisible}`;
    }
  );
}
