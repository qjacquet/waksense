/**
 * Gestion de l'état des ressources pour le tracker Cra
 */

import {
  MAX_POINTE_STACKS,
  MAX_BALISE_STACKS,
  MAX_FLECHE_LUMINEUSE_STACKS,
  PRECISION_MAX_DEFAULT,
  MAX_RECENT_PRECISION_GAINS,
} from "../config/spell-maps.js";

export interface CraResourceState {
  affutage: number;
  precision: number;
  pointeAffuteeStacks: number;
  baliseAffuteeStacks: number;
  flecheLumineuseStacks: number;
  trackedPlayerName: string | null;
  tirPrecisActive: boolean;
  hasEspritAffute: boolean;
  precisionMax: number;
  recentPrecisionGains: number[];
}

export class ResourceState {
  private state: CraResourceState;

  constructor() {
    this.state = {
      affutage: 0,
      precision: 0,
      pointeAffuteeStacks: 0,
      baliseAffuteeStacks: 0,
      flecheLumineuseStacks: 0,
      trackedPlayerName: null,
      tirPrecisActive: false,
      hasEspritAffute: false,
      precisionMax: PRECISION_MAX_DEFAULT,
      recentPrecisionGains: [],
    };
  }

  getState(): CraResourceState {
    return { ...this.state };
  }

  getAffutage(): number {
    return this.state.affutage;
  }

  setAffutage(value: number): void {
    this.state.affutage = value;
  }

  getPrecision(): number {
    return this.state.precision;
  }

  setPrecision(value: number): void {
    this.state.precision = value;
  }

  getPointeAffuteeStacks(): number {
    return this.state.pointeAffuteeStacks;
  }

  setPointeAffuteeStacks(value: number): void {
    this.state.pointeAffuteeStacks = Math.min(value, MAX_POINTE_STACKS);
  }

  addPointeAffuteeStacks(value: number): void {
    this.state.pointeAffuteeStacks = Math.min(
      this.state.pointeAffuteeStacks + value,
      MAX_POINTE_STACKS
    );
  }

  getBaliseAffuteeStacks(): number {
    return this.state.baliseAffuteeStacks;
  }

  setBaliseAffuteeStacks(value: number): void {
    this.state.baliseAffuteeStacks = Math.min(value, MAX_BALISE_STACKS);
  }

  addBaliseAffuteeStacks(value: number): void {
    this.state.baliseAffuteeStacks = Math.min(
      this.state.baliseAffuteeStacks + value,
      MAX_BALISE_STACKS
    );
  }

  getFlecheLumineuseStacks(): number {
    return this.state.flecheLumineuseStacks;
  }

  setFlecheLumineuseStacks(value: number): void {
    this.state.flecheLumineuseStacks = Math.min(
      value,
      MAX_FLECHE_LUMINEUSE_STACKS
    );
  }

  getTrackedPlayerName(): string | null {
    return this.state.trackedPlayerName;
  }

  setTrackedPlayerName(name: string | null): void {
    this.state.trackedPlayerName = name;
  }

  getTirPrecisActive(): boolean {
    return this.state.tirPrecisActive;
  }

  setTirPrecisActive(active: boolean): void {
    this.state.tirPrecisActive = active;
  }

  getHasEspritAffute(): boolean {
    return this.state.hasEspritAffute;
  }

  setHasEspritAffute(has: boolean): void {
    this.state.hasEspritAffute = has;
  }

  getPrecisionMax(): number {
    return this.state.precisionMax;
  }

  setPrecisionMax(max: number): void {
    this.state.precisionMax = max;
  }

  storePrecisionGain(gainValue: number): void {
    this.state.recentPrecisionGains.push(gainValue);
    if (this.state.recentPrecisionGains.length > MAX_RECENT_PRECISION_GAINS) {
      this.state.recentPrecisionGains.shift();
    }
  }

  wasRecent300Gain(): boolean {
    if (this.state.recentPrecisionGains.length === 0) {
      return false;
    }
    return (
      this.state.recentPrecisionGains[
        this.state.recentPrecisionGains.length - 1
      ] === 300
    );
  }

  reset(): void {
    this.state.affutage = 0;
    this.state.precision = 0;
    this.state.pointeAffuteeStacks = 0;
    this.state.baliseAffuteeStacks = 0;
    this.state.flecheLumineuseStacks = 0;
    this.state.trackedPlayerName = null;
    this.state.tirPrecisActive = false;
    this.state.precisionMax = PRECISION_MAX_DEFAULT;
    this.state.hasEspritAffute = false;
    this.state.recentPrecisionGains = [];
  }
}

