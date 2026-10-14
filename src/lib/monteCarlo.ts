/**
 * Standalone Monte Carlo project forecasting engine.
 *
 * This module has no dependencies on any UI framework, browser API or third-party library,
 * so it can be copied into (or imported from) any other JavaScript/TypeScript project.
 */

/** Source of uniformly distributed random numbers in the range [0, 1). */
export type RandomSource = () => number;

/** A project risk that may add tasks to the project when it manifests. */
export interface Risk {
  /** Probability of the risk manifesting. Values >= 1 are treated as a percentage (e.g. 50 = 50%). */
  likelihood: number;
  /** Minimum number of tasks added when the risk manifests. */
  lowImpact: number;
  /** Maximum number of tasks added when the risk manifests. */
  highImpact: number;
  /** Optional human-readable description. */
  description?: string;
}

/** Input data for a Monte Carlo simulation. */
export interface SimulationInput {
  /** Number of simulation rounds to execute. */
  numberOfSimulations: number;
  /** Historical weekly throughput samples (tasks completed per week). */
  tpSamples: number[];
  /** Historical task lead-time samples, in calendar days. */
  ltSamples: number[];
  /** Historical project split rates (actual tasks / planned tasks). */
  splitRateSamples: number[];
  /** Project risks. */
  risks: Risk[];
  /** Planned number of tasks. */
  numberOfTasks: number;
  /** Team size that produced the throughput samples. */
  totalContributors: number;
  /** Minimum number of contributors working on the project (start/end of the S-curve). */
  minContributors: number;
  /** Maximum number of contributors working on the project. */
  maxContributors: number;
  /** Size (in %) of the S-curve at the beginning and at the end of the project (0-50). */
  sCurveSize: number;
}

/** Result of a single simulation round. */
export interface BurnDownResult {
  totalTasks: number;
  durationInCalendarWeeks: number;
  leadTime: number;
  effortWeeks: number;
  burnDown: number[];
}

/** Summary of a single simulation round. */
export type SimulationRound = Omit<BurnDownResult, 'burnDown'>;

/** One row of the results table (one per 5% likelihood step, from 100% down to 0%). */
export interface ResultsTableRow {
  Likelihood: number;
  Duration: number;
  TotalTasks: number;
  Effort: number;
  LT: number;
}

/** Result of a full Monte Carlo simulation. */
export interface SimulationResult {
  simulations: SimulationRound[];
  /** Burn downs of the first 100 simulation rounds. */
  burnDowns: number[][];
  tpErrorRate: number;
  ltErrorRate: number;
  resultsTable: ResultsTableRow[];
}

/**
 * Sorts a numeric array in place (ascending) and returns it.
 */
export function sortNumbers<T extends number[]>(array: T): T {
  return array.sort((a, b) => a - b);
}

/**
 * Returns the value at a given percentile in a sorted numeric array,
 * using the "linear interpolation between closest ranks" method.
 * @param arr sorted numeric array
 * @param p percentile between 0 (p0) and 1 (p100)
 * @param sort if true, the array is sorted (in place) first
 */
export function percentile(arr: number[], p: number, sort = false): number {
  if (arr.length === 0) return 0;
  if (typeof p !== 'number') throw new TypeError('p must be a number');
  if (sort) sortNumbers(arr);
  if (p <= 0) return arr[0];
  if (p >= 1) return arr[arr.length - 1];

  const index = (arr.length - 1) * p;
  const lower = Math.floor(index);
  const upper = lower + 1;
  const weight = index % 1;

  return arr[lower] * (1 - weight) + arr[upper] * weight;
}

/**
 * Generates a random integer between "min" and "max" (both inclusive).
 */
export function randomInteger(min: number, max: number, random: RandomSource = Math.random): number {
  return Math.floor(random() * (max + 1 - min)) + min;
}

/**
 * Retrieves a random element from an array.
 */
export function randomElement<T>(array: T[], random: RandomSource = Math.random): T {
  return array[randomInteger(0, array.length - 1, random)];
}

/**
 * Averages a random number (between min and max) of random samples taken from a numeric array.
 * Returns 0 for an empty array.
 */
export function randomSampleAverage(
  array: number[],
  minNumberOfItems: number,
  maxNumberOfItems: number,
  random: RandomSource = Math.random,
): number {
  if (array.length === 0) return 0;
  const numberOfItems = randomInteger(minNumberOfItems, maxNumberOfItems, random);
  let total = 0;
  for (let i = 0; i < numberOfItems; i++) {
    total += randomElement(array, random);
  }
  return total / numberOfItems;
}

/**
 * Estimates the error rate (0-100) of a sample set: how far apart the averages of two
 * interleaved halves of the sorted samples are, relative to the samples' range.
 * Returns 0 when there are fewer than 2 samples or when all samples are equal.
 */
export function errorRate(array: number[]): number {
  if (array.length <= 1) return 0;
  const sortedArray = sortNumbers([...array]);
  const min = sortedArray[0];
  const max = sortedArray[sortedArray.length - 1];
  // Fix: all-equal samples used to divide by zero and report "NaN%".
  if (max === min) return 0;

  const group1 = sortedArray.filter((_val, index) => index % 2 !== 0);
  const g1avg = group1.reduce((a, b) => a + b, 0) / group1.length;

  const group2 = sortedArray.filter((_val, index) => index % 2 === 0);
  const g2avg = group2.reduce((a, b) => a + b, 0) / group2.length;

  const avgError = Math.abs(g1avg - g2avg);
  return Math.round((100 * avgError) / (max - min));
}

