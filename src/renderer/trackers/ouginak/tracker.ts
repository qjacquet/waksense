/**
 * Ouginak Tracker - Suivi des ressources Ouginak en temps réel
 * Basé exactement sur wakfu_ouginak_resource_tracker.py
 */

import {
  setupTrackerEventListeners,
  updateProgressBar,
} from "../../core/ui-helpers.js";

interface TimelineEntry {
  spell: string;
  cost: string;
  icon?: string;
}

class OuginakTracker {
  // Resource tracking
  private resource: number = 0; // Rage (0-30)
  private ougigarouActive: boolean = false;

  // Turn-based visibility system
  private trackedPlayerName: string | null = null;
  private isOuginakTurn: boolean = false;
  private overlayVisible: boolean = false;
  private inCombat: boolean = false;
  private lastSpellCaster: string | null = null;

  // Timeline system
  private timelineMaxSlots: number = 5;
  private timelineEntries: TimelineEntry[] = [];

  private debugMode: boolean = false;

  // Spell to icon filename mapping
  private readonly spellIconMap: Map<string, string> = new Map([
    ["Emeute", "Emeute.png"],
    ["Émeute", "Emeute.png"],
    ["Fléau", "Fléau.png"],
    ["Fleau", "Fléau.png"],
    ["Rupture", "Rupture.png"],
    ["Plombage", "Plombage.png"],
    ["Balafre", "Balafre.png"],
    ["Croc-en-jambe", "Croc-en-jambe.png"],
    ["Bastonnade", "Bastonnade.png"],
    ["Molosse", "Molosse.png"],
    ["Hachure", "Hachure.png"],
    ["Saccade", "Saccade.png"],
    ["Balayage", "Balayage.png"],
    ["Contusion", "Contusion.png"],
    ["Cador", "Cador.png"],
    ["Brise'Os", "Brise'Os.png"],
    ["Brise'O", "Brise'Os.png"],
    ["Baroud", "Baroud.png"],
    ["Chasseur", "Chasseur.png"],
    ["Elan", "Elan.png"],
    ["Élan", "Elan.png"],
    ["Canine", "Canine.png"],
    ["Apaisement", "Apaisement.png"],
    ["Poursuite", "Poursuite.png"],
    ["Meute", "Meute.png"],
    ["Proie", "Proie.png"],
    ["Chienchien", "Chienchien.png"],
    ["Ougigarou", "Ougigarou.png"],
  ]);

  // Spell cost mapping (PA, PM, PW separately for rage calculation)
  private readonly spellCostMap: Map<string, string> = new Map([
    ["Emeute", "3 PA"],
    ["Émeute", "3 PA"],
    ["Fléau", "4 PA"],
    ["Fleau", "4 PA"], // Show only first cost
    ["Rupture", "2 PA"],
    ["Plombage", "3 PA"],
    ["Balafre", "5 PA"],
    ["Croc-en-jambe", "2 PA"],
    ["Bastonnade", "3 PA"], // Show only first cost
    ["Molosse", "4 PA"],
    ["Hachure", "3 PA"],
    ["Saccade", "4 PA"],
    ["Balayage", "4 PA"],
    ["Contusion", "3 PA"],
    ["Cador", "3 PA"], // 3 PA + 1 PW total
    ["Brise'Os", "2 PA"],
    ["Brise'O", "2 PA"],
    ["Baroud", "6 PA"], // 6 PA + 1 PW total
    ["Chasseur", "2 PA"],
    ["Elan", "1 PA"],
    ["Élan", "1 PA"],
    ["Canine", "3 PA"],
    ["Apaisement", "2 PA"],
    ["Poursuite", "3 PA"],
    ["Meute", "1 PW"],
    ["Proie", "1 PW"],
    ["Chienchien", "3 PA"],
    ["Ougigarou", "2 PA 2 PW"], // Ougigarou cast cost
  ]);

  // Total resource cost for rage calculation (PA + PM + PW)
  private readonly spellRageCostMap: Map<string, number> = new Map([
    ["Emeute", 3],
    ["Émeute", 3],
    ["Fléau", 5],
    ["Fleau", 5], // 4 PA + 1 PW
    ["Rupture", 2],
    ["Plombage", 3],
    ["Balafre", 5],
    ["Croc-en-jambe", 2],
    ["Bastonnade", 4], // 3 PA + 1 PW
    ["Molosse", 4],
    ["Hachure", 3],
    ["Saccade", 4],
    ["Balayage", 4],
    ["Contusion", 3],
    ["Cador", 4], // 3 PA + 1 PW
    ["Brise'Os", 2],
    ["Brise'O", 2],
    ["Baroud", 7], // 6 PA + 1 PW
    // Note: Chasseur, Elan, Élan, Canine, Apaisement, Poursuite, Meute, Proie, Chienchien do NOT consume rage
  ]);

