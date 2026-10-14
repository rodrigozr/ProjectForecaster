import { describe, expect, it } from 'vitest';
import {
  calculateContributorsDistribution,
  errorRate,
  normalizeRisks,
  percentile,
  randomElement,
  randomInteger,
  randomSampleAverage,
  runMonteCarloSimulation,
  simulateBurnDown,
  sortNumbers,
  type SimulationInput,
} from '../../src/lib/monteCarlo';
import { seededRandom, sequenceRandom } from '../helpers/random';

const baseInput = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({
  numberOfSimulations: 200,
  tpSamples: [8, 5, 4, 6, 6, 5, 3, 1, 3, 3, 2, 7],
  ltSamples: [13.1, 9, 13.8, 7.2, 8.8, 0.5, 15, 8.2, 21.9, 22.5],
  splitRateSamples: [1.29, 1.56, 1.47, 0.75, 1.25],
  risks: [
    { likelihood: 50, lowImpact: 12, highImpact: 15, description: 'Pentest' },
    { likelihood: 0.75, lowImpact: 5, highImpact: 8, description: 'DB upgrade' },
  ],
  numberOfTasks: 38,
  totalContributors: 10,
  minContributors: 1,
  maxContributors: 5,
  sCurveSize: 20,
  ...overrides,
});


