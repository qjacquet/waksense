/**
 * Ouginak Tracker - Suivi des ressources Ouginak en temps réel
 */

class OuginakTracker {
  private rage: number = 0;

  constructor() {
    this.setupEventListeners();
    this.updateUI();
  }

  private setupEventListeners(): void {
    window.electronAPI.onLogLine((line: string, parsed: any) => {
      this.processLogLine(line, parsed);
    });
  }

  private processLogLine(line: string, parsed: any): void {
    // Parser les lignes pour détecter les changements de Rage
    if (line.includes('Rage') || line.includes('rage')) {
      this.parseRage(line);
    }
  }

  private parseRage(line: string): void {
    const match = line.match(/Rage[:\s]*(\d+)\/(\d+)/i);
    if (match) {
      this.rage = parseInt(match[1], 10);
      this.updateUI();
    }
  }

  private updateUI(): void {
    const fill = document.getElementById('rage-fill');
    const value = document.getElementById('rage-value');

    if (fill) {
      const percentage = (this.rage / 30) * 100;
      fill.style.width = `${percentage}%`;
    }

    if (value) {
      value.textContent = `${this.rage}/30`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OuginakTracker();
});

