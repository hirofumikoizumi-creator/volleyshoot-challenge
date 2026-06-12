type FilterState = {
  value: number;
  derivative: number;
  timestampMs: number;
  initialized: boolean;
};

function smoothingFactor(deltaSeconds: number, cutoff: number) {
  const r = 2 * Math.PI * cutoff * deltaSeconds;
  return r / (r + 1);
}

function exponentialSmooth(alpha: number, value: number, previous: number) {
  return alpha * value + (1 - alpha) * previous;
}

export class OneEuroScalarFilter {
  private state: FilterState;

  constructor(
    private minCutoff = 1,
    private beta = 0.035,
    private derivativeCutoff = 1,
  ) {
    this.state = {
      value: 0,
      derivative: 0,
      timestampMs: 0,
      initialized: false,
    };
  }

  filter(value: number, timestampMs: number) {
    if (!this.state.initialized) {
      this.state = {
        value,
        derivative: 0,
        timestampMs,
        initialized: true,
      };
      return value;
    }

    const deltaSeconds = Math.max(1 / 120, (timestampMs - this.state.timestampMs) / 1000);
    const derivative = (value - this.state.value) / deltaSeconds;
    const derivativeAlpha = smoothingFactor(deltaSeconds, this.derivativeCutoff);
    const smoothedDerivative = exponentialSmooth(derivativeAlpha, derivative, this.state.derivative);
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative);
    const alpha = smoothingFactor(deltaSeconds, cutoff);
    const smoothedValue = exponentialSmooth(alpha, value, this.state.value);

    this.state = {
      value: smoothedValue,
      derivative: smoothedDerivative,
      timestampMs,
      initialized: true,
    };

    return smoothedValue;
  }

  reset() {
    this.state.initialized = false;
  }
}

export class OneEuroPointFilter {
  private xFilter = new OneEuroScalarFilter();
  private yFilter = new OneEuroScalarFilter();

  filter(point: { x: number; y: number; visibility: number }, timestampMs: number) {
    return {
      ...point,
      x: this.xFilter.filter(point.x, timestampMs),
      y: this.yFilter.filter(point.y, timestampMs),
    };
  }

  reset() {
    this.xFilter.reset();
    this.yFilter.reset();
  }
}
