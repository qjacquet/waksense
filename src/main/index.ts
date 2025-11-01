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

  logMonitor.on('combatStarted', () => {
    WindowManager.safeSendToWindow(launcherWindow, 'combat-started');
  });

  logMonitor.on('combatEnded', () => {
    WindowManager.safeSendToWindow(launcherWindow, 'combat-ended');
  });

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
}

export { createLauncherWindow, startLogMonitoring, stopLogMonitoring };

