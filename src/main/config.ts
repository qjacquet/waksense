/**
 * Configuration et gestion des chemins
 */

import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import Store from 'electron-store';

export interface AppSettings {
  logPath?: string;
  savedCharacters?: {
    [className: string]: string[];
  };
  overlayPositions?: {
    [key: string]: { x: number; y: number };
  };
}

export class Config {
  private static store: Store<AppSettings> = new Store<AppSettings>({
    name: 'config',
    defaults: {
      savedCharacters: {},
      overlayPositions: {}
    }
  });

  /**
   * Obtient le chemin par défaut du fichier de logs Wakfu
   */
  static getDefaultLogPath(): string {
    const userProfile = os.homedir();
    return path.join(
      userProfile,
      'AppData',
      'Roaming',
      'zaap',
      'gamesLogs',
      'wakfu',
      'logs',
      'wakfu_chat.log'
    );
  }

  /**
   * Obtient le chemin du fichier de logs
   */
  static getLogFilePath(logsDir?: string): string {
    if (!logsDir) {
      return this.getDefaultLogPath();
    }
    return path.join(logsDir, 'wakfu_chat.log');
  }

  /**
   * Obtient le chemin de sauvegarde de l'application
   */
  static getUserDataPath(): string {
    return app.getPath('userData');
  }

  /**
   * Sauvegarde le chemin des logs
   */
  static setLogPath(logPath: string): void {
    this.store.set('logPath', logPath);
  }

  /**
   * Obtient le chemin des logs sauvegardé
   */
  static getLogPath(): string | undefined {
    return this.store.get('logPath');
  }

  /**
   * Sauvegarde un personnage
   */
  static saveCharacter(className: string, playerName: string): void {
    const saved = this.store.get('savedCharacters', {});
    if (!saved[className]) {
      saved[className] = [];
    }
    if (!saved[className].includes(playerName)) {
      saved[className].push(playerName);
      this.store.set('savedCharacters', saved);
    }
  }

  /**
   * Supprime un personnage
   */
  static deleteCharacter(className: string, playerName: string): void {
    const saved = this.store.get('savedCharacters', {});
    if (saved[className]) {
      saved[className] = saved[className].filter(name => name !== playerName);
      if (saved[className].length === 0) {
        delete saved[className];
      }
      this.store.set('savedCharacters', saved);
    }
  }

  /**
   * Obtient tous les personnages sauvegardés
   */
  static getSavedCharacters(): { [className: string]: string[] } {
    return this.store.get('savedCharacters', {});
  }

  /**
   * Sauvegarde la position d'un overlay
   */
  static saveOverlayPosition(key: string, x: number, y: number): void {
    const positions = this.store.get('overlayPositions', {});
    positions[key] = { x, y };
    this.store.set('overlayPositions', positions);
  }

  /**
   * Obtient la position d'un overlay
   */
  static getOverlayPosition(key: string): { x: number; y: number } | undefined {
    const positions = this.store.get('overlayPositions', {});
    return positions[key];
  }

  /**
   * Obtient tous les paramètres
   */
  static getAllSettings(): AppSettings {
    return this.store.store;
  }

  /**
   * Réinitialise tous les paramètres
   */
  static reset(): void {
    this.store.clear();
  }
}

