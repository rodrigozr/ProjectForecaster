import { describe, expect, it } from 'vitest';
import { burnDownsChart, effortScatterChart, histogramChart, histogramLineIndex } from '../../src/lib/charts';

describe('charts', () => {
  describe('histogramLineIndex', () => {
    it('places the line right after the bar holding the percentile value', () => {
      expect(histogramLineIndex([1, 2, 3, 4], 2)).toBe(1.5);
      expect(histogramLineIndex([1, 2, 3, 4], 0)).toBe(-0.5);
    });

    it('places the line after the last bar when the value is the largest bucket (bug fix)', () => {
      expect(histogramLineIndex([1, 2, 3], 3)).toBe(2.5);
    });
  });

  describe('histogramChart', () => {
    it('counts the frequency of each duration, sorted numerically', () => {
      const chart = histogramChart([10, 9, 10, 100, 9, 10]);
      expect(chart.data.labels).toEqual(['9', '10', '100']);
      expect(chart.data.datasets[0].data).toEqual([2, 3, 1]);
    });

    it('draws the percentile line with its label, defaulting to p85', () => {
      const chart = histogramChart([1, 2, 3, 4]);
      const line = chart.options.plugins?.annotation?.annotations as Record<string, Record<string, unknown>>;
      expect(line.percentile).toMatchObject({ type: 'line', xMin: 3.5, xMax: 3.5, label: { content: 'p85' } });
      expect(chart.options.plugins?.title).toEqual({ display: true, text: 'Duration histogram' });
    });

    it('does not reorder the input durations', () => {
      const durations = [3, 1, 2];
      histogramChart(durations, 50);
      expect(durations).toEqual([3, 1, 2]);
    });
  });

  describe('burnDownsChart', () => {
    it('creates one line per burn down and week labels up to the longest one', () => {
      const chart = burnDownsChart([[3, 1, 0], [3, 0]]);
      expect(chart.data.labels).toEqual(['1', '2', '3']);
      expect(chart.data.datasets.map((d) => d.data)).toEqual([[3, 1, 0], [3, 0]]);
      expect(chart.options.plugins?.title).toEqual({ display: true, text: 'First 100 burn downs' });
    });

    it('handles no burn downs', () => {
      expect(burnDownsChart([]).data.labels).toEqual([]);
    });
  });

  describe('effortScatterChart', () => {
    it('plots the first 500 values in order with a horizontal percentile line', () => {
      const values = Array.from({ length: 600 }, (_v, i) => 600 - i);
      const chart = effortScatterChart(values, 50);
      expect(chart.data.datasets[0].data).toHaveLength(500);
      expect(chart.data.datasets[0].data[0]).toEqual({ x: 0, y: 600 });
      const line = chart.options.plugins?.annotation?.annotations as Record<string, Record<string, unknown>>;
      expect(line.percentile).toMatchObject({ yMin: 301, yMax: 301, label: { content: 'p50' } });
      expect(values[0]).toBe(600);
    });

    it('defaults to p85', () => {
      const line = effortScatterChart([1, 2]).options.plugins?.annotation?.annotations as Record<
        string,
        { label: { content: string } }
      >;
      expect(line.percentile.label.content).toBe('p85');
    });
  });
});
