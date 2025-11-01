/**
 * Cra Tracker - Suivi des ressources Cra en temps réel
 */

class CraTracker {
  private precision: number = 0;

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
    // Parser les lignes pour détecter les changements de Précision
    if (line.includes('Précision')) {
      this.parsePrecision(line);
    }
  }

  private parsePrecision(line: string): void {
    const match = line.match(/Précision[:\s]*\(?\+(\d+)/i);
    if (match) {
      this.precision += parseInt(match[1], 10);
      this.updateUI();
    }
  }

  private updateUI(): void {
    const fill = document.getElementById('precision-fill');
    const value = document.getElementById('precision-value');

    if (fill) {
      const percentage = Math.min((this.precision / 300) * 100, 100);
      fill.style.width = `${percentage}%`;
    }

    if (value) {
      value.textContent = this.precision.toString();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CraTracker();
});

