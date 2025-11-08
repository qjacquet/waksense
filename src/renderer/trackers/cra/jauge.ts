/**
 * Cra Jauge Tracker - Suivi visuel des ressources Cra avec SVG
 * Version modulaire - orchestration des différents modules
 */

import { setupTrackerEventListeners } from "../../core/ui-helpers.js";
import { ResourceState } from "./core/resource-state.js";
import { AffutageParser } from "./parsers/affutage-parser.js";
import { PrecisionParser } from "./parsers/precision-parser.js";
import { StacksParser } from "./parsers/stacks-parser.js";
import { SpellConsumptionParser } from "./parsers/spell-consumption-parser.js";
import { TirPrecisParser } from "./parsers/tir-precis-parser.js";
import { SVGManager } from "./ui/svg-manager.js";
import { UIUpdater } from "./ui/ui-updater.js";
import { LottieManager } from "./animations/lottie-manager.js";
import { PATTERNS } from "../../../shared/constants/patterns.js";

class CraJaugeTracker {
  private debugMode: boolean = false;

  private state: ResourceState;
  private affutageParser: AffutageParser;
  private precisionParser: PrecisionParser;
  private stacksParser: StacksParser;
  private spellConsumptionParser: SpellConsumptionParser;
  private tirPrecisParser: TirPrecisParser;
  private svgManager: SVGManager;
  private uiUpdater: UIUpdater;
  private lottieManager: LottieManager;

  constructor() {
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get(PATTERNS.DEBUG_URL_PARAM) === "true";

    this.state = new ResourceState();
    this.affutageParser = new AffutageParser(this.state);
    this.precisionParser = new PrecisionParser(this.state);
    this.stacksParser = new StacksParser(this.state);
    this.spellConsumptionParser = new SpellConsumptionParser(this.state);
    this.tirPrecisParser = new TirPrecisParser(this.state);
    this.svgManager = new SVGManager();
    this.lottieManager = new LottieManager();
    this.uiUpdater = new UIUpdater(this.state, this.svgManager);

    this.svgManager.initialize();
    this.setupEventListeners();

    if (this.debugMode) {
      this.setupDebugMode();
    }

    this.uiUpdater.update();
  }

  private setupEventListeners(): void {
    setupTrackerEventListeners(
      (line: string, parsed: any) => this.processLogLine(line, parsed),
      () => this.resetResources(),
      () => {
        this.uiUpdater.update();
      }
    );
  }

  private resetResources(): void {
    this.state.reset();
    this.uiUpdater.update();
  }

  private processLogLine(line: string, parsed: any): void {
    let uiNeedsUpdate = false;

    if (this.affutageParser.parse(line)) {
      uiNeedsUpdate = true;
    }

    if (this.precisionParser.parse(line)) {
      uiNeedsUpdate = true;
    }

    if (!line.includes(PATTERNS.LOG_COMBAT_INFO)) {
      if (uiNeedsUpdate) {
        this.uiUpdater.update();
      }
      return;
    }

    if (this.stacksParser.parsePointeAffutee(line)) {
      uiNeedsUpdate = true;
    }

    if (this.stacksParser.parseBaliseAffutee(line)) {
      uiNeedsUpdate = true;
    }

    if (this.stacksParser.parseFlecheLumineuse(line, parsed)) {
      uiNeedsUpdate = true;
    }

    if (this.tirPrecisParser.parse(line)) {
      this.uiUpdater.updateTirPrecis(
        this.state.getTirPrecisActive(),
        this.lottieManager
      );
      uiNeedsUpdate = true;
    }

    if (this.precisionParser.parseBuffRemoval(line)) {
      uiNeedsUpdate = true;
    }

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
        if (values.tirPrecisActive !== undefined) {
          this.state.setTirPrecisActive(Boolean(values.tirPrecisActive));
        }
        if (values.baliseAffuteeStacks !== undefined)
          this.state.setBaliseAffuteeStacks(Number(values.baliseAffuteeStacks));
        if (values.pointeAffuteeStacks !== undefined)
          this.state.setPointeAffuteeStacks(Number(values.pointeAffuteeStacks));
        if (values.flecheLumineuseStacks !== undefined)
          this.state.setFlecheLumineuseStacks(Number(values.flecheLumineuseStacks));
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
          case "tirPrecisActive":
            this.state.setTirPrecisActive(Boolean(value));
            this.uiUpdater.updateTirPrecis(
              this.state.getTirPrecisActive(),
              this.lottieManager
            );
            break;
          case "baliseAffuteeStacks":
            this.state.setBaliseAffuteeStacks(Number(value));
            break;
          case "pointeAffuteeStacks":
            this.state.setPointeAffuteeStacks(Number(value));
            break;
          case "flecheLumineuseStacks":
            this.state.setFlecheLumineuseStacks(Number(value));
            break;
        }
        this.uiUpdater.update();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CraJaugeTracker();
});
