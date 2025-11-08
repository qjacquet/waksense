/**
 * Window Watcher - Surveille la fenêtre active du jeu Wakfu pour détecter le tour du personnage
 */

import activeWin from "active-win";
import { Config } from "./config";
import { WindowManager } from "../windows/window-manager";

export class WindowWatcher {
  private intervalId: NodeJS.Timeout | null = null;
  private lastWindowTitle: string | null = null;
  private checkInterval: number = 500;
  private isTurnActive: boolean = false;
  private lastDetectedCharacter: { playerName: string; className: string } | null = null;
  private onCharacterChangedCallback: ((character: { playerName: string; className: string } | null) => void) | null = null;
  private detectedCharactersInCombat: Map<string, { className: string; playerName: string }> = new Map();

  /**
   * Démarre la surveillance de la fenêtre active
   */
  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.checkActiveWindow();
    }, this.checkInterval);

    this.checkActiveWindow();
  }

  /**
   * Arrête la surveillance
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.lastWindowTitle = null;
    this.isTurnActive = false;
  }

  setOnCharacterChanged(callback: (character: { playerName: string; className: string } | null) => void): void {
    this.onCharacterChangedCallback = callback;
  }

  setDetectedCharacters(characters: Map<string, { className: string; playerName: string }>): void {
    this.detectedCharactersInCombat = characters;
  }

  setTurnActive(isActive: boolean): void {
    this.isTurnActive = isActive;
  }

  async getActiveCharacter(): Promise<{ playerName: string; className: string } | null> {
    try {
      const window = await activeWin();
      
      if (!window) {
        return null;
      }

      const title = window.title || "";
      const owner = window.owner?.name || "";
      
      const isWakfuWindow = 
        title.toLowerCase().includes("wakfu") || 
        owner.toLowerCase().includes("wakfu");

      if (!isWakfuWindow) {
        return null;
      }

      return this.extractCharacterFromTitle(title);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extrait le nom du personnage et la classe depuis le titre de la fenêtre
   * Utilise d'abord les personnages détectés en combat, puis ceux sauvegardés
   */
  private extractCharacterFromTitle(title: string): { playerName: string; className: string } | null {
    const titleLower = title.toLowerCase();
    
    for (const [key, detection] of this.detectedCharactersInCombat.entries()) {
      const playerNameLower = detection.playerName.toLowerCase();
      
      if (titleLower.includes(playerNameLower)) {
        Config.saveCharacter(detection.className, detection.playerName);
        return { playerName: detection.playerName, className: detection.className };
      }
    }

    const savedCharacters = Config.getSavedCharacters();
    let activePlayerName: string | null = null;
    let activeClassName: string | null = null;

    for (const [className, playerNames] of Object.entries(savedCharacters)) {
      for (const playerName of playerNames) {
        const playerNameLower = playerName.toLowerCase();
        
        if (titleLower.includes(playerNameLower)) {
          activePlayerName = playerName;
          activeClassName = className;
          break;
        }
      }
      if (activePlayerName) {
        break;
      }
    }

    if (activePlayerName && activeClassName) {
      return { playerName: activePlayerName, className: activeClassName };
    }

    return null;
  }

  /**
   * Vérifie la fenêtre active et détecte les changements de personnage
   */
  private async checkActiveWindow(): Promise<void> {
    try {
      const window = await activeWin();
      
      if (!window) {
        return;
      }

      const title = window.title || "";
      const owner = window.owner?.name || "";
      
      const isWakfuWindow = 
        title.toLowerCase().includes("wakfu") || 
        owner.toLowerCase().includes("wakfu");

      if (!isWakfuWindow) {
        return;
      }

      const currentCharacter = this.extractCharacterFromTitle(title);
      
      if (currentCharacter) {
        const hasChanged = 
          !this.lastDetectedCharacter ||
          this.lastDetectedCharacter.playerName !== currentCharacter.playerName ||
          this.lastDetectedCharacter.className !== currentCharacter.className;
        
        if (hasChanged) {
          this.lastDetectedCharacter = currentCharacter;
          
          if (this.onCharacterChangedCallback) {
            this.onCharacterChangedCallback(currentCharacter);
          }
        }
      } else {
        if (this.lastDetectedCharacter) {
          this.lastDetectedCharacter = null;
          
          if (this.onCharacterChangedCallback) {
            this.onCharacterChangedCallback(null);
          }
        } else {
          this.lastDetectedCharacter = null;
        }
      }
    } catch (error) {
      // Ignorer les erreurs
    }
  }
}