/**
 * Calculates the "S-curve" distribution of contributors over the project.
 * @returns array with exactly 100 elements; position N is the number of contributors at N% completion
 */
export function calculateContributorsDistribution(
  input: Pick<SimulationInput, 'minContributors' | 'maxContributors' | 'sCurveSize'>,
): number[] {
  const { minContributors, maxContributors, sCurveSize } = input;
  const curveSize = Math.max(0, Math.min(50, sCurveSize));
  const curveTailStart = 100 - curveSize;
  const contributorsRange: number[] = [];
  // 0.1 granularity enables fractional contributors such as "5.5" (e.g. someone ramping up).
  for (let i = minContributors; i <= maxContributors; i += 0.1) {
    contributorsRange.push(i);
  }
  const get = (p: number) =>
    Math.min(maxContributors, Math.max(minContributors, Math.round(percentile(contributorsRange, p))));
  const contributorsDistribution: number[] = [];
  for (let i = 0; i < 100; i++) {
    if (i < curveSize) contributorsDistribution.push(get(i / curveSize));
    else if (i < curveTailStart) contributorsDistribution.push(maxContributors);
    else contributorsDistribution.push(get((100 - i) / curveSize));
  }
  return contributorsDistribution;
}

/**
 * Executes a single round of Monte Carlo burn-down simulation.
 * Risk likelihoods must already be normalized to the range [0, 1].
 * @param contributorsDistribution precomputed S-curve (computed from the input when omitted)
 */
export function simulateBurnDown(
  input: SimulationInput,
  random: RandomSource = Math.random,
  contributorsDistribution: number[] = calculateContributorsDistribution(input),
): BurnDownResult {
  const { tpSamples, ltSamples, splitRateSamples, risks, numberOfTasks, totalContributors } = input;

  // Random split rate for this round
  const randomSplitRate = randomSampleAverage(splitRateSamples, 1, splitRateSamples.length * 3, random) || 1.0;

  // Random risk impacts for this round
  let impactTasks = 0;
  for (const risk of risks) {
    if (random() <= risk.likelihood) {
      impactTasks += randomInteger(risk.lowImpact, risk.highImpact, random);
    }
  }

  const totalTasks = Math.round((numberOfTasks + impactTasks) * randomSplitRate);

  // Extend the duration by a random sample average of lead times
  const leadTime =
    randomSampleAverage(ltSamples, Math.round(ltSamples.length * 0.1), Math.round(ltSamples.length * 0.9), random) || 0;
  let durationInCalendarWeeks = Math.round(leadTime / 7);

  let effortWeeks = 0;
  const burnDown: number[] = [];
  let remainingTasks = totalTasks;
  while (remainingTasks > 0) {
    burnDown.push(Math.ceil(remainingTasks));
    const randomTp = randomElement(tpSamples, random);
    const percentComplete = Math.max(0, Math.min(99, Math.round(((totalTasks - remainingTasks) / totalTasks) * 100)));
    const contributorsThisWeek = contributorsDistribution[percentComplete];
    const adjustedTp = randomTp * (contributorsThisWeek / totalContributors);
    remainingTasks -= adjustedTp;
    durationInCalendarWeeks++;
    effortWeeks += contributorsThisWeek;
  }
  burnDown.push(0);
  return { totalTasks, durationInCalendarWeeks, leadTime, effortWeeks, burnDown };
}

/**
 * Normalizes risk likelihoods given as percentages (>= 1) to the range [0, 1].
 * Returns new risk objects; the input is not modified.
 */
export function normalizeRisks(risks: Risk[]): Risk[] {
  return risks.map((risk) => ({
    ...risk,
    likelihood: risk.likelihood >= 1 ? risk.likelihood / 100 : risk.likelihood,
  }));
}

/**
 * Runs a full Monte Carlo simulation.
 * The input is not modified.
 */
export function runMonteCarloSimulation(input: SimulationInput, random: RandomSource = Math.random): SimulationResult {
  // Fix: the original implementation mutated the caller's risk objects (likelihood /= 100).
  const data: SimulationInput = { ...input, risks: normalizeRisks(input.risks) };
  const contributorsDistribution = calculateContributorsDistribution(data);

  const burnDowns: number[][] = [];
  const simulations: SimulationRound[] = [];
  for (let i = 0; i < data.numberOfSimulations; i++) {
    const { burnDown, ...round } = simulateBurnDown(data, random, contributorsDistribution);
    simulations.push(round);
    if (i < 100) burnDowns.push(burnDown);
  }

  const durationHistogram = sortNumbers(simulations.map((s) => s.durationInCalendarWeeks));
  const tasksHistogram = sortNumbers(simulations.map((s) => s.totalTasks));
  const ltHistogram = sortNumbers(simulations.map((s) => s.leadTime));
  const effortHistogram = sortNumbers(simulations.map((s) => s.effortWeeks));

  const resultsTable: ResultsTableRow[] = [];
  for (let p = 100; p >= 0; p -= 5) {
    resultsTable.push({
      Likelihood: p,
      Duration: Math.round(percentile(durationHistogram, p / 100)),
      TotalTasks: Math.round(percentile(tasksHistogram, p / 100)),
      Effort: Math.round(percentile(effortHistogram, p / 100)),
      LT: Math.round(percentile(ltHistogram, p / 100)),
    });
  }

  return {
    simulations,
    burnDowns,
    tpErrorRate: errorRate(data.tpSamples),
    ltErrorRate: errorRate(data.ltSamples),
    resultsTable,
  };
}
