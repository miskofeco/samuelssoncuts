function niceStep(rawStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : normalized <= 7.5
              ? 7.5
              : 10;

  return factor * magnitude;
}

export function metricScaleTicks(maxValue: number): number[] {
  const max = Math.max(0, Math.ceil(maxValue));
  if (max === 0) return [1, 0];
  if (max <= 4) {
    return Array.from({ length: max + 1 }, (_, index) => max - index);
  }

  const step = niceStep(max / 4);
  const axisMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];

  for (let value = axisMax; value > 0; value -= step) {
    ticks.push(Number(value.toFixed(8)));
  }
  ticks.push(0);

  return ticks;
}
