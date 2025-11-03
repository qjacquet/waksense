/**
 * Main Process - Point d'entrée principal de l'application Electron
 */

import { app, BrowserWindow, protocol, screen } from "electron";
import * as fs from "fs";
import * as path from "path";
import { CombatStartInfo } from "../shared/log/log-processor";
import { Config } from "./core/config";
import { ClassDetection, LogMonitor } from "./core/log-monitor";
import { setupIpcHandlers } from "./handlers/ipc.handlers";
import { WindowManager } from "./windows/window-manager";

// Déclarer le protocole personnalisé comme privilégié AVANT app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: "assets",
    privileges: {
      standard: true,
      secure: true,
      corsEnabled: true,
      supportFetchAPI: true,
    },
  },
]);

let launcherWindow: BrowserWindow | null = null;
let detectionOverlay: BrowserWindow | null = null;
let logMonitor: LogMonitor | null = null;
let combatLogMonitor: LogMonitor | null = null; // LogMonitor pour wakfu.log (événements de combat)

const detectedClasses: Map<string, ClassDetection> = new Map();
// Mapping partagé playerName -> fighterId pour la détection de début de tour
const playerNameToFighterId: Map<string, number> = new Map();
const fighterIdToFighter: Map<number, CombatStartInfo["fighters"][0]> =
  new Map();
// Dernier fighterId qui avait son tracker ouvert (pour le masquer au début du tour suivant)
let lastActiveFighterId: number | null = null;

/**
 * Ferme tous les trackers de combat
 */
function closeAllTrackers(): void {
  const allWindows = WindowManager.getAllWindows();
  for (const [id, window] of allWindows) {
    if (id.startsWith("tracker-")) {
      WindowManager.closeWindow(id);
    }
  }
}

function ensureLogMonitoring(): void {
  const logPath = Config.getLogPath() || Config.getDefaultLogPath();

  // Surveiller wakfu_chat.log pour les sorts (détection de classes)
  if (!logMonitor) {
    startLogMonitoring(Config.getLogFilePath(logPath));
  }

  // Surveiller wakfu.log pour les événements de combat
  if (!combatLogMonitor) {
    startCombatLogMonitoring(Config.getCombatLogFilePath(logPath));
  }
}

