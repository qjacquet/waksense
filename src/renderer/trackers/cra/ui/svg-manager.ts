/**
 * Gestionnaire SVG pour le tracker Cra
 */

export interface SVGElements {
  svgElement: SVGElement | null;
  arcBaseLayer: SVGGElement | null;
  cibleBaseLayer: SVGGElement | null;
  affutageLayer: SVGGElement | null;
  precisionLayer: SVGGElement | null;
  baliseCounter: SVGGElement | null;
  pointeCounter: SVGGElement | null;
  flecheLumineuseCounter: SVGGElement | null;
  affutagePercentText: SVGTextElement | null;
  precisionPercentText: SVGTextElement | null;
}

export class SVGManager {
  private elements: SVGElements;

  constructor() {
    this.elements = {
      svgElement: null,
      arcBaseLayer: null,
      cibleBaseLayer: null,
      affutageLayer: null,
      precisionLayer: null,
      baliseCounter: null,
      pointeCounter: null,
      flecheLumineuseCounter: null,
      affutagePercentText: null,
      precisionPercentText: null,
    };
  }

  initialize(): void {
    this.elements.svgElement = document.querySelector<SVGElement>("#cra-logo-svg");
    this.elements.arcBaseLayer = document.querySelector<SVGGElement>("#arc-base-layer");
    this.elements.cibleBaseLayer = document.querySelector<SVGGElement>("#cible-base-layer");
    this.elements.affutageLayer = document.querySelector<SVGGElement>("#affutage-layer");
    this.elements.precisionLayer = document.querySelector<SVGGElement>("#precision-layer");
    this.elements.baliseCounter = document.querySelector<SVGGElement>("#balise-counter");
    this.elements.pointeCounter = document.querySelector<SVGGElement>("#pointe-counter");
    this.elements.flecheLumineuseCounter = document.querySelector<SVGGElement>("#fleche-lumineuse-counter");
    this.elements.affutagePercentText = document.querySelector<SVGTextElement>("#affutage-percent");
    this.elements.precisionPercentText = document.querySelector<SVGTextElement>("#precision-percent");

    if (!this.elements.svgElement) {
      console.error("[CRA JAUGE] SVG element not found");
    }
  }

  getElements(): SVGElements {
    return this.elements;
  }

  showLayer(layer: SVGGElement | null): void {
    if (layer) {
      layer.style.display = "block";
    }
  }

  hideLayer(layer: SVGGElement | null): void {
    if (layer) {
      layer.style.display = "none";
    }
  }

  removeLayerClasses(layer: SVGGElement | null, classes: string[]): void {
    if (layer) {
      layer.classList.remove(...classes);
    }
  }

  updateAffutageFill(normalizedValue: number, currentValue: number): void {
    if (this.elements.affutageLayer) {
      const paths = this.elements.affutageLayer.querySelectorAll<SVGPathElement>(
        ".affutage-fill-path"
      );
      const totalPaths = paths.length;
      paths.forEach((path, index) => {
        const pathThreshold = (index + 1) / totalPaths;
        if (normalizedValue >= pathThreshold) {
          path.classList.add("active");
          path.setAttribute("opacity", "0.9");
        } else {
          path.classList.remove("active");
          path.setAttribute("opacity", "0");
        }
      });
    }

    if (this.elements.affutagePercentText) {
      this.elements.affutagePercentText.textContent = `${currentValue}`;
      if (currentValue > 0) {
        this.elements.affutagePercentText.setAttribute("opacity", "1");
      }
    }
  }

  updatePrecisionFill(normalizedValue: number, currentValue: number): void {
    if (this.elements.precisionLayer) {
      const paths = this.elements.precisionLayer.querySelectorAll<SVGPathElement>(
        ".precision-fill-path"
      );
      const totalPaths = paths.length;
      paths.forEach((path, index) => {
        const pathThreshold = (index + 1) / totalPaths;
        if (normalizedValue >= pathThreshold) {
          path.classList.add("active");
          path.setAttribute("opacity", "0.9");
        } else {
          path.classList.remove("active");
          path.setAttribute("opacity", "0");
        }
      });
    }

    if (this.elements.precisionPercentText) {
      this.elements.precisionPercentText.textContent = `${currentValue}`;
      if (currentValue > 0) {
        this.elements.precisionPercentText.setAttribute("opacity", "1");
      }
    }
  }

