/**
 * Main Process - Point d'entrée principal de l'application Electron
 */

import { app, BrowserWindow, protocol, screen } from "electron";
import * as fs from "fs";
import * as path from "path";
import { CombatStartInfo } from "../shared/log/log-processor";
import { Config } from "./core/config";
import { ClassDetection, LogMonitor } from "./core/log-monitor";
import { WindowWatcher } from "./core/window-watcher";
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
let windowWatcher: WindowWatcher | null = null;

const detectedClasses: Map<string, ClassDetection> = new Map();
// Mapping partagé playerName -> fighterId pour la détection de début de tour
const playerNameToFighterId: Map<string, number> = new Map();
const fighterIdToFighter: Map<number, CombatStartInfo["fighters"][0]> =
  new Map();

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

function hideAllJauges(): void {
  const allWindows = WindowManager.getAllWindows();
  
  for (const [id, window] of allWindows) {
    if (id.endsWith("-jauge")) {
      if (window && !window.isDestroyed()) {
        window.hide();
      }
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

  // Démarrer le surveillant de fenêtre pour détecter les changements de personnage
  windowWatcher = new WindowWatcher();
  
  windowWatcher.setOnCharacterChanged((character) => {
    hideAllJauges();
    
    if (character) {
      const jaugeTrackerId = `tracker-${character.className}-${character.playerName}-jauge`;
      const jaugeWindow = WindowManager.getWindow(jaugeTrackerId);
      
      if (jaugeWindow && !jaugeWindow.isDestroyed()) {
        jaugeWindow.show();
        jaugeWindow.focus();
        WindowManager.safeSendToWindow(jaugeWindow, "combat-started");
      }
    }
  });
  
  windowWatcher.start();

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
  // Arrêter le surveillant de fenêtre
  if (windowWatcher) {
    windowWatcher.stop();
    windowWatcher = null;
  }
  
  if (process.platform !== "darwin") {
    stopLogMonitoring();
    app.quit();
  }
});

app.on("before-quit", () => {
  // Arrêter le surveillant de fenêtre
  if (windowWatcher) {
    windowWatcher.stop();
    windowWatcher = null;
  }
  
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
      // Ne plus masquer toutes les jauges au début du combat
      // Les jauges seront gérées par le WindowWatcher et les événements de tour

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

          // Pour les personnages CRA et IOP : créer la jauge si elle n'existe pas
          if (fighter.className === "Cra" || fighter.className === "Iop") {
            const jaugeTrackerId = `tracker-${fighter.className}-${fighter.playerName}-jauge`;
            
            // Créer la jauge si elle n'existe pas
            if (!WindowManager.hasWindow(jaugeTrackerId)) {
              const config = fighter.className === "Cra" 
                ? { width: 300, height: 350, resizable: true, rendererName: "CRA JAUGE" }
                : { width: 300, height: 300, resizable: true, rendererName: "IOP JAUGE" };
              
              const jaugeWindow = WindowManager.createTrackerWindow(
                jaugeTrackerId,
                "jauge.html",
                fighter.className.toLowerCase(),
                config
              );
              
              // Envoyer l'événement combat-started pour initialiser le tracker
              // La jauge sera affichée plus tard dans la boucle qui affiche toutes les jauges
              if (jaugeWindow && !jaugeWindow.isDestroyed()) {
                jaugeWindow.webContents.once("did-finish-load", () => {
                  if (jaugeWindow && !jaugeWindow.isDestroyed()) {
                    WindowManager.safeSendToWindow(jaugeWindow, "combat-started");
                  }
                });
                WindowManager.safeSendToWindow(jaugeWindow, "combat-started");
              }
            } else {
              // Si la jauge existe déjà, envoyer l'événement
              const jaugeWindow = WindowManager.getWindow(jaugeTrackerId);
              if (jaugeWindow && !jaugeWindow.isDestroyed()) {
                WindowManager.safeSendToWindow(jaugeWindow, "combat-started");
              }
            }
          }
        }
      }

      // Synchroniser les mappings avec logMonitor pour qu'il puisse détecter le début de tour
      if (logMonitor) {
        logMonitor.syncFighterMappings(
          playerNameToFighterId,
          fighterIdToFighter
        );
      }
      
      // Mettre à jour le WindowWatcher avec les personnages détectés en combat
      if (windowWatcher) {
        // Convertir detectedClasses en Map pour le WindowWatcher
        const detectedCharsMap = new Map<string, { className: string; playerName: string }>();
        for (const [key, detection] of detectedClasses.entries()) {
          detectedCharsMap.set(key, detection);
        }
        windowWatcher.setDetectedCharacters(detectedCharsMap);
      }
      
      // Afficher les jauges des personnages détectés au début du combat
      for (const fighter of combatInfo.fighters) {
        if (fighter.className === "Cra" || fighter.className === "Iop") {
          const jaugeTrackerId = `tracker-${fighter.className}-${fighter.playerName}-jauge`;
          const jaugeWindow = WindowManager.getWindow(jaugeTrackerId);
          if (jaugeWindow && !jaugeWindow.isDestroyed()) {
            jaugeWindow.show(); // Afficher au début du combat
            jaugeWindow.focus();
          }
        }
      }
    }

    WindowManager.safeSendToWindow(launcherWindow, "combat-started");
    
    // Envoyer l'événement à toutes les fenêtres de trackers
    const trackerWindows = WindowManager.getAllWindows();
    trackerWindows.forEach((window, id) => {
      if (id.startsWith("tracker-")) {
        WindowManager.safeSendToWindow(window, "combat-started");
      }
    });
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
    // Réactiver le WindowWatcher à la fin du combat (au cas où un tour serait encore actif)
    if (windowWatcher) {
      windowWatcher.setTurnActive(false);
    }

    // Fermer automatiquement tous les trackers à la fin du combat
    closeAllTrackers();

    // Réinitialiser les mappings
    playerNameToFighterId.clear();
    fighterIdToFighter.clear();

    // Masquer l'overlay de la liste des personnages à la fin du combat
    if (
      detectionOverlay &&
      !detectionOverlay.isDestroyed() &&
      detectionOverlay.isVisible()
    ) {
      detectionOverlay.hide();
    }

    WindowManager.safeSendToWindow(launcherWindow, "combat-ended");
    
    // Envoyer l'événement à toutes les fenêtres de trackers
    const trackerWindows = WindowManager.getAllWindows();
    trackerWindows.forEach((window, id) => {
      if (id.startsWith("tracker-")) {
        WindowManager.safeSendToWindow(window, "combat-ended");
      }
    });
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

  logMonitor.on(
    "turnStarted",
    (data: {
      fighterId: number;
      fighter: { playerName: string; className: string | null };
    }) => {
      if (!data.fighter || !data.fighter.className) {
        return;
      }

      const activeCharacter = {
        playerName: data.fighter.playerName,
        className: data.fighter.className,
      };

      const jaugeTrackerId = `tracker-${activeCharacter.className}-${activeCharacter.playerName}-jauge`;
      
      const showJauge = () => {
        let jaugeWindow = WindowManager.getWindow(jaugeTrackerId);
        
        if (jaugeWindow && !jaugeWindow.isDestroyed()) {
          jaugeWindow.show();
          jaugeWindow.focus();
          WindowManager.safeSendToWindow(jaugeWindow, "combat-started");
        } else if (!WindowManager.hasWindow(jaugeTrackerId)) {
          const config = 
            activeCharacter.className === "Cra" 
              ? { width: 300, height: 350, resizable: true, rendererName: "CRA JAUGE" }
              : activeCharacter.className === "Iop"
              ? { width: 300, height: 300, resizable: true, rendererName: "IOP JAUGE" }
              : null;

          if (config) {
            const newJaugeWindow = WindowManager.createTrackerWindow(
              jaugeTrackerId,
              "jauge.html",
              activeCharacter.className.toLowerCase(),
              config
            );

            if (newJaugeWindow && !newJaugeWindow.isDestroyed()) {
              newJaugeWindow.webContents.once("did-finish-load", () => {
                if (newJaugeWindow && !newJaugeWindow.isDestroyed()) {
                  newJaugeWindow.show();
                  newJaugeWindow.focus();
                  WindowManager.safeSendToWindow(newJaugeWindow, "combat-started");
                }
              });
              newJaugeWindow.show();
              newJaugeWindow.focus();
            }
          }
        }
      };

      // Appeler immédiatement (backup si WindowWatcher n'a pas déjà géré)
      showJauge();

      // Pour CRA, créer aussi le tracker s'il n'existe pas (mais ne pas l'afficher par défaut)
      if (activeCharacter.className === "Cra") {
        const trackerId = `tracker-${activeCharacter.className}-${activeCharacter.playerName}`;
        if (!WindowManager.hasWindow(trackerId)) {
          const trackerWindow = WindowManager.createTrackerWindow(
            trackerId,
            "index.html",
            "cra",
            {
              width: 320,
              height: 200,
              resizable: false,
            }
          );
          if (trackerWindow && !trackerWindow.isDestroyed()) {
            trackerWindow.webContents.once("did-finish-load", () => {
              if (trackerWindow && !trackerWindow.isDestroyed()) {
                trackerWindow.hide();
              }
            });
            trackerWindow.hide();
          }
        }
      }

      ensureLogMonitoring();
    }
  );

  logMonitor.on("turnEnded", () => {
    // Le WindowWatcher gère la fin/début de tour
  });

  logMonitor.on("logLine", (line: string, parsed: any) => {
    const trackerWindows = WindowManager.getAllWindows();

    trackerWindows.forEach((window, id) => {
      if (id.startsWith("tracker-")) {
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