function createDetectionOverlay(): void {
  if (detectionOverlay && !detectionOverlay.isDestroyed()) {
    detectionOverlay.show();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  detectionOverlay = WindowManager.createOverlayWindow("detection-overlay", {
    width: 250,
    height: 150,
    x: screenWidth - 250,
    y: Math.floor((screenHeight - 150) / 2),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
  });

  detectionOverlay.loadFile(
    path.join(
      __dirname,
      "..",
      "renderer",
      "core",
      "detection-overlay",
      "index.html"
    )
  );

  detectionOverlay.webContents.once("did-finish-load", () => {
    if (!detectionOverlay || detectionOverlay.isDestroyed()) {
      return;
    }

    detectionOverlay.webContents.on(
      "console-message",
      (event, level, message, line, sourceId) => {
        console.log(
          `[OVERLAY RENDERER ${level}]: ${message} (${sourceId}:${line})`
        );
      }
    );

    const alreadyDetected = Array.from(detectedClasses.values());
    for (const detection of alreadyDetected) {
      WindowManager.safeSendToWindow(
        detectionOverlay,
        "class-detected",
        detection
      );
    }
  });

  detectionOverlay.on("closed", () => {
    detectionOverlay = null;
  });

  detectionOverlay.show();
}

function createLauncherWindow(): void {
  launcherWindow = WindowManager.createLauncherWindow();

  launcherWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      console.log(
        `[LAUNCHER RENDERER ${level}]: ${message} (${sourceId}:${line})`
      );
    }
  );

  launcherWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[LAUNCHER] Failed to load: ${errorCode} - ${errorDescription} - ${validatedURL}`
      );
    }
  );

  launcherWindow.loadFile(
    path.join(__dirname, "..", "renderer", "core", "launcher", "index.html")
  );

  launcherWindow.on("closed", () => {
    launcherWindow = null;
  });
}

app.whenReady().then(() => {
  // Enregistrer le handler du protocole personnalisé pour les assets
  protocol.registerFileProtocol("assets", (request, callback) => {
    try {
      // Extraire le chemin depuis l'URL (assets://classes/cra/Affûtage.png)
      // request.url sera "assets://classes/cra/Aff%C3%BBtage.png" (URL encodée)
      const urlObj = new URL(request.url);
      // Décoder l'URL pour gérer les caractères spéciaux (accents)
      const decodedPath = decodeURIComponent(urlObj.pathname);
      // Enlever le slash initial si présent
      const cleanPath = decodedPath.startsWith("/")
        ? decodedPath.slice(1)
        : decodedPath;

      // Obtenir le chemin vers les assets
      // Les assets sont maintenant dans dist/assets/ (copiés par copy-assets)
      // En développement : app.getAppPath() pointe vers dist/
      // En production : app.getAppPath() pointe vers le dossier de l'application
      const appPath = app.getAppPath();
      // Les assets sont toujours dans dist/assets/ ou dans le dossier app/assets/
      const assetsBasePath = appPath.endsWith("dist")
        ? path.join(appPath, "assets")
        : path.join(appPath, "assets");

      const filePath = path.join(assetsBasePath, cleanPath);

      // Vérifier que le fichier existe
      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
      } else {
        console.error(`[ASSETS] File not found: ${filePath}`);
        console.error(`[ASSETS] Request URL: ${request.url}`);
        console.error(`[ASSETS] App path: ${appPath}`);
        console.error(`[ASSETS] Assets base: ${assetsBasePath}`);
        callback({ error: -6 }); // FILE_NOT_FOUND error code
      }
    } catch (error) {
      console.error(`[ASSETS] Error handling request: ${request.url}`, error);
      callback({ error: -2 }); // FAILED error code
    }
  });

  createLauncherWindow();

  setupIpcHandlers(
    launcherWindow,
    () => logMonitor, // Passer une fonction qui retourne le logMonitor actuel
    detectedClasses,
    ensureLogMonitoring,
    startLogMonitoring,
    stopLogMonitoring
  );

  if (launcherWindow) {
    launcherWindow.webContents.once("did-finish-load", () => {
      // Envoyer les classes déjà détectées au launcher
      const alreadyDetected = Array.from(detectedClasses.values());
      for (const detection of alreadyDetected) {
        WindowManager.safeSendToWindow(
          launcherWindow,
          "class-detected",
          detection
        );
      }

      const savedLogsDir = Config.getLogPath();
      let logFilePath: string;

      if (savedLogsDir) {
        logFilePath = Config.getLogFilePath(savedLogsDir);
      } else {
        logFilePath = Config.getDefaultLogPath();
      }

      if (fs.existsSync(logFilePath)) {
        startLogMonitoring(logFilePath);
        launcherWindow?.webContents.send("monitoring-started");
      } else {
        launcherWindow?.webContents.send("log-file-not-found");
      }
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopLogMonitoring();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopLogMonitoring();
  WindowManager.closeAll();
});

function startCombatLogMonitoring(logFilePath: string): void {
  if (combatLogMonitor) {
    combatLogMonitor.stop();
  }

  combatLogMonitor = new LogMonitor(logFilePath, true);

  // Écouter uniquement les événements de combat (début/fin de combat)
  combatLogMonitor.on("combatStarted", (combatInfo?: CombatStartInfo) => {
    if (combatInfo && combatInfo.fighters) {
      // S'assurer que l'overlay existe et est visible avant de détecter les combattants
      if (!detectionOverlay || detectionOverlay.isDestroyed()) {
        createDetectionOverlay();
      } else if (!detectionOverlay.isVisible()) {
        detectionOverlay.show();
      }

      // Synchroniser les mappings avec logMonitor pour la détection de début de tour
      playerNameToFighterId.clear();
      fighterIdToFighter.clear();

      // Nouveau pattern : détecter les combattants et mettre à jour la liste des personnages
      for (const fighter of combatInfo.fighters) {
        if (fighter.className) {
          // Enregistrer la détection de classe
          const key = `${fighter.className}_${fighter.playerName}`;
          detectedClasses.set(key, {
            className: fighter.className,
            playerName: fighter.playerName,
          });

          // Synchroniser les mappings pour la détection de début de tour
          if (fighter.fighterId !== undefined) {
            playerNameToFighterId.set(fighter.playerName, fighter.fighterId);
            fighterIdToFighter.set(fighter.fighterId, fighter);
          }

          // Notifier la détection de classe pour l'overlay et le launcher
          // Cela va mettre à jour la liste des personnages
          WindowManager.safeSendToWindow(detectionOverlay, "class-detected", {
            className: fighter.className,
            playerName: fighter.playerName,
          });

          WindowManager.safeSendToWindow(launcherWindow, "class-detected", {
            className: fighter.className,
            playerName: fighter.playerName,
          });
        }
      }

      // Synchroniser les mappings avec logMonitor pour qu'il puisse détecter le début de tour
      if (logMonitor) {
        logMonitor.syncFighterMappings(
          playerNameToFighterId,
          fighterIdToFighter
        );
      }
    }

    WindowManager.safeSendToWindow(launcherWindow, "combat-started");
  });

  combatLogMonitor.on(
    "fighterJoined",
    (data: {
      fightId: number;
      fighter: {
        playerName: string;
        breed: number;
        className: string | null;
        fighterId?: number;
      };
    }) => {
      // Un nouveau combattant a rejoint le combat - mettre à jour la liste des personnages
      if (data.fighter.className) {
        // S'assurer que l'overlay existe et est visible
        if (!detectionOverlay || detectionOverlay.isDestroyed()) {
          createDetectionOverlay();
        } else if (!detectionOverlay.isVisible()) {
          detectionOverlay.show();
        }

        // Enregistrer la détection de classe
        const key = `${data.fighter.className}_${data.fighter.playerName}`;
        detectedClasses.set(key, {
          className: data.fighter.className,
          playerName: data.fighter.playerName,
        });

        // Synchroniser les mappings pour la détection de début de tour
        if (data.fighter.fighterId !== undefined) {
          playerNameToFighterId.set(
            data.fighter.playerName,
            data.fighter.fighterId
          );
          fighterIdToFighter.set(data.fighter.fighterId, data.fighter);
        }

        // Synchroniser les mappings avec logMonitor pour qu'il puisse détecter le début de tour
        if (logMonitor) {
          logMonitor.syncFighterMappings(
            playerNameToFighterId,
            fighterIdToFighter
          );
        }

        // Notifier la détection de classe pour mettre à jour la liste
        WindowManager.safeSendToWindow(detectionOverlay, "class-detected", {
          className: data.fighter.className,
          playerName: data.fighter.playerName,
        });

        WindowManager.safeSendToWindow(launcherWindow, "class-detected", {
          className: data.fighter.className,
          playerName: data.fighter.playerName,
        });
      }
    }
  );

  combatLogMonitor.on("combatEnded", (fightId?: number) => {
    // Fermer automatiquement tous les trackers à la fin du combat
    closeAllTrackers();

    // Réinitialiser les mappings
    playerNameToFighterId.clear();
    fighterIdToFighter.clear();
    lastActiveFighterId = null;

    // Masquer l'overlay de la liste des personnages à la fin du combat
    if (
      detectionOverlay &&
      !detectionOverlay.isDestroyed() &&
      detectionOverlay.isVisible()
    ) {
      detectionOverlay.hide();
    }

    WindowManager.safeSendToWindow(launcherWindow, "combat-ended");
  });

  combatLogMonitor.start();
}

function startLogMonitoring(logFilePath: string): void {
  if (logMonitor) {
    logMonitor.stop();
  }

  logMonitor = new LogMonitor(logFilePath, true);

  logMonitor.on("classDetected", (detection: ClassDetection) => {
    const key = `${detection.className}_${detection.playerName}`;
    detectedClasses.set(key, detection);

    if (
      !WindowManager.safeSendToWindow(
        detectionOverlay,
        "class-detected",
        detection
      )
    ) {
      createDetectionOverlay();
    } else if (detectionOverlay && !detectionOverlay.isVisible()) {
      detectionOverlay.show();
    }

    WindowManager.safeSendToWindow(launcherWindow, "class-detected", detection);
  });

  // Note: Les événements de combat (combatStarted, combatEnded) sont maintenant gérés par combatLogMonitor
  // qui surveille wakfu.log. Ce logMonitor surveille wakfu_chat.log pour les sorts.

  // Détection du début de tour - ouvrir automatiquement le tracker
  logMonitor.on(
    "turnStarted",
    (data: {
      fighterId: number;
      fighter: { playerName: string; className: string | null };
    }) => {
      if (data.fighter && data.fighter.className) {
        const trackerId = `tracker-${data.fighter.className}-${data.fighter.playerName}`;

        // Gestion spéciale pour Iop (boosts + combos)
        if (data.fighter.className === "Iop") {
          const boostsTrackerId = `tracker-${data.fighter.className}-${data.fighter.playerName}-boosts`;
          const combosTrackerId = `tracker-${data.fighter.className}-${data.fighter.playerName}-combos`;

          // Si les trackers n'existent pas, les créer
          if (!WindowManager.hasWindow(boostsTrackerId)) {
            WindowManager.createTrackerWindow(
              boostsTrackerId,
              "boosts.html",
              "iop",
              {
                width: 240,
                height: 180,
                resizable: true,
                rendererName: "IOP BOOSTS",
              }
            );
          } else {
            const boostsWindow = WindowManager.getWindow(boostsTrackerId);
            if (boostsWindow && !boostsWindow.isDestroyed()) {
              boostsWindow.show();
              boostsWindow.focus();
            }
          }

          if (!WindowManager.hasWindow(combosTrackerId)) {
            const boostsWindow = WindowManager.getWindow(boostsTrackerId);
            const combosWindow = WindowManager.createTrackerWindow(
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

            // Positionner le combos à côté du boosts
            if (
              boostsWindow &&
              combosWindow &&
              !boostsWindow.isDestroyed() &&
              !combosWindow.isDestroyed()
            ) {
              const boostsBounds = boostsWindow.getBounds();
              combosWindow.setPosition(
                boostsBounds.x + boostsBounds.width + 10,
                boostsBounds.y
              );
            }
          } else {
            const combosWindow = WindowManager.getWindow(combosTrackerId);
            if (combosWindow && !combosWindow.isDestroyed()) {
              combosWindow.show();
              combosWindow.focus();
            }
          }
        } else {
          // Pour les autres classes, créer le tracker standard
          if (!WindowManager.hasWindow(trackerId)) {
            WindowManager.createTrackerWindow(
              trackerId,
              "index.html",
              data.fighter.className,
              {
                width: 320,
                height: 200,
                resizable: false,
              }
            );
          } else {
            // Si le tracker existe déjà, s'assurer qu'il est visible
            const window = WindowManager.getWindow(trackerId);
            if (window && !window.isDestroyed()) {
              window.show();
              window.focus();
            }
          }
        }

        // Mémoriser le fighterId actif pour le masquer au prochain tour
        lastActiveFighterId = data.fighterId;

        ensureLogMonitoring();
      }
    }
  );

  // Détection de la fin de tour - masquer tous les trackers
  logMonitor.on("turnEnded", () => {
    // Masquer tous les trackers actuellement visibles
    const allWindows = WindowManager.getAllWindows();
    for (const [id, window] of allWindows) {
      if (
        id.startsWith("tracker-") &&
        window &&
        !window.isDestroyed() &&
        window.isVisible()
      ) {
        window.hide();
      }
    }

    // Réinitialiser le dernier fighterId actif
    lastActiveFighterId = null;
  });

  logMonitor.on("logLine", (line: string, parsed: any) => {
    const trackerWindows = WindowManager.getAllWindows();
    console.log(
      `[MAIN] Log line emitted, ${trackerWindows.size} windows total`
    );

    trackerWindows.forEach((window, id) => {
      if (id.startsWith("tracker-")) {
        console.log(`[MAIN] Sending log to tracker: ${id}`);
        const sent = WindowManager.safeSendToWindow(
          window,
          "log-line",
          line,
          parsed
        );
        if (!sent) {
          console.error(`[MAIN] Failed to send log to tracker: ${id}`);
        }
      }
    });
  });

  logMonitor.start();
}

function stopLogMonitoring(): void {
  if (logMonitor) {
    logMonitor.stop();
    logMonitor = null;
  }
  if (combatLogMonitor) {
    combatLogMonitor.stop();
    combatLogMonitor = null;
  }
}

function openDebugWindow(): void {
  WindowManager.createDebugWindow();
}

export {
  createLauncherWindow,
  openDebugWindow,
  startCombatLogMonitoring,
  startLogMonitoring,
  stopLogMonitoring,
};
