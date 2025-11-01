/**
 * Launcher UI - Interface principale du launcher
 */

// ClassType est défini dans src/renderer/types.d.ts

interface ClassButton {
  className: ClassType;
  playerName: string;
  isActive: boolean;
  isSaved: boolean;
}

class LauncherUI {
  private classButtons: Map<string, ClassButton> = new Map();
  private savedCharacters: { [className: string]: string[] } = {};

  constructor() {
    if (!window.electronAPI) {
      console.error('window.electronAPI is not available! Preload might not be loaded.');
      alert('Erreur: electronAPI n\'est pas disponible. Vérifiez que le preload est chargé.');
      return;
    }
    
    if (!window.electronAPI.onClassDetected) {
      console.error('onClassDetected method not found!');
      console.error('Available methods:', Object.keys(window.electronAPI));
      return;
    }
    
    // Attacher les listeners EN PREMIER pour ne pas rater d'événements
    this.setupEventListeners();
    
    this.initializeUI();
    this.loadSavedCharacters();
    this.startMonitoring();
  }

  private initializeUI(): void {
    // Bouton de sélection du chemin
    const selectPathBtn = document.getElementById('select-path-btn');
    if (selectPathBtn) {
      selectPathBtn.addEventListener('click', () => this.selectLogPath());
    }

    // Charger le chemin actuel
    this.updateLogPath();
  }

  private async updateLogPath(): Promise<void> {
    try {
      const logPath = await window.electronAPI.getLogPath();
      const pathValue = document.getElementById('path-value');
      if (pathValue) {
        pathValue.textContent = logPath || 'Non configuré';
        pathValue.style.color = logPath ? '#4CAF50' : 'rgba(255, 255, 255, 0.5)';
      }
    } catch (error) {
      console.error('Error getting log path:', error);
    }
  }

  private async selectLogPath(): Promise<void> {
    try {
      const logsDir = await window.electronAPI.selectLogPath();
      if (logsDir) {
        // Le monitoring est déjà démarré dans le handler IPC
        this.updateLogPath();
        this.updateStatus('✅ Chemin des logs configuré - Surveillance démarrée...', 'success');
      }
    } catch (error) {
      console.error('Error selecting log path:', error);
      this.updateStatus('❌ Erreur lors de la sélection du chemin', 'error');
    }
  }

  private async loadSavedCharacters(): Promise<void> {
    try {
      this.savedCharacters = await window.electronAPI.getSavedCharacters();
      
      // Créer les boutons pour les personnages sauvegardés
      for (const [className, playerNames] of Object.entries(this.savedCharacters)) {
        for (const playerName of playerNames) {
          this.addClassButton(className as ClassType, playerName, true);
        }
      }

      if (Object.keys(this.savedCharacters).length > 0) {
        const total = Object.values(this.savedCharacters).flat().length;
        this.updateStatus(`Chargé ${total} personnage(s) sauvegardé(s)`, 'info');
      } else {
        this.updateStatus('Aucun personnage sauvegardé - Surveillance des nouvelles classes...', 'info');
      }
    } catch (error) {
      console.error('Error loading saved characters:', error);
    }
  }

  private setupEventListeners(): void {
    // Vérifier qu'ipcRenderer existe dans le preload (devrait être disponible via contextBridge)
    if (typeof window.electronAPI === 'undefined') {
      console.error('window.electronAPI is undefined! Preload might not be loaded.');
      alert('Erreur: window.electronAPI n\'est pas disponible. Vérifiez que le preload est chargé.');
      return;
    }
    
    try {
      // Écouter les détections de classes - ATTACHER LE LISTENER IMMÉDIATEMENT
      window.electronAPI.onClassDetected((detection: { className: string; playerName: string }) => {
        this.onClassDetected(detection.className as ClassType, detection.playerName);
      });
    } catch (error) {
      console.error('Error attaching event listeners:', error);
    }

    // Écouter les événements de combat
    window.electronAPI.onCombatStarted(() => {
      this.updateStatus('⚔️ Combat démarré - Surveillance des classes...', 'info');
    });

    window.electronAPI.onCombatEnded(() => {
      this.updateStatus('✅ Combat terminé - Classes détectées:', 'info');
    });

    // Écouter les événements de monitoring
    window.electronAPI.onMonitoringStarted(() => {
      this.updateStatus('✅ Surveillance des logs activée automatiquement', 'success');
    });

    window.electronAPI.onLogFileNotFound(() => {
      this.updateStatus('📁 Sélectionnez le chemin des logs Wakfu', 'info');
    });
  }

  private async startMonitoring(): Promise<void> {
    try {
      // Le monitoring devrait déjà être démarré automatiquement au démarrage
      // Si ce n'est pas le cas, on peut le démarrer manuellement
      // Mais normalement, le main process l'a déjà fait si le fichier existe
      const logPath = await window.electronAPI.getLogPath();
      
      // Essayer de démarrer le monitoring (il ne fera rien si déjà démarré)
      await window.electronAPI.startMonitoring();
      
      // IMPORTANT: Récupérer les classes déjà détectées (qui peuvent avoir été détectées avant que le listener soit attaché)
      const alreadyDetected = await window.electronAPI.getDetectedClasses();
      
      if (alreadyDetected && alreadyDetected.length > 0) {
        for (const detection of alreadyDetected) {
          this.onClassDetected(detection.className as ClassType, detection.playerName);
        }
      }
      
      // Le statut sera mis à jour par les événements de combat ou de détection
      // Pour l'instant, on affiche juste que la surveillance est prête
      this.updateStatus('📡 Surveillance des logs prête...', 'info');
    } catch (error) {
      console.error('Error starting monitoring:', error);
      this.updateStatus('📁 Sélectionnez le chemin des logs Wakfu', 'info');
    }
  }

