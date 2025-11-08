/**
 * Gestion de l'état des ressources pour le tracker Iop
 */

import {
  INITIAL_PUISSANCE,
  MAX_PUISSANCE,
  PUISSANCE_LOSS_ON_ISOLATION,
} from "../config/spell-maps.js";

export type PostureType = "contre" | "défense" | "vivacité" | null;

export interface IopResourceState {
  concentration: number;
  courroux: boolean;
  puissance: number;
  preparation: boolean;
  egare: boolean;
  activePosture: PostureType;
  inCombat: boolean;
  trackedPlayerName: string | null;
  lastSpellCaster: string | null;
}

export class ResourceState {
  private state: IopResourceState;

  constructor() {
    this.state = {
      concentration: 0,
      courroux: false,
      puissance: 0,
      preparation: false,
      egare: false,
      activePosture: null,
      inCombat: false,
      trackedPlayerName: null,
      lastSpellCaster: null,
    };
  }

  getState(): IopResourceState {
    return { ...this.state };
  }

  getConcentration(): number {
    return this.state.concentration;
  }

  setConcentration(value: number): void {
    this.state.concentration = value;
  }

  getCourroux(): boolean {
    return this.state.courroux;
  }

  setCourroux(value: boolean): void {
    this.state.courroux = value;
  }

  getPuissance(): number {
    return this.state.puissance;
  }

  setPuissance(value: number): void {
    this.state.puissance = Math.min(value, MAX_PUISSANCE);
  }

  initializePuissance(): void {
    if (this.state.puissance === 0) {
      this.state.puissance = INITIAL_PUISSANCE;
    }
  }

  losePuissanceOnIsolation(): void {
    this.state.puissance = Math.max(0, this.state.puissance - PUISSANCE_LOSS_ON_ISOLATION);
  }

  getPreparation(): boolean {
    return this.state.preparation;
  }

  setPreparation(value: boolean): void {
    this.state.preparation = value;
  }

  getEgare(): boolean {
    return this.state.egare;
  }

  setEgare(value: boolean): void {
    this.state.egare = value;
  }

  getActivePosture(): PostureType {
    return this.state.activePosture;
  }

  setActivePosture(posture: PostureType): void {
    this.state.activePosture = posture;
  }

  getInCombat(): boolean {
    return this.state.inCombat;
  }

  setInCombat(value: boolean): void {
    this.state.inCombat = value;
  }

  getTrackedPlayerName(): string | null {
    return this.state.trackedPlayerName;
  }

  setTrackedPlayerName(name: string | null): void {
    this.state.trackedPlayerName = name;
  }

  getLastSpellCaster(): string | null {
    return this.state.lastSpellCaster;
  }

  setLastSpellCaster(name: string | null): void {
    this.state.lastSpellCaster = name;
  }

  reset(): void {
    this.state.concentration = 0;
    this.state.courroux = false;
    this.state.puissance = 0;
    this.state.preparation = false;
    this.state.egare = false;
    this.state.activePosture = null;
    this.state.lastSpellCaster = null;
  }
}