  // Ouginak spells list
  private readonly ouginakSpells: string[] = [
    "Emeute",
    "Émeute",
    "Fleau",
    "Fléau",
    "Rupture",
    "Plombage",
    "Balafre",
    "Croc-en-jambe",
    "Bastonnade",
    "Molosse",
    "Hachure",
    "Saccade",
    "Balayage",
    "Contusion",
    "Cador",
    "Brise'Os",
    "Brise'O",
    "Baroud",
    "Chasseur",
    "Elan",
    "Élan",
    "Canine",
    "Apaisement",
    "Poursuite",
    "Meute",
    "Proie",
    "Ougigarou",
    "Chienchien",
  ];

  constructor() {
    if (!window.electronAPI) {
      return;
    }

    // Détecter le mode debug
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get("debug") === "true";

    this.setupEventListeners();
    if (this.debugMode) {
      this.setupDebugMode();
    }
    this.updateUI();
    this.updateTimeline();
  }

  private setupEventListeners(): void {
    setupTrackerEventListeners(
      (line: string, parsed: any) => this.parseLogLine(line, parsed),
      () => this.resetResources(),
      () => {
        // Au début du combat, mettre inCombat à true
        this.inCombat = true;
        // Si on a déjà un joueur tracké, afficher l'overlay
        if (this.trackedPlayerName) {
          this.overlayVisible = true;
        }
        this.updateUI();
      }
    );
  }

  private resetResources(): void {
    this.resource = 0;
    this.ougigarouActive = false;
    this.isOuginakTurn = false;
    this.overlayVisible = false;
    this.inCombat = false;
    this.trackedPlayerName = null;
    this.lastSpellCaster = null;
    this.timelineEntries = [];
    this.updateUI();
    this.updateTimeline();
  }

  private async loadLockState(): Promise<boolean> {
    // TODO: Implémenter le chargement depuis lock_states.json via IPC
    // Pour l'instant, retourne false (unlocked)
    return false;
  }

