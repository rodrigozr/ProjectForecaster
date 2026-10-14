/**
 * Builders for the result charts (Chart.js data + options). Pure functions, no rendering.
 */
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import { percentile, sortNumbers } from './monteCarlo';

const BAR_BACKGROUND = 'rgba(54, 162, 235, 0.2)';
const BAR_BORDER = 'rgba(54, 162, 235, 1)';
const BURN_DOWN_LINE = 'rgba(0, 0, 0, 0.1)';

export interface ChartConfig<T extends 'bar' | 'line' | 'scatter'> {
  data: ChartData<T>;
  options: ChartOptions<T>;
}

const percentileLine = (
  linePercentile: number,
  axis: 'x' | 'y',
  value: number,
  position: 'start' | 'center',
): AnnotationOptions<'line'> => ({
  type: 'line',
  ...(axis === 'x' ? { xMin: value, xMax: value } : { yMin: value, yMax: value }),
  borderColor: 'red',
  borderWidth: 2,
  borderDash: [2, 2],
  label: {
    display: true,
    content: `p${linePercentile}`,
    position,
    font: { size: 10 },
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});

const baseOptions = (title: string) => ({
  responsive: true,
  animation: false as const,
  plugins: {
    title: { display: true, text: title },
    legend: { display: false },
    tooltip: { enabled: false },
  },
});

/**
 * Index (on a category axis) where the percentile line is drawn: between the bar holding the
 * percentile value and the next bar.
 * Bug fix: when the percentile value is the largest bar, the original page computed -1.5 and the line
 * was not drawn; it is now drawn after the last bar.
 */
export function histogramLineIndex(buckets: number[], lineValue: number): number {
  const next = buckets.findIndex((bucket) => lineValue < bucket);
  return (next === -1 ? buckets.length : next) - 0.5;
}

/** "Duration histogram" bar chart with the percentile line. */
export function histogramChart(durations: number[], linePercentile = 85): ChartConfig<'bar'> {
  const histogram = new Map<number, number>();
  for (const val of durations) histogram.set(val, (histogram.get(val) ?? 0) + 1);
  const buckets = sortNumbers([...histogram.keys()]);
  const lineValue = Math.round(percentile([...durations], linePercentile / 100, true));
  return {
    data: {
      labels: buckets.map(String),
      datasets: [
        {
          data: buckets.map((bucket) => histogram.get(bucket) as number),
          borderWidth: 1,
          backgroundColor: BAR_BACKGROUND,
          borderColor: BAR_BORDER,
        },
      ],
    },
    options: {
      ...baseOptions('Duration histogram'),
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Frequency of occurrences' } },
        x: { title: { display: true, text: 'Calendar weeks' } },
      },
      plugins: {
        ...baseOptions('Duration histogram').plugins,
        annotation: {
          annotations: { percentile: percentileLine(linePercentile, 'x', histogramLineIndex(buckets, lineValue), 'start') },
        },
      },
    },
  };
}

/** "First 100 burn downs" line chart. */
export function burnDownsChart(burnDowns: number[][]): ChartConfig<'line'> {
  const max = Math.max(0, ...burnDowns.map((b) => b.length));
  return {
    data: {
      labels: Array.from({ length: max }, (_v, i) => String(i + 1)),
      datasets: burnDowns.map((burnDown) => ({
        data: burnDown,
        fill: false,
        borderWidth: 1,
        borderColor: BURN_DOWN_LINE,
        pointRadius: 0,
        pointHoverRadius: 0,
      })),
    },
    options: {
      ...baseOptions('First 100 burn downs'),
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Remaining tasks' } },
        x: { title: { display: true, text: 'Week number' } },
      },
    },
  };
}

/** "Effort scatter plot (first 500 runs)" with the percentile line. */
export function effortScatterChart(values: number[], linePercentile = 85): ChartConfig<'scatter'> {
  const lineValue = Math.round(percentile([...values], linePercentile / 100, true));
  return {
    data: {
      datasets: [
        {
          data: values.slice(0, 500).map((y, x) => ({ x, y })),
          pointBackgroundColor: BAR_BACKGROUND,
          pointBorderColor: BAR_BORDER,
        },
      ],
    },
    options: {
      ...baseOptions('Effort scatter plot (first 500 runs)'),
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Effort in person-weeks' } },
      },
      plugins: {
        ...baseOptions('Effort scatter plot (first 500 runs)').plugins,
        annotation: {
          annotations: { percentile: percentileLine(linePercentile, 'y', lineValue, 'center') },
        },
      },
    },
  };
}
