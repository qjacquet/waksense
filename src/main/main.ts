/**
 * Main Process - Point d'entrée principal de l'application Electron
 */

import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { WindowManager } from './window-manager';
import { Config } from './config';
import { LogMonitor, ClassDetection } from './log-monitor';
import { createTrackerWindow, safeSendToWindow, toggleWindow } from './window-helpers';

let launcherWindow: BrowserWindow | null = null;
let detectionOverlay: BrowserWindow | null = null;
let logMonitor: LogMonitor | null = null;

const detectedClasses: Map<string, ClassDetection> = new Map();

function ensureLogMonitoring(): void {
  if (!logMonitor) {
    const logPath = Config.getLogPath() || Config.getDefaultLogPath();
    startLogMonitoring(Config.getLogFilePath(logPath));
  }
}

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

  detectionOverlay.loadFile(path.join(__dirname, '..', 'renderer', 'detection-overlay', 'index.html'));

  detectionOverlay.webContents.once('did-finish-load', () => {
    if (!detectionOverlay || detectionOverlay.isDestroyed()) {
      return;
    }
    
    detectionOverlay.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[OVERLAY RENDERER ${level}]: ${message} (${sourceId}:${line})`);
    });
    
    const alreadyDetected = Array.from(detectedClasses.values());
    for (const detection of alreadyDetected) {
      safeSendToWindow(detectionOverlay, 'class-detected', detection);
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

  launcherWindow.loadFile(path.join(__dirname, '..', 'renderer', 'launcher', 'index.html'));

  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });
}

app.whenReady().then(() => {
  createLauncherWindow();

  if (launcherWindow) {
    launcherWindow.webContents.once('did-finish-load', () => {
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
  const savedDir = Config.getLogPath();
  if (savedDir) {
    return savedDir;
  }
  
  const defaultLogFile = Config.getDefaultLogPath();
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
    
    Config.setLogPath(logsDir);
    startLogMonitoring(logFilePath);
    
    return logsDir;
  }

  return null;
});

ipcMain.handle('start-monitoring', (_event, logsDir?: string) => {
  const dirToUse = logsDir || Config.getLogPath();
  const logFilePath = Config.getLogFilePath(dirToUse);
  
  if (logsDir) {
    Config.setLogPath(logsDir);
  }
  
  startLogMonitoring(logFilePath);
  return dirToUse || Config.getDefaultLogPath();
});

ipcMain.handle('stop-monitoring', () => {
  stopLogMonitoring();
});

function startLogMonitoring(logFilePath: string): void {
  if (logMonitor) {
    logMonitor.stop();
  }

  logMonitor = new LogMonitor(logFilePath, true);

  logMonitor.on('classDetected', (detection: ClassDetection) => {
    const key = `${detection.className}_${detection.playerName}`;
    detectedClasses.set(key, detection);
    
    if (!safeSendToWindow(detectionOverlay, 'class-detected', detection)) {
      createDetectionOverlay();
    } else if (detectionOverlay && !detectionOverlay.isVisible()) {
      detectionOverlay.show();
    }
    
    safeSendToWindow(launcherWindow, 'class-detected', detection);
  });

  logMonitor.on('combatStarted', () => {
    safeSendToWindow(launcherWindow, 'combat-started');
  });

  logMonitor.on('combatEnded', () => {
    safeSendToWindow(launcherWindow, 'combat-ended');
  });

  logMonitor.on('logLine', (line: string, parsed: any) => {
    WindowManager.getAllWindows().forEach((window, id) => {
      if (id.startsWith('tracker-')) {
        safeSendToWindow(window, 'log-line', line, parsed);
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
}

function createIopTracker(trackerId: string, htmlFile: string, width: number, height: number, rendererName?: string): BrowserWindow {
  return createTrackerWindow(trackerId, htmlFile, 'iop', {
    width,
    height,
    resizable: true,
    rendererName
  });
}

ipcMain.handle('create-tracker', (_event, className: string, playerName: string) => {
  if (className.toLowerCase() === 'iop') {
    const boostsTrackerId = `tracker-${className}-${playerName}-boosts`;
    const combosTrackerId = `tracker-${className}-${playerName}-combos`;

    const boostsExists = WindowManager.hasWindow(boostsTrackerId);
    const combosExists = WindowManager.hasWindow(combosTrackerId);
    
    if (combosExists) {
      const boostsWindow = boostsExists ? WindowManager.getWindow(boostsTrackerId) : undefined;
      const combosWindow = WindowManager.getWindow(combosTrackerId);
      const isCurrentlyVisible = combosWindow?.isVisible() || (boostsWindow?.isVisible() ?? false);
      
      if (isCurrentlyVisible) {
        boostsWindow?.hide();
        combosWindow?.hide();
      } else {
        boostsWindow?.show();
        boostsWindow?.focus();
        combosWindow?.show();
        combosWindow?.focus();
      }
      
      return `${boostsTrackerId},${combosTrackerId}:${!isCurrentlyVisible}`;
    }
    
    let boostsWindow: BrowserWindow | undefined;
    let combosWindow: BrowserWindow | undefined;
    
    if (boostsExists) {
      boostsWindow = WindowManager.getWindow(boostsTrackerId);
      combosWindow = createIopTracker(combosTrackerId, 'combos.html', 240, 180, 'IOP COMBOS');
      if (boostsWindow?.isVisible()) {
        combosWindow?.show();
      }
    } else if (combosExists) {
      combosWindow = WindowManager.getWindow(combosTrackerId);
    } else {
      combosWindow = createIopTracker(combosTrackerId, 'combos.html', 240, 180, 'IOP COMBOS');
    }
    
    if (boostsWindow && combosWindow && !boostsWindow.isDestroyed() && !combosWindow.isDestroyed()) {
      const boostsBounds = boostsWindow.getBounds();
      combosWindow.setPosition(boostsBounds.x + boostsBounds.width + 10, boostsBounds.y);
    }

    ensureLogMonitoring();

    const isVisible = combosWindow && !combosWindow.isDestroyed() && combosWindow.isVisible() || 
                      (boostsWindow && !boostsWindow.isDestroyed() && boostsWindow.isVisible());
    return `${boostsTrackerId},${combosTrackerId}:${isVisible}`;
  }

  const trackerId = `tracker-${className}-${playerName}`;

  if (WindowManager.hasWindow(trackerId)) {
    const existingWindow = WindowManager.getWindow(trackerId);
    const { result } = toggleWindow(existingWindow);
    return `${trackerId}:${result}`;
  }

  createTrackerWindow(trackerId, 'index.html', className, {
    width: 320,
    height: 200,
    resizable: false
  });

  ensureLogMonitoring();
  return `${trackerId}:true`;
});

ipcMain.handle('close-tracker', (_event, trackerId: string) => {
  WindowManager.closeWindow(trackerId);
});

ipcMain.handle('get-deduplication-stats', () => {
  return logMonitor?.getDeduplicationStats() || null;
});

ipcMain.handle('get-detected-classes', () => {
  return Array.from(detectedClasses.values());
});

export { createLauncherWindow, startLogMonitoring, stopLogMonitoring };

