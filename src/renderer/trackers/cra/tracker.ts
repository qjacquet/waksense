/**
 * Cra Tracker - Suivi des ressources Cra en temps réel
 * Version modulaire - réutilise les parsers et le state
 */

import { setupTrackerEventListeners } from "../../core/ui-helpers.js";
import { ResourceState } from "./core/resource-state.js";
import { AffutageParser } from "./parsers/affutage-parser.js";
import { PrecisionParser } from "./parsers/precision-parser.js";
import { StacksParser } from "./parsers/stacks-parser.js";
import { SpellConsumptionParser } from "./parsers/spell-consumption-parser.js";
import { TirPrecisParser } from "./parsers/tir-precis-parser.js";
import { ProgressBarUpdater } from "./ui/progress-bar-updater.js";
import { IconLoader } from "./ui/icon-loader.js";

class CraTracker {
  private debugMode: boolean = false;

  // Modules
  private state: ResourceState;
  private affutageParser: AffutageParser;
  private precisionParser: PrecisionParser;
  private stacksParser: StacksParser;
  private spellConsumptionParser: SpellConsumptionParser;
  private tirPrecisParser: TirPrecisParser;
  private uiUpdater: ProgressBarUpdater;

  constructor() {
    // Détecter le mode debug
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get("debug") === "true";

    // Initialiser les modules
    this.state = new ResourceState();
    this.affutageParser = new AffutageParser(this.state);
    this.precisionParser = new PrecisionParser(this.state);
    this.stacksParser = new StacksParser(this.state);
    this.spellConsumptionParser = new SpellConsumptionParser(this.state);
    this.tirPrecisParser = new TirPrecisParser(this.state);
    this.uiUpdater = new ProgressBarUpdater(this.state);

    // Charger les icônes
    IconLoader.loadIcons();

    // Setup event listeners
    this.setupEventListeners();

    if (this.debugMode) {
      this.setupDebugMode();
    }

    this.uiUpdater.update();
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
    this.state.reset();
    this.uiUpdater.update();
  }

  private processLogLine(line: string, parsed: any): void {
    let uiNeedsUpdate = false;

    // Parse Affûtage (peut être dans ou hors combat)
    if (this.affutageParser.parse(line)) {
      uiNeedsUpdate = true;
    }

    // Parse Précision (peut être dans ou hors combat)
    if (this.precisionParser.parse(line)) {
      uiNeedsUpdate = true;
    }

    // Les autres parsers nécessitent des lignes de combat
    if (!line.includes("[Information (combat)]")) {
      if (uiNeedsUpdate) {
        this.uiUpdater.update();
      }
      return;
    }

    // Parse Pointe affûtée consumption
    if (this.stacksParser.parsePointeAffutee(line)) {
      uiNeedsUpdate = true;
    }

    // Parse Balise affûtée consumption
    if (this.stacksParser.parseBaliseAffutee(line)) {
      uiNeedsUpdate = true;
    }

    // Parse Flèche lumineuse
    if (this.stacksParser.parseFlecheLumineuse(line, parsed)) {
      uiNeedsUpdate = true;
    }

    // Parse Tir précis buff
    if (this.tirPrecisParser.parse(line)) {
      uiNeedsUpdate = true;
    }

    // Parse Précision buff removal
    if (this.precisionParser.parseBuffRemoval(line)) {
      uiNeedsUpdate = true;
    }

    // Parse spell consumption with Tir précis active
    if (this.spellConsumptionParser.parse(line, parsed)) {
      uiNeedsUpdate = true;
    }

    if (uiNeedsUpdate) {
      this.uiUpdater.update();
    }
  }

  private setupDebugMode(): void {
    window.addEventListener("message", (event) => {
      if (event.data.type === "debug-init") {
        const values = event.data.values;
        if (values.affutage !== undefined)
          this.state.setAffutage(Number(values.affutage));
        if (values.precision !== undefined)
          this.state.setPrecision(Number(values.precision));
        if (values.precisionMax !== undefined)
          this.state.setPrecisionMax(Number(values.precisionMax));
        if (values.pointeAffuteeStacks !== undefined)
          this.state.setPointeAffuteeStacks(Number(values.pointeAffuteeStacks));
        if (values.baliseAffuteeStacks !== undefined)
          this.state.setBaliseAffuteeStacks(Number(values.baliseAffuteeStacks));
        if (values.flecheLumineuseStacks !== undefined)
          this.state.setFlecheLumineuseStacks(Number(values.flecheLumineuseStacks));
        if (values.tirPrecisActive !== undefined)
          this.state.setTirPrecisActive(Boolean(values.tirPrecisActive));
        this.uiUpdater.update();
      } else if (event.data.type === "debug-update") {
        const { key, value } = event.data;
        switch (key) {
          case "affutage":
            this.state.setAffutage(Number(value));
            break;
          case "precision":
            this.state.setPrecision(Number(value));
            break;
          case "precisionMax":
            this.state.setPrecisionMax(Number(value));
            break;
          case "pointeAffuteeStacks":
            this.state.setPointeAffuteeStacks(Number(value));
            break;
          case "baliseAffuteeStacks":
            this.state.setBaliseAffuteeStacks(Number(value));
            break;
          case "flecheLumineuseStacks":
            this.state.setFlecheLumineuseStacks(Number(value));
            break;
          case "tirPrecisActive":
            this.state.setTirPrecisActive(Boolean(value));
            break;
        }
        this.uiUpdater.update();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CraTracker();
});
