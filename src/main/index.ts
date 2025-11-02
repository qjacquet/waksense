/**
 * Main Process - Point d'entrée principal de l'application Electron
 */

import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { WindowManager } from './windows/window-manager';
import { Config } from './core/config';
import { LogMonitor, ClassDetection } from './core/log-monitor';
import { setupIpcHandlers } from './handlers/ipc.handlers';
import { CombatStartInfo } from '../shared/log/log-processor';
import { ClassType } from '../shared/domain/wakfu-domain';

let launcherWindow: BrowserWindow | null = null;
let detectionOverlay: BrowserWindow | null = null;
let logMonitor: LogMonitor | null = null;
let combatLogMonitor: LogMonitor | null = null; // LogMonitor pour wakfu.log (événements de combat)

const detectedClasses: Map<string, ClassDetection> = new Map();

/**
 * Ferme tous les trackers de combat
 */
function closeAllTrackers(): void {
  const allWindows = WindowManager.getAllWindows();
  for (const [id, window] of allWindows) {
    if (id.startsWith('tracker-')) {
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
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  detectionOverlay = WindowManager.createOverlayWindow('detection-overlay', {
    width: 250,
    height: 150,
    x: screenWidth - 250,
    y: Math.floor((screenHeight - 150) / 2),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false
  });

  detectionOverlay.loadFile(path.join(__dirname, '..', 'renderer', 'core', 'detection-overlay', 'index.html'));

  detectionOverlay.webContents.once('did-finish-load', () => {
    if (!detectionOverlay || detectionOverlay.isDestroyed()) {
      return;
    }
    
    detectionOverlay.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[OVERLAY RENDERER ${level}]: ${message} (${sourceId}:${line})`);
    });
    
    const alreadyDetected = Array.from(detectedClasses.values());
    for (const detection of alreadyDetected) {
      WindowManager.safeSendToWindow(detectionOverlay, 'class-detected', detection);
    }
  });

  detectionOverlay.on('closed', () => {
    detectionOverlay = null;
  });

  detectionOverlay.show();
}

function createLauncherWindow(): void {
  launcherWindow = WindowManager.createLauncherWindow();

  launcherWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[LAUNCHER RENDERER ${level}]: ${message} (${sourceId}:${line})`);
  });

  launcherWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[LAUNCHER] Failed to load: ${errorCode} - ${errorDescription} - ${validatedURL}`);
  });

  launcherWindow.loadFile(path.join(__dirname, '..', 'renderer', 'core', 'launcher', 'index.html'));

  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });
}

app.whenReady().then(() => {
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
    launcherWindow.webContents.once('did-finish-load', () => {
      // Envoyer les classes déjà détectées au launcher
      const alreadyDetected = Array.from(detectedClasses.values());
      for (const detection of alreadyDetected) {
        WindowManager.safeSendToWindow(launcherWindow, 'class-detected', detection);
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
        launcherWindow?.webContents.send('monitoring-started');
      } else {
        launcherWindow?.webContents.send('log-file-not-found');
      }
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopLogMonitoring();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopLogMonitoring();
  WindowManager.closeAll();
});

function startCombatLogMonitoring(logFilePath: string): void {
  if (combatLogMonitor) {
    combatLogMonitor.stop();
  }

  combatLogMonitor = new LogMonitor(logFilePath, true);
  
  // Écouter uniquement les événements de combat (début/fin de combat)
  combatLogMonitor.on('combatStarted', (combatInfo?: CombatStartInfo) => {
    if (combatInfo && combatInfo.fighters) {
      // S'assurer que l'overlay existe et est visible avant de détecter les combattants
      if (!detectionOverlay || detectionOverlay.isDestroyed()) {
        createDetectionOverlay();
      } else if (!detectionOverlay.isVisible()) {
        detectionOverlay.show();
      }
      
      // Nouveau pattern : détecter les combattants et mettre à jour la liste des personnages
      for (const fighter of combatInfo.fighters) {
        if (fighter.className) {
          // Enregistrer la détection de classe
          const key = `${fighter.className}_${fighter.playerName}`;
          detectedClasses.set(key, {
            className: fighter.className,
            playerName: fighter.playerName
          });
          
          // Notifier la détection de classe pour l'overlay et le launcher
          // Cela va mettre à jour la liste des personnages
          WindowManager.safeSendToWindow(detectionOverlay, 'class-detected', {
            className: fighter.className,
            playerName: fighter.playerName
          });
          
          WindowManager.safeSendToWindow(launcherWindow, 'class-detected', {
            className: fighter.className,
            playerName: fighter.playerName
          });
        }
      }
    }
    
    WindowManager.safeSendToWindow(launcherWindow, 'combat-started');
  });

  combatLogMonitor.on('fighterJoined', (data: { fightId: number; fighter: { playerName: string; breed: number; className: string | null } }) => {
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
        playerName: data.fighter.playerName
      });
      
      // Notifier la détection de classe pour mettre à jour la liste
      WindowManager.safeSendToWindow(detectionOverlay, 'class-detected', {
        className: data.fighter.className,
        playerName: data.fighter.playerName
      });
      
      WindowManager.safeSendToWindow(launcherWindow, 'class-detected', {
        className: data.fighter.className,
        playerName: data.fighter.playerName
      });
    }
  });

  combatLogMonitor.on('combatEnded', (fightId?: number) => {
    // Fermer automatiquement tous les trackers à la fin du combat
    closeAllTrackers();
    
    // Masquer l'overlay de la liste des personnages à la fin du combat
    if (detectionOverlay && !detectionOverlay.isDestroyed() && detectionOverlay.isVisible()) {
      detectionOverlay.hide();
    }
    
    WindowManager.safeSendToWindow(launcherWindow, 'combat-ended');
  });
  
  combatLogMonitor.start();
}

function startLogMonitoring(logFilePath: string): void {
  if (logMonitor) {
    logMonitor.stop();
  }

  logMonitor = new LogMonitor(logFilePath, true);

  logMonitor.on('classDetected', (detection: ClassDetection) => {
    const key = `${detection.className}_${detection.playerName}`;
    detectedClasses.set(key, detection);
    
    if (!WindowManager.safeSendToWindow(detectionOverlay, 'class-detected', detection)) {
      createDetectionOverlay();
    } else if (detectionOverlay && !detectionOverlay.isVisible()) {
      detectionOverlay.show();
    }
    
    WindowManager.safeSendToWindow(launcherWindow, 'class-detected', detection);
  });

  // Note: Les événements de combat (combatStarted, combatEnded) sont maintenant gérés par combatLogMonitor
  // qui surveille wakfu.log. Ce logMonitor surveille wakfu_chat.log pour les sorts.

  logMonitor.on('logLine', (line: string, parsed: any) => {
    const trackerWindows = WindowManager.getAllWindows();
    console.log(`[MAIN] Log line emitted, ${trackerWindows.size} windows total`);
    
    trackerWindows.forEach((window, id) => {
      if (id.startsWith('tracker-')) {
        console.log(`[MAIN] Sending log to tracker: ${id}`);
        const sent = WindowManager.safeSendToWindow(window, 'log-line', line, parsed);
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

export { createLauncherWindow, startLogMonitoring, startCombatLogMonitoring, stopLogMonitoring };

