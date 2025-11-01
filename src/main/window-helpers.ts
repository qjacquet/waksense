import { BrowserWindow, WebContents } from 'electron';
import { WindowManager } from './window-manager';
import * as path from 'path';

interface WindowConfig {
  width: number;
  height: number;
  resizable?: boolean;
  rendererName?: string;
}

/**
 * Helper pour créer et configurer une fenêtre tracker
 */
export function createTrackerWindow(
  trackerId: string,
  htmlFile: string,
  className: string,
  config: WindowConfig
): BrowserWindow {
  if (WindowManager.hasWindow(trackerId)) {
    return WindowManager.getWindow(trackerId)!;
  }

  const window = WindowManager.createOverlayWindow(trackerId, {
    width: config.width,
    height: config.height,
    transparent: true,
    alwaysOnTop: true,
    resizable: config.resizable ?? false,
    frame: false
  });

  const htmlPath = path.join(__dirname, '..', 'renderer', 'trackers', className.toLowerCase(), htmlFile);
  
  setupWindowErrorHandlers(window, htmlPath, config.rendererName);
  setupWindowConsoleLogging(window, config.rendererName);
  setupWindowLifecycle(window, trackerId);

  window.loadFile(htmlPath)
    .then(() => {
      window.show();
      window.focus();
    })
    .catch((error) => {
      console.error(`[${config.rendererName || 'TRACKER'}] Error loading HTML: ${error}`);
    });

  window.show();
  return window;
}

/**
 * Configure les handlers d'erreur pour une fenêtre
 */
function setupWindowErrorHandlers(window: BrowserWindow, htmlPath: string, rendererName?: string): void {
  window.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[${rendererName || 'TRACKER'}] Failed to load: ${errorCode} - ${errorDescription} - ${validatedURL}`);
    console.error(`[${rendererName || 'TRACKER'}] Attempted to load: ${htmlPath}`);
  });
}

/**
 * Configure le logging console pour une fenêtre
 */
function setupWindowConsoleLogging(window: BrowserWindow, rendererName?: string): void {
  if (rendererName) {
    window.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[${rendererName} RENDERER ${level}]: ${message} (${sourceId}:${line})`);
    });
  }

  window.webContents.once('did-finish-load', () => {
    window.show();
    window.focus();
  });
}

/**
 * Configure le cycle de vie d'une fenêtre
 */
function setupWindowLifecycle(window: BrowserWindow, trackerId: string): void {
  window.on('closed', () => {
    WindowManager.closeWindow(trackerId);
  });
}

/**
 * Envoie un message de manière sécurisée à une fenêtre
 */
export function safeSendToWindow(window: BrowserWindow | null, channel: string, ...args: any[]): boolean {
  if (!window || window.isDestroyed() || !window.webContents) {
    return false;
  }

  try {
    window.webContents.send(channel, ...args);
    return true;
  } catch (error) {
    console.error(`Error sending ${channel} to window:`, error);
    return false;
  }
}

/**
 * Toggle la visibilité d'une fenêtre
 */
export function toggleWindow(window: BrowserWindow | undefined): { isVisible: boolean; result: string } {
  if (!window) {
    return { isVisible: false, result: 'false' };
  }

  if (window.isVisible()) {
    window.hide();
    return { isVisible: false, result: 'false' };
  } else {
    window.show();
    window.focus();
    return { isVisible: true, result: 'true' };
  }
}

