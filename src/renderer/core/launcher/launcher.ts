/**
 * Launcher UI - Interface principale du launcher
 */

class LauncherUI {
  constructor() {
    if (!window.electronAPI) {
      console.error('window.electronAPI is not available! Preload might not be loaded.');
      return;
    }
    
    this.startMonitoring();
  }

  private async startMonitoring(): Promise<void> {
    try {
      await window.electronAPI.startMonitoring();
    } catch (error) {
      console.error('Error starting monitoring:', error);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LauncherUI();
});

