/**
 * Helpers communes pour les opérations UI dans les trackers
 */

/**
 * Met à jour une barre de progression
 */
export function updateProgressBar(
  fillId: string,
  valueId: string | null,
  current: number,
  max: number,
  format?: (current: number, max: number) => string
): void {
  const fill = document.getElementById(fillId);
  if (fill) {
    const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    fill.style.width = `${percentage}%`;
  }

  if (valueId) {
    const value = document.getElementById(valueId);
    if (value) {
      value.textContent = format ? format(current, max) : current.toString();
    }
  }
}

/**
 * Met à jour un indicateur de stack
 */
export function updateStackIndicator(
  elementId: string,
  current: number,
  max: number,
  label: string
): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = current > 0 ? `${label}: ${current}/${max}` : "";
  }
}

/**
 * Met à jour un indicateur booléen (activé/désactivé)
 */
export function updateBooleanIndicator(
  elementId: string,
  isActive: boolean,
  activeText: string,
  inactiveDisplay: "none" | "block" = "none"
): void {
  const element = document.getElementById(elementId);
  if (element) {
    if (isActive) {
      element.style.display = "block";
      element.textContent = activeText;
    } else {
      element.style.display = inactiveDisplay;
    }
  }
}

/**
 * Met à jour un élément de texte
 */
export function updateTextElement(elementId: string, text: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Setup standard des event listeners pour les trackers
 */
export function setupTrackerEventListeners(
  onLogLine: (line: string, parsed: any) => void,
  onCombatEnded?: () => void,
  onCombatStarted?: () => void,
  onRefreshUI?: () => void
): void {
  if (!window.electronAPI) {
    return;
  }

  window.electronAPI.onLogLine(onLogLine);

  if (onCombatEnded) {
    window.electronAPI.onCombatEnded(onCombatEnded);
  }

  if (onCombatStarted) {
    window.electronAPI.onCombatStarted(onCombatStarted);
  }

  if (onRefreshUI) {
    window.electronAPI.onRefreshUI(onRefreshUI);
  }
}
