/**
 * Animations de remplissage pour les jauges SVG
 */

export interface FillAnimationCallbacks {
  onUpdate: (normalizedValue: number) => void;
  onComplete?: () => void;
}

export class FillAnimation {
  private currentFillNormalized: number = 0;
  private targetFillNormalized: number = 0;
  private fillAnimationFrame: number | null = null;
  private callbacks: FillAnimationCallbacks;

  constructor(callbacks: FillAnimationCallbacks) {
    this.callbacks = callbacks;
  }

  animateTo(target: number): void {
    this.targetFillNormalized = Math.max(0, Math.min(1, target));
    if (this.fillAnimationFrame !== null) {
      return; // already animating; the loop will pick up the new target
    }

    const step = () => {
      const diff = this.targetFillNormalized - this.currentFillNormalized;
      if (Math.abs(diff) < 0.002) {
        this.currentFillNormalized = this.targetFillNormalized;
      } else {
        // ease towards target
        this.currentFillNormalized += diff * 0.15;
      }

      this.callbacks.onUpdate(this.currentFillNormalized);

      if (this.currentFillNormalized !== this.targetFillNormalized) {
        this.fillAnimationFrame = requestAnimationFrame(step);
      } else {
        if (this.fillAnimationFrame !== null) {
          cancelAnimationFrame(this.fillAnimationFrame);
        }
        this.fillAnimationFrame = null;
        if (this.callbacks.onComplete) {
          this.callbacks.onComplete();
        }
      }
    };

    this.fillAnimationFrame = requestAnimationFrame(step);
  }

  reset(): void {
    if (this.fillAnimationFrame !== null) {
      cancelAnimationFrame(this.fillAnimationFrame);
      this.fillAnimationFrame = null;
    }
    this.currentFillNormalized = 0;
    this.targetFillNormalized = 0;
  }

  getCurrentValue(): number {
    return this.currentFillNormalized;
  }
}

