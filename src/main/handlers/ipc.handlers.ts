/**
 * IPC Handlers - Gestionnaires IPC pour la communication main/renderer
 */

import { BrowserWindow, dialog, ipcMain } from "electron";
import { Config } from "../core/config";
import { ClassDetection, LogMonitor } from "../core/log-monitor";
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
      if (className.toLowerCase() === "iop") {
        const boostsTrackerId = `tracker-${className}-${playerName}-boosts`;
        const combosTrackerId = `tracker-${className}-${playerName}-combos`;
        const jaugeTrackerId = `tracker-${className}-${playerName}-jauge`;

        const boostsExists = WindowManager.hasWindow(boostsTrackerId);
        const combosExists = WindowManager.hasWindow(combosTrackerId);
        const jaugeExists = WindowManager.hasWindow(jaugeTrackerId);

        if (jaugeExists || combosExists) {
          const boostsWindow = boostsExists
            ? WindowManager.getWindow(boostsTrackerId)
            : undefined;
          const combosWindow = combosExists
            ? WindowManager.getWindow(combosTrackerId)
            : undefined;
          const jaugeWindow = jaugeExists
            ? WindowManager.getWindow(jaugeTrackerId)
            : undefined;
          const isCurrentlyVisible =
            (jaugeWindow?.isVisible() ?? false) ||
            (combosWindow?.isVisible() ?? false) ||
            (boostsWindow?.isVisible() ?? false);

          if (isCurrentlyVisible) {
            boostsWindow?.hide();
            combosWindow?.hide();
            jaugeWindow?.hide();
          } else {
            boostsWindow?.show();
            boostsWindow?.focus();
            combosWindow?.show();
            combosWindow?.focus();
            jaugeWindow?.show();
            jaugeWindow?.focus();
          }

          return `${boostsTrackerId},${combosTrackerId},${jaugeTrackerId}:${!isCurrentlyVisible}`;
        }

        let boostsWindow: BrowserWindow | undefined;
        let combosWindow: BrowserWindow | undefined;
        let jaugeWindow: BrowserWindow | undefined;

        if (boostsExists) {
          boostsWindow = WindowManager.getWindow(boostsTrackerId);
          combosWindow = WindowManager.createTrackerWindow(
            combosTrackerId,
            "combos.html",
            "iop",
            {
              width: 240,
              height: 180,
              resizable: true,
              rendererName: "IOP COMBOS",
            }
          );
          jaugeWindow = WindowManager.createTrackerWindow(
            jaugeTrackerId,
            "jauge.html",
            "iop",
            {
              width: 300,
              height: 300,
              resizable: true,
              rendererName: "IOP JAUGE",
            }
          );
          if (boostsWindow?.isVisible()) {
            combosWindow?.show();
            jaugeWindow?.show();
          }
        } else if (combosExists) {
          combosWindow = WindowManager.getWindow(combosTrackerId);
          jaugeWindow = WindowManager.createTrackerWindow(
            jaugeTrackerId,
            "jauge.html",
            "iop",
            {
              width: 300,
              height: 300,
              resizable: true,
              rendererName: "IOP JAUGE",
            }
          );
        } else {
          combosWindow = WindowManager.createTrackerWindow(
            combosTrackerId,
            "combos.html",
            "iop",
            {
              width: 240,
              height: 180,
              resizable: true,
              rendererName: "IOP COMBOS",
            }
          );
          jaugeWindow = WindowManager.createTrackerWindow(
            jaugeTrackerId,
            "jauge.html",
            "iop",
            {
              width: 300,
              height: 300,
              resizable: true,
              rendererName: "IOP JAUGE",
            }
          );
        }

        // Positionner manuellement uniquement si aucune position sauvegardée n'existe
        if (
          boostsWindow &&
          combosWindow &&
          !boostsWindow.isDestroyed() &&
          !combosWindow.isDestroyed()
        ) {
          const combosTrackerId = `tracker-${className}-${playerName}-combos`;
          const savedCombosPos = Config.getOverlayPosition(combosTrackerId);
          if (!savedCombosPos) {
            const boostsBounds = boostsWindow.getBounds();
            combosWindow.setPosition(
              boostsBounds.x + boostsBounds.width + 10,
              boostsBounds.y
            );
          }
        }

        if (
          combosWindow &&
          jaugeWindow &&
          !combosWindow.isDestroyed() &&
          !jaugeWindow.isDestroyed()
        ) {
          const jaugeTrackerId = `tracker-${className}-${playerName}-jauge`;
          const savedJaugePos = Config.getOverlayPosition(jaugeTrackerId);
          if (!savedJaugePos) {
            const combosBounds = combosWindow.getBounds();
            jaugeWindow.setPosition(
              combosBounds.x + combosBounds.width + 10,
              combosBounds.y
            );
          }
        }

        ensureLogMonitoring();

        const isVisible =
          (jaugeWindow &&
            !jaugeWindow.isDestroyed() &&
            jaugeWindow.isVisible()) ||
          (combosWindow &&
            !combosWindow.isDestroyed() &&
            combosWindow.isVisible()) ||
          (boostsWindow &&
            !boostsWindow.isDestroyed() &&
            boostsWindow.isVisible());
        return `${boostsTrackerId},${combosTrackerId},${jaugeTrackerId}:${isVisible}`;
      }

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
}
