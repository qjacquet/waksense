/**
 * Tracker Configs - Configurations des trackers pour le mode debug
 */

interface DebugControl {
  id: string;
  label: string;
  type: "slider" | "checkbox" | "select";
  min?: number;
  max?: number;
  step?: number;
  default?: number | boolean | string;
  options?: { value: string | number; label: string }[];
}

export interface TrackerConfig {
  [key: string]: DebugControl[];
}

export const TRACKER_CONFIGS: TrackerConfig = {
  "cra/index.html": [
    {
      id: "affutage",
      label: "Affûtage",
      type: "slider",
      min: 0,
      max: 100,
      default: 0,
    },
    {
      id: "precision",
      label: "Précision",
      type: "slider",
      min: 0,
      max: 300,
      default: 0,
    },
    {
      id: "precisionMax",
      label: "Précision Max",
      type: "select",
      default: 300,
      options: [
        { value: 200, label: "200" },
        { value: 300, label: "300" },
      ],
    },
    {
      id: "pointeAffuteeStacks",
      label: "Pointe Affûtée",
      type: "slider",
      min: 0,
      max: 3,
      default: 0,
    },
    {
      id: "baliseAffuteeStacks",
      label: "Balise Affûtée",
      type: "slider",
      min: 0,
      max: 3,
      default: 0,
    },
    {
      id: "flecheLumineuseStacks",
      label: "Flèche Lumineuse",
      type: "slider",
      min: 0,
      max: 5,
      default: 0,
    },
    {
      id: "tirPrecisActive",
      label: "Tir Précis Actif",
      type: "checkbox",
      default: false,
    },
  ],
  "cra/jauge.html": [
    {
      id: "affutage",
      label: "Affûtage",
      type: "slider",
      min: 0,
      max: 100,
      default: 0,
    },
    {
      id: "precision",
      label: "Précision",
      type: "slider",
      min: 0,
      max: 300,
      default: 0,
    },
    {
      id: "precisionMax",
      label: "Précision Max",
      type: "select",
      default: 300,
      options: [
        { value: 200, label: "200" },
        { value: 300, label: "300" },
      ],
    },
    {
      id: "pointeAffuteeStacks",
      label: "Pointe Affûtée",
      type: "slider",
      min: 0,
      max: 3,
      default: 0,
    },
    {
      id: "baliseAffuteeStacks",
      label: "Balise Affûtée",
      type: "slider",
      min: 0,
      max: 3,
      default: 0,
    },
    {
      id: "flecheLumineuseStacks",
      label: "Flèche Lumineuse",
      type: "slider",
      min: 0,
      max: 5,
      default: 0,
    },
    {
      id: "tirPrecisActive",
      label: "Tir Précis Actif",
      type: "checkbox",
      default: false,
    },
  ],
  "iop/boosts.html": [
    {
      id: "concentration",
      label: "Concentration",
      type: "slider",
      min: 0,
      max: 100,
      default: 0,
    },
    {
      id: "courroux",
      label: "Courroux Actif",
      type: "checkbox",
      default: false,
    },
    {
      id: "puissance",
      label: "Puissance",
      type: "slider",
      min: 0,
      max: 50,
      default: 0,
    },
    {
      id: "preparation",
      label: "Préparation Actif",
      type: "checkbox",
      default: false,
    },
    { id: "egare", label: "Égaré Actif", type: "checkbox", default: false },
    {
      id: "activePosture",
      label: "Posture",
      type: "select",
      default: "",
      options: [
        { value: "", label: "Aucune" },
        { value: "contre", label: "Posture de contre" },
        { value: "défense", label: "Posture de défense" },
        { value: "vivacité", label: "Posture de vivacité" },
      ],
    },
  ],
  "iop/combos.html": [
    {
      id: "comboName",
      label: "Combo",
      type: "select",
      default: "combo1",
      options: [
        { value: "combo1", label: "Vol de vie" },
        { value: "combo2", label: "Poussée" },
        { value: "combo3", label: "Préparation" },
        { value: "combo4", label: "Dommages supplémentaires" },
        { value: "combo5", label: "Combo PA" },
      ],
    },
    {
      id: "currentStep",
      label: "Étape Actuelle",
      type: "slider",
      min: 0,
      max: 5,
      default: 0,
    },
    {
      id: "readyToComplete",
      label: "Prêt à Compléter",
      type: "checkbox",
      default: false,
    },
  ],
  "iop/jauge.html": [
    {
      id: "concentration",
      label: "Concentration",
      type: "slider",
      min: 0,
      max: 100,
      default: 0,
    },
    {
      id: "courroux",
      label: "Courroux Actif",
      type: "checkbox",
      default: false,
    },
    {
      id: "puissance",
      label: "Puissance",
      type: "slider",
      min: 0,
      max: 50,
      default: 0,
    },
    {
      id: "preparation",
      label: "Préparation Actif",
      type: "checkbox",
      default: false,
    },
    { id: "egare", label: "Égaré Actif", type: "checkbox", default: false },
    {
      id: "activePosture",
      label: "Posture",
      type: "select",
      default: "",
      options: [
        { value: "", label: "Aucune" },
        { value: "contre", label: "Posture de contre" },
        { value: "défense", label: "Posture de défense" },
        { value: "vivacité", label: "Posture de vivacité" },
      ],
    },
  ],
  "ouginak/index.html": [
    {
      id: "rage",
      label: "Rage",
      type: "slider",
      min: 0,
      max: 30,
      default: 0,
    },
    {
      id: "ougigarouActive",
      label: "Ougigarou Actif",
      type: "checkbox",
      default: false,
    },
    { id: "inCombat", label: "En Combat", type: "checkbox", default: true },
    {
      id: "overlayVisible",
      label: "Overlay Visible",
      type: "checkbox",
      default: true,
    },
  ],
};

