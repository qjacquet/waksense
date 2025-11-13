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
import { WindowSetup } from "./window-setup";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowConfig {
  width: number | "auto";
  height: number | "auto";
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
      resizable: false,
      fullscreenable: options.fullscreenable ?? false,
      skipTaskbar: true,
      minWidth: options.minWidth ?? 200,
      minHeight: options.minHeight ?? 150,
      maxWidth: options.minWidth ?? width,
      maxHeight: options.minHeight ?? height,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "preload.js"),
        ...options.webPreferences,
      },
    };

    const window = new BrowserWindow(defaults);

    window.on("moved", () => {
      if (!window.isDestroyed()) {
        const bounds = window.getBounds();
        Config.saveOverlayPosition(id, bounds.x, bounds.y, bounds.width, bounds.height);
      }
    });

    window.on("resized", () => {
      if (!window.isDestroyed()) {
        const bounds = window.getBounds();
        Config.saveOverlayPosition(id, bounds.x, bounds.y, bounds.width, bounds.height);
      }
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

    WindowSetup.setupErrorHandlers(window, htmlPath, "DEBUG");
    WindowSetup.setupConsoleLogging(window, "DEBUG");
    WindowSetup.setupLifecycle(window, "debug", (id) => this.closeWindow(id));

    window
      .loadFile(htmlPath)
      .then(() => {
        if (!window.isDestroyed()) {
          window.show();
          window.focus();
        }
      })
      .catch((error) => {
        console.error("[DEBUG] Error loading HTML:", error);
      });

    this.windows.set("debug", window);

    return window;
  }

  /**
   * Mesure le contenu de la fenêtre et ajuste sa taille automatiquement
   */
  private static async measureAndResizeWindow(
    window: BrowserWindow,
    trackerId: string,
    config: WindowConfig
  ): Promise<void> {
    if (config.width !== "auto" && config.height !== "auto") {
      // Pas besoin de mesurer si les deux dimensions sont fixes
      return;
    }

    try {
      // Attendre que le contenu soit complètement chargé et rendu
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await window.webContents.executeJavaScript(`
        (function() {
          const body = document.body;
          const html = document.documentElement;
          
          // Obtenir les dimensions du contenu réel
          const contentWidth = Math.max(
            body.scrollWidth,
            body.offsetWidth,
            html.clientWidth,
            html.scrollWidth,
            html.offsetWidth
          );
          const contentHeight = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          );
          
          // Vérifier les styles CSS fixes sur html et body
          const htmlStyle = window.getComputedStyle(html);
          const bodyStyle = window.getComputedStyle(body);
          
          let finalWidth = contentWidth;
          let finalHeight = contentHeight;
          
          // Si le CSS définit une taille fixe sur html ou body, l'utiliser
          const htmlWidth = htmlStyle.width;
          const htmlHeight = htmlStyle.height;
          const bodyWidth = bodyStyle.width;
          const bodyHeight = bodyStyle.height;
          
          if (htmlWidth && htmlWidth !== 'auto' && !htmlWidth.includes('%')) {
            finalWidth = Math.max(finalWidth, parseFloat(htmlWidth));
          }
          if (htmlHeight && htmlHeight !== 'auto' && !htmlHeight.includes('%')) {
            finalHeight = Math.max(finalHeight, parseFloat(htmlHeight));
          }
          
          if (bodyWidth && bodyWidth !== 'auto' && !bodyWidth.includes('%')) {
            finalWidth = Math.max(finalWidth, parseFloat(bodyWidth));
          }
          if (bodyHeight && bodyHeight !== 'auto' && !bodyHeight.includes('%')) {
            finalHeight = Math.max(finalHeight, parseFloat(bodyHeight));
          }
          
          // Chercher aussi dans le conteneur principal (jauge-overlay)
          const overlay = document.querySelector('.jauge-overlay');
          if (overlay) {
            const overlayRect = overlay.getBoundingClientRect();
            const overlayStyle = window.getComputedStyle(overlay);
            
            // Si l'overlay a une taille définie, l'utiliser
            const overlayWidth = overlayStyle.width;
            const overlayHeight = overlayStyle.height;
            
            if (overlayWidth && overlayWidth !== 'auto' && !overlayWidth.includes('%')) {
              finalWidth = Math.max(finalWidth, parseFloat(overlayWidth));
            }
            if (overlayHeight && overlayHeight !== 'auto' && !overlayHeight.includes('%')) {
              finalHeight = Math.max(finalHeight, parseFloat(overlayHeight));
            }
            
            // Sinon utiliser getBoundingClientRect
            if (overlayRect.width > 0) {
              finalWidth = Math.max(finalWidth, overlayRect.width);
            }
            if (overlayRect.height > 0) {
              finalHeight = Math.max(finalHeight, overlayRect.height);
            }
          }
          
          // Chercher le plus grand élément SVG ou image
          const svg = document.querySelector('svg');
          if (svg) {
            const svgRect = svg.getBoundingClientRect();
            const svgWidth = svg.width?.baseVal?.value || svgRect.width;
            const svgHeight = svg.height?.baseVal?.value || svgRect.height;
            
            if (svgWidth > 0) {
              finalWidth = Math.max(finalWidth, svgWidth);
            }
            if (svgHeight > 0) {
              finalHeight = Math.max(finalHeight, svgHeight);
            }
          }
          
          return {
            width: Math.ceil(finalWidth),
            height: Math.ceil(finalHeight)
          };
        })()
      `);

      const newWidth = config.width === "auto" ? result.width : config.width;
      const newHeight = config.height === "auto" ? result.height : config.height;

      if (!window.isDestroyed()) {
        window.setSize(newWidth, newHeight);
        // Sauvegarder la nouvelle taille
        const bounds = window.getBounds();
        Config.saveOverlayPosition(trackerId, bounds.x, bounds.y, bounds.width, bounds.height);
      }
    } catch (error) {
      console.error(
        `[${config.rendererName || "TRACKER"}] Error measuring content:`,
        error
      );
    }
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

    // Utiliser des dimensions par défaut si "auto" est spécifié
    const initialWidth = config.width === "auto" ? 400 : config.width;
    const initialHeight = config.height === "auto" ? 300 : config.height;

    const window = this.createOverlayWindow(trackerId, {
      width: initialWidth,
      height: initialHeight,
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

    WindowSetup.setupErrorHandlers(window, htmlPath, config.rendererName);
    WindowSetup.setupConsoleLogging(window, config.rendererName);
    WindowSetup.setupLifecycle(window, trackerId, (id) => this.closeWindow(id));

    window
      .loadFile(htmlPath)
      .then(() => {
        // Mesurer et ajuster la taille si nécessaire
        if (config.width === "auto" || config.height === "auto") {
          window.webContents.once("did-finish-load", () => {
            this.measureAndResizeWindow(window, trackerId, config);
          });
          // Aussi essayer après un court délai pour s'assurer que le CSS est appliqué
          setTimeout(() => {
            this.measureAndResizeWindow(window, trackerId, config);
          }, 200);
        }
        // NE PLUS afficher automatiquement - l'appelant décidera quand afficher
        // window.show();
        // window.focus();
      })
      .catch((error) => {
        console.error(
          `[${config.rendererName || "TRACKER"}] Error loading HTML: ${error}`
        );
      });

    // NE PLUS afficher automatiquement - l'appelant décidera quand afficher
    // window.show();
    return window;
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

    if (window.isDestroyed()) {
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
    if (!window) {
      // La fenêtre n'existe pas dans la Map, rien à faire
      return;
    }

    // Vérifier si la fenêtre est déjà détruite (cas où l'utilisateur a fermé manuellement)
    if (window.isDestroyed()) {
      // La fenêtre est déjà détruite, juste la supprimer de la Map
      this.windows.delete(id);
      return;
    }

    // Supprimer la fenêtre de la Map avant de la fermer
    // L'événement "closed" sera géré par setupLifecycle qui ne fera rien
    // car la fenêtre ne sera plus dans la Map
    this.windows.delete(id);

    try {
      window.close();
    } catch (error) {
      // Ignorer les erreurs si la fenêtre est déjà en cours de fermeture
      console.warn(`[WINDOW MANAGER] Error closing window ${id}:`, error);
    }
  }

  /**
   * Ferme toutes les fenêtres
   */
  static closeAll(): void {
    for (const [id, window] of this.windows) {
      if (!window.isDestroyed()) {
        window.close();
      }
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