  private onClassDetected(className: ClassType, playerName: string): void {
    const buttonKey = `${className}_${playerName}`;
    
    // Vérifier si le bouton existe déjà
    if (this.classButtons.has(buttonKey)) {
      return;
    }

    // Vérifier si le personnage est sauvegardé
    const isSaved = this.savedCharacters[className]?.includes(playerName) || false;

    // Ajouter le bouton
    this.addClassButton(className, playerName, isSaved);

    // Mettre à jour le statut
    if (isSaved) {
      this.updateStatus(`✅ Personnage sauvegardé détecté: ${className} (${playerName})`, 'success');
    } else {
      this.updateStatus(`🆕 Nouveau détecté: ${className} (${playerName})`, 'info');
    }
  }

  private addClassButton(className: ClassType, playerName: string, isSaved: boolean): void {
    const buttonKey = `${className}_${playerName}`;
    const columnId = `${className.toLowerCase()}-buttons`;
    const buttonsContainer = document.getElementById(columnId);

    if (!buttonsContainer) {
      console.error(`Container not found: ${columnId}`);
      return;
    }

    // Créer le bouton
    const classButton: ClassButton = {
      className,
      playerName,
      isActive: false,
      isSaved
    };

    this.classButtons.set(buttonKey, classButton);

    // Créer l'élément HTML
    const buttonRow = document.createElement('div');
    buttonRow.className = 'class-button-row';
    buttonRow.id = `button-${buttonKey}`;

    const button = document.createElement('button');
    button.className = 'class-button';
    button.textContent = playerName;
    button.addEventListener('click', () => this.launchTracker(className, playerName, buttonKey));

    buttonRow.appendChild(button);

    // Ajouter le bouton de suppression si sauvegardé
    if (isSaved) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = `Supprimer ${playerName}`;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteCharacter(className, playerName, buttonKey);
      });
      buttonRow.appendChild(deleteBtn);
    }

    buttonsContainer.appendChild(buttonRow);
  }

  private async launchTracker(className: ClassType, playerName: string, buttonKey: string): Promise<void> {
    try {
      const classButton = this.classButtons.get(buttonKey);
      if (!classButton) {
        return;
      }

      // Lancer le tracker
      const trackerId = await window.electronAPI.createTracker(className, playerName);

      // Marquer le bouton comme actif
      classButton.isActive = true;
      const buttonElement = document.querySelector(`#button-${buttonKey} .class-button`) as HTMLButtonElement;
      if (buttonElement) {
        buttonElement.classList.add('active');
      }
    } catch (error) {
      console.error('Error launching tracker:', error);
      this.updateStatus('❌ Erreur lors du lancement du tracker', 'error');
    }
  }

  private async deleteCharacter(className: ClassType, playerName: string, buttonKey: string): Promise<void> {
    const confirmed = confirm(
      `Êtes-vous sûr de vouloir supprimer ${playerName} (${className}) ?\n\n` +
      'Cela les retirera de votre liste de personnages sauvegardés.'
    );

    if (!confirmed) {
      return;
    }

    try {
      await window.electronAPI.deleteCharacter(className, playerName);

      // Retirer de la liste locale
      if (this.savedCharacters[className]) {
        this.savedCharacters[className] = this.savedCharacters[className].filter(name => name !== playerName);
        if (this.savedCharacters[className].length === 0) {
          delete this.savedCharacters[className];
        }
      }

      // Retirer le bouton de l'UI
      const buttonElement = document.getElementById(`button-${buttonKey}`);
      if (buttonElement) {
        buttonElement.remove();
      }

      this.classButtons.delete(buttonKey);

      this.updateStatus(`✅ Personnage ${playerName} supprimé`, 'success');
    } catch (error) {
      console.error('Error deleting character:', error);
      this.updateStatus('❌ Erreur lors de la suppression', 'error');
    }
  }

  private updateStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    const statusLabel = document.getElementById('status-label');
    if (!statusLabel) {
      return;
    }

    statusLabel.textContent = message;

    // Mettre à jour les styles selon le type
    statusLabel.className = 'status-label';
    switch (type) {
      case 'success':
        statusLabel.style.color = '#4CAF50';
        statusLabel.style.background = 'rgba(76, 175, 80, 0.2)';
        statusLabel.style.borderColor = 'rgba(76, 175, 80, 0.5)';
        break;
      case 'error':
        statusLabel.style.color = '#f44336';
        statusLabel.style.background = 'rgba(244, 67, 54, 0.2)';
        statusLabel.style.borderColor = 'rgba(244, 67, 54, 0.5)';
        break;
      default:
        statusLabel.style.color = '#2196F3';
        statusLabel.style.background = 'rgba(33, 150, 243, 0.1)';
        statusLabel.style.borderColor = 'rgba(33, 150, 243, 0.3)';
    }
  }
}

// Initialiser l'interface quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  new LauncherUI();
});

