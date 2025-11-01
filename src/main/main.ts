/**
 * Main Process - Point d'entrée principal de l'application Electron
 */

import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import * as path from 'path';
import { WindowManager } from './window-manager';
import { Config } from './config';
import { LogMonitor, ClassDetection } from './log-monitor';

let launcherWindow: BrowserWindow | null = null;
let detectionOverlay: BrowserWindow | null = null;
let logMonitor: LogMonitor | null = null;

// Stocker les classes détectées (même si le listener n'est pas encore attaché)
const detectedClasses: Map<string, ClassDetection> = new Map();

// Fonction pour créer l'overlay de détection
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

  // Charger l'interface de l'overlay
  detectionOverlay.loadFile(path.join(__dirname, '..', 'renderer', 'detection-overlay', 'index.html'));

  // Ouvrir DevTools pour debug (temporairement)
  detectionOverlay.webContents.once('did-finish-load', () => {
    if (!detectionOverlay || detectionOverlay.isDestroyed()) {
      return;
    }
    
    // Écouter les messages de la console du renderer (sans ouvrir DevTools)
    detectionOverlay.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[OVERLAY RENDERER ${level}]: ${message} (${sourceId}:${line})`);
    });
    
    // Envoyer les classes déjà détectées à l'overlay
    const alreadyDetected = Array.from(detectedClasses.values());
    if (alreadyDetected.length > 0 && detectionOverlay && !detectionOverlay.isDestroyed()) {
      for (const detection of alreadyDetected) {
        detectionOverlay.webContents.send('class-detected', detection);
      }
    }
  });

  detectionOverlay.on('closed', () => {
    detectionOverlay = null;
  });

  // Afficher l'overlay
  detectionOverlay.show();
}

// Fonction pour créer la fenêtre principale
function createLauncherWindow(): void {
  launcherWindow = WindowManager.createLauncherWindow();

  // Attacher le listener console-message AVANT de charger le fichier
  // Écouter les messages de la console du renderer ET du preload
  launcherWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[LAUNCHER RENDERER ${level}]: ${message} (${sourceId}:${line})`);
  });

  // Écouter aussi les erreurs de console
  launcherWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[LAUNCHER] Failed to load: ${errorCode} - ${errorDescription} - ${validatedURL}`);
  });

  // Charger l'interface HTML
  launcherWindow.loadFile(path.join(__dirname, '..', 'renderer', 'launcher', 'index.html'));

  launcherWindow.webContents.once('did-finish-load', () => {
    // Window loaded
  });

  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });
}

// Initialiser l'application
app.whenReady().then(() => {
  createLauncherWindow();
  // Créer l'overlay de détection au démarrage (mais cachée jusqu'à ce qu'une classe soit détectée)
  // createDetectionOverlay(); // On la crée seulement quand une classe est détectée

  // Attendre que la fenêtre soit prête avant de vérifier les logs
  if (launcherWindow) {
    launcherWindow.webContents.once('did-finish-load', () => {
      // Essayer de démarrer le monitoring automatiquement
      // D'abord avec le chemin sauvegardé, sinon avec le chemin par défaut
      const savedLogsDir = Config.getLogPath();
      let logFilePath: string;
      
      if (savedLogsDir) {
        logFilePath = Config.getLogFilePath(savedLogsDir);
      } else {
        // Essayer le chemin par défaut
        logFilePath = Config.getDefaultLogPath();
      }
      
      // Vérifier si le fichier existe avant de démarrer le monitoring
      const fs = require('fs');
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

// Gestion IPC pour le launcher
ipcMain.handle('get-saved-characters', () => {
  return Config.getSavedCharacters();
});

ipcMain.handle('save-character', (_event, className: string, playerName: string) => {
  Config.saveCharacter(className, playerName);
});

ipcMain.handle('delete-character', (_event, className: string, playerName: string) => {
  Config.deleteCharacter(className, playerName);
});

ipcMain.handle('get-log-path', () => {
  // Retourner le dossier sauvegardé ou le dossier par défaut (pas le fichier complet)
  const savedDir = Config.getLogPath();
  if (savedDir) {
    return savedDir;
  }
  
  // Retourner le dossier parent du fichier par défaut
  const defaultLogFile = Config.getDefaultLogPath();
  const path = require('path');
  return path.dirname(defaultLogFile);
});

ipcMain.handle('select-log-path', async () => {
  const result = await dialog.showOpenDialog(launcherWindow!, {
    properties: ['openDirectory'],
    title: 'Sélectionnez le dossier de logs Wakfu'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const logsDir = result.filePaths[0];
    const logFilePath = Config.getLogFilePath(logsDir);
    
    // Sauvegarder le dossier (pas le fichier complet)
    Config.setLogPath(logsDir);
    
    // Démarrer le monitoring avec le fichier complet
    startLogMonitoring(logFilePath);
    
    // Retourner le dossier sélectionné pour l'affichage
    return logsDir;
  }

  return null;
});

ipcMain.handle('start-monitoring', (_event, logsDir?: string) => {
  // Si un dossier est fourni, l'utiliser, sinon utiliser le sauvegardé, sinon le défaut
  const dirToUse = logsDir || Config.getLogPath();
  const logFilePath = Config.getLogFilePath(dirToUse);
  
  // Si un dossier personnalisé est fourni, le sauvegarder
  if (logsDir) {
    Config.setLogPath(logsDir);
  }
  
  startLogMonitoring(logFilePath);
  return dirToUse || Config.getDefaultLogPath();
});

ipcMain.handle('stop-monitoring', () => {
  stopLogMonitoring();
});

// Fonction pour démarrer la surveillance des logs
function startLogMonitoring(logFilePath: string): void {
  if (logMonitor) {
    logMonitor.stop();
  }

  logMonitor = new LogMonitor(logFilePath, true);

  // Écouter les événements de détection de classes
  logMonitor.on('classDetected', (detection: ClassDetection) => {
    const key = `${detection.className}_${detection.playerName}`;
    detectedClasses.set(key, detection);
    
    // Envoyer à l'overlay de détection (si elle existe)
    if (detectionOverlay && !detectionOverlay.isDestroyed() && detectionOverlay.webContents) {
      try {
        detectionOverlay.webContents.send('class-detected', detection);
        if (!detectionOverlay.isVisible()) {
          detectionOverlay.show();
        }
      } catch (error) {
        console.error('Error sending class-detected to overlay:', error);
      }
    } else {
      createDetectionOverlay();
    }
    
    // Envoyer aussi au launcher (pour sauvegarde, etc.)
    if (launcherWindow && !launcherWindow.isDestroyed() && launcherWindow.webContents) {
      try {
        launcherWindow.webContents.send('class-detected', detection);
      } catch (error) {
        console.error('Error sending class-detected to launcher:', error);
      }
    }
  });

  // Écouter les événements de combat
  logMonitor.on('combatStarted', () => {
    launcherWindow?.webContents.send('combat-started');
  });

  logMonitor.on('combatEnded', () => {
    launcherWindow?.webContents.send('combat-ended');
  });

  // Écouter les nouvelles lignes de logs (pour les trackers)
  logMonitor.on('logLine', (line: string, parsed: any) => {
    WindowManager.getAllWindows().forEach((window, id) => {
      if (id.startsWith('tracker-')) {
        window.webContents.send('log-line', line, parsed);
      }
    });
  });
  
  logMonitor.start();
}

// Fonction pour arrêter la surveillance des logs
function stopLogMonitoring(): void {
  if (logMonitor) {
    logMonitor.stop();
    logMonitor = null;
  }
}

// Helper pour créer un tracker IOP
function createIopTracker(trackerId: string, htmlFile: string, width: number, height: number, rendererName?: string): BrowserWindow {
  if (WindowManager.hasWindow(trackerId)) {
    const existingWindow = WindowManager.getWindow(trackerId);
    existingWindow?.show();
    existingWindow?.focus();
    return existingWindow!;
  }

  const window = WindowManager.createOverlayWindow(trackerId, {
    width,
    height,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    frame: false
  });

  const htmlPath = path.join(__dirname, '..', 'renderer', 'trackers', 'iop', htmlFile);
  
  // Gérer les erreurs de chargement
  window.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[${rendererName || 'IOP TRACKER'}] Failed to load: ${errorCode} - ${errorDescription} - ${validatedURL}`);
    console.error(`[${rendererName || 'IOP TRACKER'}] Attempted to load: ${htmlPath}`);
  });

  window.loadFile(htmlPath)
    .then(() => {
      console.log(`[${rendererName || 'IOP TRACKER'}] Successfully loaded HTML: ${htmlPath}`);
      window.show();
      window.focus();
    })
    .catch((error) => {
      console.error(`[${rendererName || 'IOP TRACKER'}] Error loading HTML: ${error}`);
    });

  // Écouter les messages de console du renderer
  if (rendererName) {
    window.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[${rendererName} RENDERER ${level}]: ${message} (${sourceId}:${line})`);
    });
  }

  window.webContents.once('did-finish-load', () => {
    console.log(`[${rendererName || 'IOP TRACKER'}] Window content loaded for ${trackerId}`);
    window.show();
    window.focus();
    const bounds = window.getBounds();
    console.log(`[${rendererName || 'IOP TRACKER'}] Window bounds: ${JSON.stringify(bounds)}`);
    console.log(`[${rendererName || 'IOP TRACKER'}] Window visible: ${window.isVisible()}`);
  });

  window.on('closed', () => {
    WindowManager.closeWindow(trackerId);
  });

  // Afficher la fenêtre immédiatement
  window.show();
  console.log(`[${rendererName || 'IOP TRACKER'}] Created window ${trackerId} and called show()`);

  return window;
}

// Gestion IPC pour créer des trackers
ipcMain.handle('create-tracker', (_event, className: string, playerName: string) => {
  // Pour Iop, créer deux fenêtres séparées : boosts et combos
  if (className.toLowerCase() === 'iop') {
    const boostsTrackerId = `tracker-${className}-${playerName}-boosts`;
    const combosTrackerId = `tracker-${className}-${playerName}-combos`;

    const boostsWindow = createIopTracker(boostsTrackerId, 'boosts.html', 280, 200, 'IOP BOOSTS');
    
    // Positionner la fenêtre combos à côté de la fenêtre boosts
    const combosWindow = createIopTracker(combosTrackerId, 'combos.html', 240, 180, 'IOP COMBOS');
    if (boostsWindow && !boostsWindow.isDestroyed()) {
      const boostsBounds = boostsWindow.getBounds();
      combosWindow.setPosition(boostsBounds.x + boostsBounds.width + 10, boostsBounds.y);
    }

    // Démarrer la surveillance des logs si ce n'est pas déjà fait
    if (!logMonitor) {
      const logPath = Config.getLogPath() || Config.getDefaultLogPath();
      startLogMonitoring(Config.getLogFilePath(logPath));
    }

    return `${boostsTrackerId},${combosTrackerId}`;
  }

  // Pour les autres classes (Cra, Ouginak), créer une seule fenêtre
  const trackerId = `tracker-${className}-${playerName}`;

  // Vérifier si le tracker existe déjà
  if (WindowManager.hasWindow(trackerId)) {
    const existingWindow = WindowManager.getWindow(trackerId);
    existingWindow?.show();
    existingWindow?.focus();
    return trackerId;
  }

  // Créer une nouvelle fenêtre de tracker (transparente, sans frame)
  const trackerWindow = WindowManager.createOverlayWindow(trackerId, {
    width: 320,
    height: 200,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    frame: false
  });

  // Charger l'interface du tracker selon la classe
  const trackerHtmlPath = path.join(__dirname, '..', 'renderer', 'trackers', className.toLowerCase(), 'index.html');
  
  trackerWindow.loadFile(trackerHtmlPath)
    .then(() => {
      trackerWindow.show();
    })
    .catch((error) => {
      console.error(`Error loading tracker HTML: ${error}`);
    });

  // Écouter quand le contenu est chargé
  trackerWindow.webContents.once('did-finish-load', () => {
    trackerWindow.show();
    trackerWindow.focus();
  });

  // Écouter les erreurs de chargement
  trackerWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load tracker: ${errorCode} - ${errorDescription} - ${validatedURL}`);
  });

  // Écouter les erreurs de console du renderer
  trackerWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[TRACKER RENDERER ${level}]: ${message} (${sourceId}:${line})`);
  });

  trackerWindow.on('closed', () => {
    WindowManager.closeWindow(trackerId);
  });
  
  // Afficher la fenêtre immédiatement (même si le contenu n'est pas encore chargé)
  trackerWindow.show();

  // Démarrer la surveillance des logs si ce n'est pas déjà fait
  if (!logMonitor) {
    const logPath = Config.getLogPath() || Config.getDefaultLogPath();
    startLogMonitoring(Config.getLogFilePath(logPath));
  }

  return trackerId;
});

// Gestion IPC pour fermer un tracker
ipcMain.handle('close-tracker', (_event, trackerId: string) => {
  WindowManager.closeWindow(trackerId);
});

// Gestion IPC pour obtenir les statistiques de déduplication
ipcMain.handle('get-deduplication-stats', () => {
  return logMonitor?.getDeduplicationStats() || null;
});

// Exposer les classes détectées (même celles qui ont été détectées avant que le listener soit attaché)
ipcMain.handle('get-detected-classes', () => {
  return Array.from(detectedClasses.values());
});

// Export pour les tests
export { createLauncherWindow, startLogMonitoring, stopLogMonitoring };