describe('monteCarlo', () => {
  describe('sortNumbers', () => {
    it('sorts numerically in place and returns the same array', () => {
      const arr = [10, 2, 33, 1];
      expect(sortNumbers(arr)).toBe(arr);
      expect(arr).toEqual([1, 2, 10, 33]);
    });
  });

  describe('percentile', () => {
    it('returns 0 for an empty array', () => {
      expect(percentile([], 0.5)).toBe(0);
    });

    it('throws when p is not a number', () => {
      expect(() => percentile([1], '0.5' as unknown as number)).toThrow(TypeError);
    });

    it('returns the first and last elements for p <= 0 and p >= 1', () => {
      expect(percentile([1, 2, 3], -1)).toBe(1);
      expect(percentile([1, 2, 3], 0)).toBe(1);
      expect(percentile([1, 2, 3], 1)).toBe(3);
      expect(percentile([1, 2, 3], 2)).toBe(3);
    });

    it('interpolates linearly between closest ranks', () => {
      expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
      expect(percentile([0, 10], 0.25)).toBe(2.5);
    });

    it('sorts the array first when requested', () => {
      const arr = [4, 1, 3, 2];
      expect(percentile(arr, 0.5, true)).toBe(2.5);
      expect(arr).toEqual([1, 2, 3, 4]);
    });
  });

  describe('randomInteger', () => {
    it('maps the random source onto the inclusive range', () => {
      expect(randomInteger(3, 7, () => 0)).toBe(3);
      expect(randomInteger(3, 7, () => 0.9999)).toBe(7);
      expect(randomInteger(3, 7, () => 0.5)).toBe(5);
    });

    it('defaults to Math.random', () => {
      for (let i = 0; i < 50; i++) {
        const n = randomInteger(1, 3);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('randomElement', () => {
    it('picks an element using the random source', () => {
      expect(randomElement(['a', 'b', 'c'], () => 0)).toBe('a');
      expect(randomElement(['a', 'b', 'c'], () => 0.99)).toBe('c');
    });

    it('defaults to Math.random', () => {
      expect(['a', 'b']).toContain(randomElement(['a', 'b']));
    });
  });

  describe('randomSampleAverage', () => {
    it('returns 0 for an empty array', () => {
      expect(randomSampleAverage([], 1, 3)).toBe(0);
    });

    it('averages a random number of random samples', () => {
      // count = randomInteger(2, 2) -> 2; picks index 0 then index 1
      expect(randomSampleAverage([2, 4], 2, 2, sequenceRandom(0, 0, 0.9))).toBe(3);
    });

    it('returns NaN when zero items are picked (callers fall back with ||)', () => {
      expect(randomSampleAverage([5], 0, 0, () => 0)).toBeNaN();
    });

    it('defaults to Math.random', () => {
      expect(randomSampleAverage([7], 1, 3)).toBe(7);
    });
  });

  describe('errorRate', () => {
    it('returns 0 for fewer than two samples', () => {
      expect(errorRate([])).toBe(0);
      expect(errorRate([5])).toBe(0);
    });

    it('returns 0 when all samples are equal (bug fix: used to be NaN)', () => {
      expect(errorRate([3, 3, 3])).toBe(0);
    });

    it('compares the averages of interleaved halves relative to the range', () => {
      // sorted [1,2,3,10]: odd idx [2,10] avg 6, even idx [1,3] avg 2 -> |4| / 9 -> 44%
      expect(errorRate([10, 1, 3, 2])).toBe(44);
    });

    it('does not modify the input array', () => {
      const arr = [3, 1, 2];
      errorRate(arr);
      expect(arr).toEqual([3, 1, 2]);
    });
  });

  describe('calculateContributorsDistribution', () => {
    it('returns 100 entries ramping up and down over the S-curve', () => {
      const dist = calculateContributorsDistribution({ minContributors: 1, maxContributors: 5, sCurveSize: 20 });
      expect(dist).toHaveLength(100);
      expect(dist[0]).toBe(1);
      expect(dist[10]).toBe(3);
      expect(dist[20]).toBe(5);
      expect(dist[79]).toBe(5);
      expect(dist[80]).toBe(5);
      expect(dist[99]).toBe(1);
    });

    it('uses max contributors everywhere when the S-curve size is 0', () => {
      const dist = calculateContributorsDistribution({ minContributors: 1, maxContributors: 4, sCurveSize: 0 });
      expect(new Set(dist)).toEqual(new Set([4]));
    });

    it('clamps the S-curve size to the range 0-50', () => {
      const big = calculateContributorsDistribution({ minContributors: 2, maxContributors: 6, sCurveSize: 80 });
      const fifty = calculateContributorsDistribution({ minContributors: 2, maxContributors: 6, sCurveSize: 50 });
      expect(big).toEqual(fifty);
      const negative = calculateContributorsDistribution({ minContributors: 2, maxContributors: 6, sCurveSize: -5 });
      expect(new Set(negative)).toEqual(new Set([6]));
    });

    it('supports fractional contributors', () => {
      const dist = calculateContributorsDistribution({ minContributors: 1, maxContributors: 5.5, sCurveSize: 20 });
      expect(dist[50]).toBe(5.5);
      expect(Math.max(...dist)).toBe(5.5);
    });
  });

  describe('normalizeRisks', () => {
    it('converts percentages to fractions without mutating the input', () => {
      const risks = [
        { likelihood: 50, lowImpact: 1, highImpact: 2 },
        { likelihood: 0.3, lowImpact: 1, highImpact: 2 },
      ];
      expect(normalizeRisks(risks).map((r) => r.likelihood)).toEqual([0.5, 0.3]);
      expect(risks[0].likelihood).toBe(50);
    });
  });

  describe('simulateBurnDown', () => {
    it('burns down all tasks and reports duration, effort and lead time', () => {
      const input = baseInput({
        tpSamples: [2],
        ltSamples: [],
        splitRateSamples: [],
        risks: [],
        numberOfTasks: 4,
        totalContributors: 1,
        minContributors: 1,
        maxContributors: 1,
        sCurveSize: 0,
      });
      const res = simulateBurnDown(input, () => 0);
      expect(res).toEqual({
        totalTasks: 4,
        durationInCalendarWeeks: 2,
        leadTime: 0,
        effortWeeks: 2,
        burnDown: [4, 2, 0],
      });
    });

    it('adds risk impacts when the risk manifests and applies the split rate', () => {
      const input = baseInput({
        tpSamples: [10],
        ltSamples: [14],
        splitRateSamples: [2],
        risks: [
          { likelihood: 1, lowImpact: 3, highImpact: 3 },
          { likelihood: 0, lowImpact: 50, highImpact: 50 },
        ],
        numberOfTasks: 2,
        totalContributors: 1,
        minContributors: 1,
        maxContributors: 1,
        sCurveSize: 0,
      });
      const res = simulateBurnDown(input, sequenceRandom(0.5));
      // (2 + 3) * 2 = 10 tasks; lead time 14 days adds 2 weeks; 1 week of work
      expect(res.totalTasks).toBe(10);
      expect(res.leadTime).toBe(14);
      expect(res.durationInCalendarWeeks).toBe(3);
      expect(res.burnDown).toEqual([10, 0]);
    });

    it('defaults to Math.random and computes the S-curve when not provided', () => {
      const res = simulateBurnDown(baseInput({ risks: normalizeRisks(baseInput().risks) }));
      expect(res.burnDown.at(-1)).toBe(0);
      expect(res.totalTasks).toBeGreaterThan(0);
    });

    it('returns an empty burn down (just 0) when there are no tasks', () => {
      const res = simulateBurnDown(baseInput({ numberOfTasks: 0, risks: [] }), () => 0);
      expect(res.burnDown).toEqual([0]);
      expect(res.effortWeeks).toBe(0);
    });
  });

  describe('runMonteCarloSimulation', () => {
    it('produces simulations, the first 100 burn downs, error rates and a results table', () => {
      const res = runMonteCarloSimulation(baseInput(), seededRandom(42));
      expect(res.simulations).toHaveLength(200);
      expect(res.burnDowns).toHaveLength(100);
      expect(res.resultsTable.map((r) => r.Likelihood)).toEqual([
        100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0,
      ]);
      expect(res.resultsTable[0].Duration).toBeGreaterThanOrEqual(res.resultsTable[20].Duration);
      expect(res.tpErrorRate).toBe(errorRate(baseInput().tpSamples));
      expect(res.ltErrorRate).toBe(errorRate(baseInput().ltSamples));
    });

    it('does not mutate the input risks (bug fix)', () => {
      const input = baseInput();
      runMonteCarloSimulation(input, seededRandom(1));
      expect(input.risks[0].likelihood).toBe(50);
    });

    it('defaults to Math.random', () => {
      expect(runMonteCarloSimulation(baseInput({ numberOfSimulations: 5 })).simulations).toHaveLength(5);
    });

  });
});
