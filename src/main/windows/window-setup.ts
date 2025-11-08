/**
 * Window Setup - Configuration des fenêtres Electron
 */

import { BrowserWindow } from "electron";

export class WindowSetup {
  /**
   * Configure les handlers d'erreur pour une fenêtre
   */
  static setupErrorHandlers(
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
  static setupConsoleLogging(
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
  static setupLifecycle(
    window: BrowserWindow,
    trackerId: string,
    onClose: (id: string) => void
  ): void {
    window.on("closed", () => {
      onClose(trackerId);
    });
  }
}

