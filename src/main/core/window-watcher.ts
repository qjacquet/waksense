/**
 * Window Watcher - Surveille la fenêtre active du jeu Wakfu pour détecter le tour du personnage
 */

import activeWin from "active-win";
import { Config } from "./config";
import { WindowManager } from "../windows/window-manager";

export class WindowWatcher {
  private intervalId: NodeJS.Timeout | null = null;
  private lastWindowTitle: string | null = null;
  private checkInterval: number = 500; // Vérifier toutes les 500ms

  /**
   * Démarre la surveillance de la fenêtre active
   */
  start(): void {
    if (this.intervalId) {
      return; // Déjà démarré
    }

    this.intervalId = setInterval(() => {
      this.checkActiveWindow();
    }, this.checkInterval);

    // Vérifier immédiatement
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
  }

  /**
   * Vérifie la fenêtre active et extrait le nom du personnage
   */
  private async checkActiveWindow(): Promise<void> {
    try {
      const window = await activeWin();
      
      if (!window) {
        return;
      }

      // Vérifier si c'est une fenêtre Wakfu (peut contenir "Wakfu" dans le titre ou le nom de l'application)
      const title = window.title || "";
      const owner = window.owner?.name || "";
      
      // Chercher si le titre contient "Wakfu" ou si l'application est Wakfu
      const isWakfuWindow = 
        title.toLowerCase().includes("wakfu") || 
        owner.toLowerCase().includes("wakfu");

      if (!isWakfuWindow) {
        return;
      }

      // Si le titre a changé, vérifier s'il contient un nom de personnage
      if (title !== this.lastWindowTitle) {
        this.lastWindowTitle = title;
        this.processWindowTitle(title);
      }
    } catch (error) {
      // Ignorer les erreurs silencieusement (peut arriver si on n'a pas les permissions)
      // console.error("[WINDOW_WATCHER] Error checking active window:", error);
    }
  }

  /**
   * Traite le titre de la fenêtre pour extraire le nom du personnage
   */
  private processWindowTitle(title: string): void {
    // Obtenir tous les personnages sauvegardés
    const savedCharacters = Config.getSavedCharacters();
    const craCharacters = savedCharacters["Cra"] || savedCharacters["cra"] || [];

    if (craCharacters.length === 0) {
      return; // Aucun personnage CRA sauvegardé
    }

    // Chercher si le titre contient un nom de personnage CRA
    // Le titre peut avoir différents formats :
    // - "Wakfu - NomDuPersonnage"
    // - "NomDuPersonnage - Wakfu"
    // - "NomDuPersonnage"
    for (const playerName of craCharacters) {
      // Vérifier si le titre contient le nom du personnage
      // Utiliser une recherche insensible à la casse pour plus de robustesse
      const titleLower = title.toLowerCase();
      const playerNameLower = playerName.toLowerCase();
      
      if (titleLower.includes(playerNameLower)) {
        // Afficher la jauge pour ce personnage
        this.showCraJauge(playerName);
        break; // Un seul personnage à la fois
      }
    }
  }

  /**
   * Affiche la jauge CRA pour un personnage donné
   */
  private showCraJauge(playerName: string): void {
    const jaugeTrackerId = `tracker-Cra-${playerName}-jauge`;
    
    // Vérifier si la jauge existe déjà
    if (WindowManager.hasWindow(jaugeTrackerId)) {
      const jaugeWindow = WindowManager.getWindow(jaugeTrackerId);
      if (jaugeWindow && !jaugeWindow.isDestroyed()) {
        // S'assurer qu'elle est visible
        if (!jaugeWindow.isVisible()) {
          jaugeWindow.show();
          jaugeWindow.focus();
        }
      }
    } else {
      // Créer la jauge si elle n'existe pas
      const jaugeWindow = WindowManager.createTrackerWindow(
        jaugeTrackerId,
        "jauge.html",
        "cra",
        {
          width: 300,
          height: 350,
          resizable: true,
          rendererName: "CRA JAUGE",
        }
      );
      
      // S'assurer qu'elle est visible après le chargement
      if (jaugeWindow && !jaugeWindow.isDestroyed()) {
        jaugeWindow.webContents.once("did-finish-load", () => {
          if (jaugeWindow && !jaugeWindow.isDestroyed()) {
            jaugeWindow.show();
            jaugeWindow.focus();
          }
        });
        jaugeWindow.show();
        jaugeWindow.focus();
      }
    }
  }
}

