/**
 * Window Manager - Gestion des fenêtres Electron
 */

import { BrowserWindow, screen, BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';
import { Config } from './config';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class WindowManager {
  private static windows: Map<string, BrowserWindow> = new Map();

  /**
   * Crée une fenêtre overlay transparente
   */
  static createOverlayWindow(
    id: string,
    options: {
      width?: number;
      height?: number;
      x?: number;
      y?: number;
      frame?: boolean;
      transparent?: boolean;
      alwaysOnTop?: boolean;
      resizable?: boolean;
      fullscreenable?: boolean;
      minWidth?: number;
      minHeight?: number;
      webPreferences?: BrowserWindowConstructorOptions['webPreferences'];
    } = {}
  ): BrowserWindow {
    // Charger la position sauvegardée si disponible
    const savedPos = Config.getOverlayPosition(id);
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const defaults: BrowserWindowConstructorOptions = {
      width: options.width || 400,
      height: options.height || 300,
      x: savedPos?.x ?? options.x ?? (screenWidth - (options.width || 400)),
      y: savedPos?.y ?? options.y ?? Math.floor((screenHeight - (options.height || 300)) / 2),
      frame: options.frame ?? false,
      transparent: options.transparent ?? true,
      alwaysOnTop: options.alwaysOnTop ?? true,
      resizable: options.resizable !== undefined ? options.resizable : true,
      fullscreenable: options.fullscreenable ?? false,
      skipTaskbar: true,
      minWidth: options.minWidth ?? 200,
      minHeight: options.minHeight ?? 150,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        ...options.webPreferences
      }
    };

    const window = new BrowserWindow(defaults);

    // Sauvegarder la position lors du déplacement
    window.on('moved', () => {
      const bounds = window.getBounds();
      Config.saveOverlayPosition(id, bounds.x, bounds.y);
    });

    // Sauvegarder la position lors du redimensionnement
    window.on('resized', () => {
      const bounds = window.getBounds();
      Config.saveOverlayPosition(id, bounds.x, bounds.y);
    });

    this.windows.set(id, window);

    return window;
  }

  /**
   * Crée la fenêtre principale du launcher
   */
  static createLauncherWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 450,
      height: 500,
      minWidth: 400,
      minHeight: 400,
      frame: true,
      transparent: false,
      alwaysOnTop: false,
      title: 'Waksense',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '..', '..', 'Waksense.ico')
    });

    this.windows.set('launcher', window);

    return window;
  }

  /**
   * Obtient une fenêtre par son ID
   */
  static getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  /**
   * Ferme une fenêtre
   */
  static closeWindow(id: string): void {
    const window = this.windows.get(id);
    if (window) {
      window.close();
      this.windows.delete(id);
    }
  }

  /**
   * Ferme toutes les fenêtres
   */
  static closeAll(): void {
    for (const [id, window] of this.windows) {
      window.close();
    }
    this.windows.clear();
  }

  /**
   * Vérifie si une fenêtre existe
   */
  static hasWindow(id: string): boolean {
    return this.windows.has(id);
  }

  /**
   * Obtient toutes les fenêtres
   */
  static getAllWindows(): Map<string, BrowserWindow> {
    return this.windows;
  }
}