  resetAffutageFill(): void {
    if (this.elements.affutageLayer) {
      const paths = this.elements.affutageLayer.querySelectorAll<SVGPathElement>(
        ".affutage-fill-path"
      );
      paths.forEach((path) => {
        path.setAttribute("opacity", "0");
      });
    }
    if (this.elements.affutagePercentText) {
      this.elements.affutagePercentText.setAttribute("opacity", "0");
    }
  }

  resetPrecisionFill(): void {
    if (this.elements.precisionLayer) {
      const paths = this.elements.precisionLayer.querySelectorAll<SVGPathElement>(
        ".precision-fill-path"
      );
      paths.forEach((path) => {
        path.setAttribute("opacity", "0");
      });
    }
    if (this.elements.precisionPercentText) {
      this.elements.precisionPercentText.setAttribute("opacity", "0");
    }
  }

  updateStackCounters(
    baliseStacks: number,
    pointeStacks: number,
    flecheLumineuseStacks: number
  ): void {
    // Mettre à jour le compteur de balises affûtées (bas gauche)
    if (this.elements.baliseCounter) {
      const bars = this.elements.baliseCounter.querySelectorAll<SVGRectElement>(".stack-bar");
      const dots = this.elements.baliseCounter.querySelectorAll<SVGCircleElement>(".stack-bar-dot");
      bars.forEach((bar, index) => {
        if (index < baliseStacks) {
          bar.classList.add("active");
          bar.setAttribute("opacity", "1");
        } else {
          bar.classList.remove("active");
          bar.setAttribute("opacity", "0.3");
        }
      });
      dots.forEach((dot, index) => {
        if (index < baliseStacks) {
          dot.classList.add("active");
          dot.setAttribute("opacity", "1");
        } else {
          dot.classList.remove("active");
          dot.setAttribute("opacity", "0.3");
        }
      });
    }

    // Mettre à jour le compteur de pointes affûtées (bas droite)
    if (this.elements.pointeCounter) {
      const bars = this.elements.pointeCounter.querySelectorAll<SVGPolygonElement>(".stack-bar");
      const lines = this.elements.pointeCounter.querySelectorAll<SVGLineElement>(".stack-bar-line");
      bars.forEach((bar, index) => {
        if (index < pointeStacks) {
          bar.classList.add("active");
          bar.setAttribute("opacity", "1");
        } else {
          bar.classList.remove("active");
          bar.setAttribute("opacity", "0.3");
        }
      });
      lines.forEach((line, index) => {
        if (index < pointeStacks) {
          line.classList.add("active");
          line.setAttribute("opacity", "1");
        } else {
          line.classList.remove("active");
          line.setAttribute("opacity", "0.3");
        }
      });
    }

    // Mettre à jour le compteur de flèches lumineuses
    this.updateFlecheLumineuseCounter(flecheLumineuseStacks);
  }

  private updateFlecheLumineuseCounter(stacks: number): void {
    if (!this.elements.flecheLumineuseCounter) {
      return;
    }

    // Masquer le compteur si on a 0 stack
    if (stacks === 0) {
      this.elements.flecheLumineuseCounter.setAttribute("opacity", "0");
      return;
    }

    // Afficher le compteur si on a au moins 1 stack
    this.elements.flecheLumineuseCounter.setAttribute("opacity", "1");

    const arrows = this.elements.flecheLumineuseCounter.querySelectorAll<SVGGElement>(
      ".stack-arrow"
    );
    const maxArrows = 5;
    const currentStacks = Math.min(stacks, 5);

    arrows.forEach((arrow, index) => {
      const point = arrow.querySelector<SVGCircleElement>(".arrow-point");

      if (index < currentStacks && index < maxArrows) {
        arrow.classList.add("active");
        if (point) point.setAttribute("opacity", "1");
      } else {
        arrow.classList.remove("active");
        if (point) point.setAttribute("opacity", "0.3");
      }
    });
  }
}