  private parseLogLine(line: string, parsed: any): void {
    // Check if it's a combat line
    if (!line.includes("[Information (combat)]")) {
      return;
    }

    // Check for Rage gain/loss
    const rageMatch = line.match(/(\d+)\s+Rage\s*\(Traqueur\)/);
    if (rageMatch) {
      const rageGained = parseInt(rageMatch[1], 10);
      // Add to current rage (it shows how much we gained, not current total)
      this.resource = Math.min(30, this.resource + rageGained);
      console.log(`[OUGINAK] Rage gained ${rageGained}, current total: ${this.resource}`);
      this.updateUI();
      return;
    }

    // Check for combat start
    if (line.includes("lance le sort")) {
      // inCombat est déjà mis à true par onCombatStarted, mais on le met ici aussi pour sécurité
      if (!this.inCombat) {
        this.inCombat = true;
      }

      // Extract player and spell info
      // Python regex: r'\[Information \(combat\)\] ([^:]+)[:\s]+lance le sort ([^(]+)'
      let casterName: string | null = null;
      let spellName: string | null = null;

      // Try parsed first (more reliable)
      if (parsed.isSpellCast && parsed.spellCast) {
        casterName = parsed.spellCast.playerName;
        spellName = parsed.spellCast.spellName;
      } else {
        // Fallback: use Python exact regex
        const spellMatch = line.match(
          /\[Information \(combat\)\] ([^:]+)[:\s]+lance le sort ([^(]+)/
        );
        if (spellMatch) {
          casterName = spellMatch[1].trim();
          spellName = spellMatch[2].trim();
        }
      }

      if (casterName && spellName) {
        // Track last spell caster
        this.lastSpellCaster = casterName;

        // Check if this is an Ouginak spell
        // Python: any(ouginak_spell in spell_name for ouginak_spell in self.ouginak_spells)
        const isOuginakSpell = this.ouginakSpells.some((spell) =>
          spellName.includes(spell)
        );

        if (isOuginakSpell) {
          // Set tracked player on first Ouginak spell cast
          if (this.trackedPlayerName === null) {
            this.trackedPlayerName = casterName;
            console.log(`[OUGINAK] Ouginak player tracked: ${casterName}`);
          }

          // Show overlay if the tracked Ouginak casts a spell
          if (casterName === this.trackedPlayerName) {
            this.isOuginakTurn = true;
            this.overlayVisible = true;
            this.inCombat = true; // S'assurer que inCombat est à true
            console.log(`[OUGINAK] Ouginak turn started - overlay shown for '${spellName}'`);

            // Add to timeline
            this.addSpellToTimeline(spellName);

            // Check if Ougigarou mode consumption should happen
            // NOTE: Le Python vérifie deux fois caster_name == self.tracked_player_name
            // (ligne 875 et 884) - c'est redondant mais je garde comme dans le script
            if (this.ougigarouActive && casterName === this.trackedPlayerName) {
              const rageCost = this.spellRageCostMap.get(spellName) || 0;
              if (rageCost > 0) {
                this.resource = Math.max(0, this.resource - rageCost);
                console.log(`[OUGINAK] Spell '${spellName}' consumed ${rageCost} rage, current: ${this.resource}`);

                // Check if rage reached 0 (exit Ougigarou mode)
                if (this.resource <= 0) {
                  this.ougigarouActive = false;
                  console.log("[OUGINAK] Rage depleted, exiting Ougigarou mode");
                }
                this.updateUI();
              }
            }
          }
        }
      }
    }

    // Check for Ougigarou activation (check for player name separately)
    if (line.includes("Ougigarou (Niv.")) {
      // Extract player name and check if it's our tracked player
      const ougiMatch = line.match(
        /\[Information \(combat\)\] ([^:]+): Ougigarou/
      );
      if (ougiMatch && ougiMatch[1].trim() === this.trackedPlayerName) {
        this.ougigarouActive = true;
        console.log("[OUGINAK] Ougigarou mode activated");
        this.updateUI();
      }
    }

    // Check for Ougigarou deactivation
    // NOTE: Le Python ne vérifie pas si c'est le joueur tracké - si un autre Ouginak
    // sort du mode, ça désactive aussi pour le joueur tracké (incohérence potentielle)
    if (
      line.includes("n'est plus sous l'emprise de 'Ougigarou' (Rage consommée)")
    ) {
      this.ougigarouActive = false;
      console.log("[OUGINAK] Ougigarou mode deactivated");
      this.updateUI();
    }

    // Turn end detection
    if (line.includes("secondes reportées pour le tour suivant")) {
      // Reload lock state to check current state
      this.loadLockState().then((isLocked) => {
        const turnOwner = this.lastSpellCaster;

        if (
          turnOwner &&
          this.trackedPlayerName &&
          turnOwner === this.trackedPlayerName
        ) {
          this.isOuginakTurn = false;
          // Only hide overlay if not locked (locked overlays stay visible)
          if (!isLocked) {
            this.overlayVisible = false;
          }
          console.log(
            `[OUGINAK] Ouginak turn ended - overlay ${!this.overlayVisible ? "hidden" : "still visible (locked)"}`
          );
          this.updateUI();
        }
      });
    }

    // Combat end detection
    if (
      line.includes(
        "Combat terminé, cliquez ici pour rouvrir l'écran de fin de combat."
      )
    ) {
      this.inCombat = false;
      this.isOuginakTurn = false;
      this.overlayVisible = false;
      this.trackedPlayerName = null;
      this.lastSpellCaster = null;
      this.resource = 0;
      this.ougigarouActive = false;
      this.timelineEntries = []; // Clear timeline on combat end
      console.log("[OUGINAK] Combat ended, resources reset");
      this.updateUI();
      this.updateTimeline();
    }
  }

  private addSpellToTimeline(spellName: string): void {
    // Get icon filename
    const iconFilename = this.spellIconMap.get(spellName);
    const iconPath = iconFilename
      ? `../../../assets/classes/ouginak/${iconFilename}`
      : undefined;

    // Determine what to show: Rage cost if Ougigarou active and spell consumes rage, otherwise spell cost
    let displayCost: string;
    if (this.ougigarouActive && this.spellRageCostMap.has(spellName)) {
      const rageCost = this.spellRageCostMap.get(spellName) || 0;
      displayCost = rageCost > 0 ? `${rageCost}RG` : "";
    } else {
      // Show spell cost normally - only the first cost
      // Python: first_cost = cost.split()[0:2] if len(cost.split()) >= 2 else cost.split()
      //        display_cost = "".join(first_cost)  # e.g., "2 PA" -> "2PA"
      const cost = this.spellCostMap.get(spellName) || "? PA";
      const costParts = cost.split(" ");
      const firstCost =
        costParts.length >= 2
          ? costParts.slice(0, 2).join("") // e.g., "2 PA" -> "2PA"
          : costParts.join("");
      displayCost = firstCost;
    }

    // Build entry
    const entry: TimelineEntry = {
      spell: spellName,
      cost: displayCost,
      icon: iconPath,
    };

    // Append and clamp to last N
    this.timelineEntries.push(entry);
    if (this.timelineEntries.length > this.timelineMaxSlots) {
      this.timelineEntries = this.timelineEntries.slice(-this.timelineMaxSlots);
    }

    this.updateTimeline();
  }

  private updateTimeline(): void {
    const timelineContainer = document.getElementById("timeline-container");
    if (!timelineContainer) {
      return;
    }

    timelineContainer.innerHTML = "";

    // Fill newest-to-oldest left-to-right (latest cast on the far left)
    // Python: for i in range(self.timeline_max_slots):
    //         entry_index = len(self.timeline_entries) - 1 - i
    for (let i = 0; i < this.timelineMaxSlots; i++) {
      const entryIndex = this.timelineEntries.length - 1 - i;

      if (entryIndex >= 0 && entryIndex < this.timelineEntries.length) {
        const entry = this.timelineEntries[entryIndex];

        const timelineItem = document.createElement("div");
        timelineItem.className = "timeline-item";

        // Icon
        const iconDiv = document.createElement("div");
        iconDiv.className = "timeline-icon";
        if (entry.icon) {
          const img = document.createElement("img");
          img.src = entry.icon;
          img.alt = entry.spell;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "contain";
          iconDiv.appendChild(img);
        } else {
          iconDiv.textContent = "🐺";
        }
        timelineItem.appendChild(iconDiv);

        // Cost
        const costDiv = document.createElement("div");
        costDiv.className = "timeline-cost";
        costDiv.textContent = entry.cost;

        // Add color class based on resource type
        if (entry.cost.includes("RG")) {
          costDiv.classList.add("cost-rage");
        } else if (entry.cost.includes("PA")) {
          costDiv.classList.add("cost-pa");
        } else if (entry.cost.includes("PM")) {
          costDiv.classList.add("cost-pm");
        } else if (entry.cost.includes("PW")) {
          costDiv.classList.add("cost-pw");
        }

        timelineItem.appendChild(costDiv);
        timelineContainer.appendChild(timelineItem);
      }
    }
  }

  private setupDebugMode(): void {
    // En mode debug, on force inCombat à true pour que les indicateurs s'affichent
    this.inCombat = true;

    window.addEventListener("message", (event) => {
      if (event.data.type === "debug-init") {
        const values = event.data.values;
        if (values.rage !== undefined) this.resource = Number(values.rage);
        if (values.ougigarouActive !== undefined)
          this.ougigarouActive = Boolean(values.ougigarouActive);
        if (values.inCombat !== undefined)
          this.inCombat = Boolean(values.inCombat);
        if (values.overlayVisible !== undefined)
          this.overlayVisible = Boolean(values.overlayVisible);
        this.updateUI();
        this.updateTimeline();
      } else if (event.data.type === "debug-update") {
        const { key, value } = event.data;
        switch (key) {
          case "rage":
            this.resource = Number(value);
            break;
          case "ougigarouActive":
            this.ougigarouActive = Boolean(value);
            break;
          case "inCombat":
            this.inCombat = Boolean(value);
            break;
          case "overlayVisible":
            this.overlayVisible = Boolean(value);
            break;
        }
        this.updateUI();
        this.updateTimeline();
      }
    });
  }

  private updateUI(): void {
    // Update rage bar (0-30)
    updateProgressBar(
      "rage-fill",
      "rage-value",
      this.resource,
      30,
      (current, max) => `${current}/${max}`
    );

    // Update Ougigarou mode style
    const rageFill = document.getElementById("rage-fill");
    const trackerContainer = document.getElementById("tracker-container");

    if (rageFill && trackerContainer) {
      if (this.ougigarouActive) {
        rageFill.classList.add("ougarou-active");
        trackerContainer.classList.add("ougarou-mode");

        // Add animated GIF background if not already present
        let gifImg = rageFill.querySelector(
          ".rage-gif-background"
        ) as HTMLImageElement;
        if (!gifImg) {
          gifImg = document.createElement("img");
          gifImg.className = "rage-gif-background";
          gifImg.src = "../../../assets/classes/ouginak/rageeffect.gif";
          gifImg.style.position = "absolute";
          gifImg.style.top = "0";
          gifImg.style.left = "0";
          gifImg.style.width = "100%";
          gifImg.style.height = "100%";
          gifImg.style.objectFit = "cover";
          gifImg.style.opacity = "0.9";
          gifImg.style.zIndex = "-1";
          gifImg.style.borderRadius = "9px";
          gifImg.onerror = () => {
            gifImg.style.display = "none";
          };
          rageFill.appendChild(gifImg);
        }
      } else {
        rageFill.classList.remove("ougarou-active");
        trackerContainer.classList.remove("ougarou-mode");

        const gifImg = rageFill.querySelector(".rage-gif-background");
        if (gifImg) {
          gifImg.remove();
        }
      }
    }

    // Show/hide overlay based on visibility
    if (trackerContainer) {
      if (this.overlayVisible && this.inCombat) {
        trackerContainer.style.display = "block";
      } else {
        trackerContainer.style.display = "none";
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new OuginakTracker();
});
