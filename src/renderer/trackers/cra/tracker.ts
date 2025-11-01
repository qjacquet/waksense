/**
 * Cra Tracker - Suivi des ressources Cra en temps réel
 */

import { setupTrackerEventListeners, updateProgressBar, updateStackIndicator, updateBooleanIndicator } from '../../core/ui-helpers.js';

class CraTracker {
  private affutage: number = 0;
  private precision: number = 0;
  private pointeAffuteeStacks: number = 0;
  private baliseAffuteeStacks: number = 0;
  private tirPrecisActive: boolean = false;
  private hasEspritAffute: boolean = false;
  private precisionMax: number = 300;
  private recentPrecisionGains: number[] = [];
  private maxRecentGains: number = 5;

  constructor() {
    this.setupEventListeners();
    this.updateUI();
  }

  private setupEventListeners(): void {
    if (!window.electronAPI) {
      return;
    }
    
    setupTrackerEventListeners(
      (line: string, parsed: any) => this.processLogLine(line, parsed),
      () => this.resetResources()
    );
  }

  private resetResources(): void {
    this.affutage = 0;
    this.precision = 0;
    this.pointeAffuteeStacks = 0;
    this.baliseAffuteeStacks = 0;
    this.tirPrecisActive = false;
    this.updateUI();
  }

  private processLogLine(line: string, parsed: any): void {
    // Parse Affûtage (peut être dans ou hors combat)
    this.parseAffutage(line);
    
    // Parse Précision (peut être dans ou hors combat)
    this.parsePrecision(line);
    
    // Les autres parsers nécessitent des lignes de combat
    if (!line.includes("[Information (combat)]")) {
      return;
    }
    
    // Parse Pointe affûtée consumption
    this.parsePointeAffutee(line);
    
    // Parse Balise affûtée consumption
    this.parseBaliseAffutee(line);
    
    // Parse Tir précis buff
    this.parseTirPrecis(line);
    
    // Parse Précision buff removal
    this.parsePrecisionBuffRemoval(line);
    
    // Parse spell consumption with Tir précis active
    this.parseSpellConsumption(line, parsed);
  }

  private parseAffutage(line: string): void {
    // Format: "Affûtage (+X Niv.)"
    const match = line.match(/Affûtage\s*\(\+(\d+)\s*Niv\.\)/i);
    if (match) {
      const newAffutage = parseInt(match[1], 10);
      
      // Handle Affûtage reaching 100+ - gain stacks and carry over excess
      if (newAffutage >= 100) {
        const stacksGained = Math.floor(newAffutage / 100);
        
        // Gain Pointe affûtée stacks (max 3)
        if (this.pointeAffuteeStacks < 3) {
          const stacksToAdd = Math.min(stacksGained, 3 - this.pointeAffuteeStacks);
          this.pointeAffuteeStacks += stacksToAdd;
        }
        
        // Gain Balise affûtée stacks (max 3)
        if (this.baliseAffuteeStacks < 3) {
          const stacksToAdd = Math.min(stacksGained, 3 - this.baliseAffuteeStacks);
          this.baliseAffuteeStacks += stacksToAdd;
        }
        
        // Keep remainder (ex: 150 → 1 stack, 50 remaining)
        this.affutage = newAffutage % 100;
      } else {
        this.affutage = newAffutage;
      }
      
      this.updateUI();
    }
  }

