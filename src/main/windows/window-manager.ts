/**
 * Window Manager - Gestion complète des fenêtres Electron
 */

import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  screen,
} from "electron";
import * as path from "path";
import { Config } from "../core/config";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowConfig {
  width: number;
  height: number;
  resizable?: boolean;
  rendererName?: string;
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
      webPreferences?: BrowserWindowConstructorOptions["webPreferences"];
    } = {}
  ): BrowserWindow {
    const savedPos = Config.getOverlayPosition(id);
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workAreaSize;

    // Utiliser les dimensions sauvegardées si disponibles, sinon les options, sinon les valeurs par défaut
    const width = savedPos?.width ?? options.width ?? 400;
    const height = savedPos?.height ?? options.height ?? 300;

    const defaults: BrowserWindowConstructorOptions = {
      width,
      height,
      x: savedPos?.x ?? options.x ?? screenWidth - width,
      y:
        savedPos?.y ??
        options.y ??
        Math.floor((screenHeight - height) / 2),
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
        preload: path.join(__dirname, "..", "preload.js"),
        ...options.webPreferences,
      },
    };

    const window = new BrowserWindow(defaults);

    window.on("moved", () => {
      const bounds = window.getBounds();
      Config.saveOverlayPosition(id, bounds.x, bounds.y, bounds.width, bounds.height);
    });

    window.on("resized", () => {
      const bounds = window.getBounds();
      Config.saveOverlayPosition(id, bounds.x, bounds.y, bounds.width, bounds.height);
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
      title: "Waksense",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "preload.js"),
      },
      icon: path.join(__dirname, "..", "..", "..", "Waksense.ico"),
    });

    this.windows.set("launcher", window);

    return window;
  }

  /**
   * Crée la fenêtre de debug pour prévisualiser les trackers
   */
  static createDebugWindow(): BrowserWindow {
    // Si la fenêtre existe déjà, la réafficher
    if (this.hasWindow("debug")) {
      const existingWindow = this.getWindow("debug");
      if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.show();
        existingWindow.focus();
        return existingWindow;
      }
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workAreaSize;

    const window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      x: Math.floor((screenWidth - 1200) / 2),
      y: Math.floor((screenHeight - 800) / 2),
      frame: true,
      transparent: false,
      alwaysOnTop: false,
      title: "Waksense - Mode Debug",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "preload.js"),
      },
      icon: path.join(__dirname, "..", "..", "..", "Waksense.ico"),
    });

    const htmlPath = path.join(
      __dirname,
      "..",
      "..",
      "renderer",
      "core",
      "debug",
      "index.html"
    );

    this.setupWindowErrorHandlers(window, htmlPath, "DEBUG");
    this.setupWindowConsoleLogging(window, "DEBUG");
    this.setupWindowLifecycle(window, "debug");

    window
      .loadFile(htmlPath)
      .then(() => {
        window.show();
        window.focus();
      })
      .catch((error) => {
        console.error("[DEBUG] Error loading HTML:", error);
      });

    this.windows.set("debug", window);

    return window;
  }

  /**
   * Crée et configure une fenêtre tracker
   */
  static createTrackerWindow(
    trackerId: string,
    htmlFile: string,
    className: string,
    config: WindowConfig
  ): BrowserWindow {
    if (this.hasWindow(trackerId)) {
      return this.getWindow(trackerId)!;
    }

    const window = this.createOverlayWindow(trackerId, {
      width: config.width,
      height: config.height,
      transparent: true,
      alwaysOnTop: true,
      resizable: config.resizable ?? false,
      frame: false,
    });

    const htmlPath = path.join(
      __dirname,
      "..",
      "..",
      "renderer",
      "trackers",
      className.toLowerCase(),
      htmlFile
    );

    this.setupWindowErrorHandlers(window, htmlPath, config.rendererName);
    this.setupWindowConsoleLogging(window, config.rendererName);
    this.setupWindowLifecycle(window, trackerId);

    window
      .loadFile(htmlPath)
      .then(() => {
        window.show();
        window.focus();
      })
      .catch((error) => {
        console.error(
          `[${config.rendererName || "TRACKER"}] Error loading HTML: ${error}`
        );
      });

    window.show();
    return window;
  }

  /**
   * Configure les handlers d'erreur pour une fenêtre
   */
  private static setupWindowErrorHandlers(
    window: BrowserWindow,
    htmlPath: string,
    rendererName?: string
  ): void {
    window.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL) => {
        console.error(
          `[${
            rendererName || "TRACKER"
          }] Failed to load: ${errorCode} - ${errorDescription} - ${validatedURL}`
        );
        console.error(
          `[${rendererName || "TRACKER"}] Attempted to load: ${htmlPath}`
        );
      }
    );
  }

  /**
   * Configure le logging console pour une fenêtre
   */
  private static setupWindowConsoleLogging(
    window: BrowserWindow,
    rendererName?: string
  ): void {
    const logPrefix = rendererName || "TRACKER";
    window.webContents.on(
      "console-message",
      (event, level, message, line, sourceId) => {
        console.log(
          `[${logPrefix} RENDERER ${level}]: ${message} (${sourceId}:${line})`
        );
      }
    );

    window.webContents.once("did-finish-load", () => {
      window.show();
      window.focus();
    });
  }

  /**
   * Configure le cycle de vie d'une fenêtre
   */
  private static setupWindowLifecycle(
    window: BrowserWindow,
    trackerId: string
  ): void {
    window.on("closed", () => {
      this.closeWindow(trackerId);
    });
  }

  /**
   * Envoie un message de manière sécurisée à une fenêtre
   */
  static safeSendToWindow(
    window: BrowserWindow | null,
    channel: string,
    ...args: any[]
  ): boolean {
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
  static toggleWindow(window: BrowserWindow | undefined): {
    isVisible: boolean;
    result: string;
  } {
    if (!window) {
      return { isVisible: false, result: "false" };
    }

    if (window.isVisible()) {
      window.hide();
      return { isVisible: false, result: "false" };
    } else {
      window.show();
      window.focus();
      return { isVisible: true, result: "true" };
    }
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