  private parsePrecision(line: string): void {
    // Format: "Précision (+X Niv.)"
    const precisionMatch = line.match(/Précision\s*\(\+(\d+)\s*Niv\.\)/i);
    if (precisionMatch) {
      const newPrecision = parseInt(precisionMatch[1], 10);
      this.precision = newPrecision;
      
      // Check for "Esprit affûté" talent (limits precision to 200)
      if (line.includes("Valeur maximale de Précision atteinte !") && this.precision > 200) {
        // Check if this was after a +300 gain (normal case - don't cap)
        if (!this.wasRecent300Gain()) {
          this.precision = 200;
          this.precisionMax = 200;
          this.hasEspritAffute = true;
        }
      } else {
        // If precision exceeds max, cap it
        if (this.precision > this.precisionMax) {
          this.precision = this.precisionMax;
        }
      }
      
      this.updateUI();
    }
    
    // Track precision gains for talent detection
    const gainMatch = line.match(/Précision.*?(\+?\d+)/i);
    if (gainMatch && line.includes('+')) {
      try {
        const precisionGain = parseInt(gainMatch[1], 10);
        this.storePrecisionGain(precisionGain);
        
        // If gained > 200 without cap message, talent might be removed
        if (precisionGain > 200 && !line.includes("Valeur maximale de Précision atteinte !")) {
          if (this.hasEspritAffute) {
            this.hasEspritAffute = false;
            this.precisionMax = 300;
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  private parsePointeAffutee(line: string): void {
    if (line.includes("Consomme Pointe affûtée")) {
      if (this.pointeAffuteeStacks > 0) {
        this.pointeAffuteeStacks--;
        this.updateUI();
      }
    }
  }

  private parseBaliseAffutee(line: string): void {
    // Balise affûtée is consumed when specific spells are cast
    if (line.includes("lance le sort")) {
      if (line.includes("Balise de destruction") || 
          line.includes("Balise d'alignement") || 
          line.includes("Balise de contact")) {
        if (this.baliseAffuteeStacks > 0) {
          this.baliseAffuteeStacks--;
          this.updateUI();
        }
      }
    }
  }

  private parseTirPrecis(line: string): void {
    // Parse Tir précis buff activation
    if (line.includes("Tir précis (Niv.")) {
      this.tirPrecisActive = true;
      this.updateUI();
    }
    // Parse Tir précis buff removal
    else if (line.includes("n'est plus sous l'emprise de 'Tir précis'")) {
      this.tirPrecisActive = false;
      this.updateUI();
    }
  }

  private parsePrecisionBuffRemoval(line: string): void {
    // Parse Précision buff removal - reset precision to 0
    if (line.includes("n'est plus sous l'emprise de 'Précision'")) {
      this.precision = 0;
      // Reset bar maximum back to 300 for normal operation
      this.precisionMax = 300;
      this.hasEspritAffute = false;
      this.updateUI();
    }
  }

  private parseSpellConsumption(line: string, parsed: any): void {
    // Parse spell consumption with Tir précis active
    if (this.tirPrecisActive && parsed.isSpellCast && parsed.spellCast) {
      const spellName = parsed.spellCast.spellName;
      let spellConsumption = 0;
      
      // Spell consumption values
      const consumptionMap: { [key: string]: number } = {
        "Flèche criblante": 60,
        "Flèche fulminante": 45,
        "Flèche d'immolation": 30,
        "Flèche enflammée": 60,
        "Flèche ardente": 30,
        "Flèche Ardente": 30,
        "Pluie de flèches": 60,
        "Pluie de fleches": 60,
        "Flèche explosive": 90,
        "Flèche cinglante": 45,
        "Flèche perçante": 75,
        "Flèche destructrice": 105,
        "Flèche chercheuse": 30,
        "Flèche de recul": 60,
        "Flèche tempête": 45,
        "Flèche harcelante": 45,
        "Flèche statique": 90
      };
      
      for (const [spell, cost] of Object.entries(consumptionMap)) {
        if (spellName.includes(spell)) {
          spellConsumption = cost;
          break;
        }
      }
      
      if (spellConsumption > 0) {
        this.precision = Math.max(this.precision - spellConsumption, 0);
        this.updateUI();
      }
    }
  }

  private storePrecisionGain(gainValue: number): void {
    this.recentPrecisionGains.push(gainValue);
    // Keep only the last N gains
    if (this.recentPrecisionGains.length > this.maxRecentGains) {
      this.recentPrecisionGains.shift();
    }
  }

  private wasRecent300Gain(): boolean {
    if (this.recentPrecisionGains.length === 0) {
      return false;
    }
    return this.recentPrecisionGains[this.recentPrecisionGains.length - 1] === 300;
  }

  private updateUI(): void {
    updateProgressBar('affutage-fill', 'affutage-value', this.affutage, 100);
    updateProgressBar('precision-fill', 'precision-value', this.precision, this.precisionMax);
    
    const precisionMax = document.getElementById('precision-max');
    if (precisionMax) {
      precisionMax.textContent = `/ ${this.precisionMax}`;
    }
    
    updateStackIndicator('pointe-stacks', this.pointeAffuteeStacks, 3, 'Pointe');
    updateStackIndicator('balise-stacks', this.baliseAffuteeStacks, 3, 'Balise');
    updateBooleanIndicator('tir-precis-indicator', this.tirPrecisActive, 'Tir précis actif');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CraTracker();
});
