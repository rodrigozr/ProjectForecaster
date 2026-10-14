/**
 * Presentation helpers for simulation results: dates, likelihood comments, summary and text report.
 * Framework-agnostic.
 */
import { percentile, type ResultsTableRow, type SimulationResult } from './monteCarlo';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** English ordinal suffix for a day of the month (1st, 2nd, 3rd, 4th, 11th, 21st...). */
export function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][day % 10] ?? 'th';
  return `${day}${suffix}`;
}

/**
 * Parses a date. "YYYY-MM-DD" (the format of date inputs) is parsed as local time;
 * anything else falls back to the Date constructor.
 */
export function parseDate(text: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(text);
}

/**
 * Adds a number of weeks to a date and formats it as "MMM Do YYYY" (e.g. "Sep 7th 2020"),
 * matching the format of the original page. Returns "Invalid date" for unparseable dates.
 */
export function addWeeksAndFormat(startDate: string, weeks: number): string {
  const date = parseDate(startDate);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  date.setDate(date.getDate() + weeks * 7);
  return `${MONTHS[date.getMonth()]} ${ordinal(date.getDate())} ${date.getFullYear()}`;
}

export type CertaintyLevel = 'almost-certain' | 'somewhat-certain' | 'not-certain';

/** Classifies a likelihood (0-100). */
export function certaintyLevel(likelihood: number): CertaintyLevel {
  if (likelihood > 80) return 'almost-certain';
  if (likelihood > 45) return 'somewhat-certain';
  return 'not-certain';
}

const COMMENTS: Record<CertaintyLevel, string> = {
  'almost-certain': 'Almost certain',
  'somewhat-certain': 'Somewhat certain',
  'not-certain': 'Less than coin-toss odds',
};

/** Human-readable comment for a likelihood (0-100). */
export function likelihoodComment(likelihood: number): string {
  return COMMENTS[certaintyLevel(likelihood)];
}

/** Text shown when no start date is set. */
export const NO_START_DATE = '(No start date set)';

export interface ForecastSummary {
  confidenceLevel: number;
  effort: number;
  duration: number;
  /** Formatted delivery date, or NO_START_DATE */
  endDate: string;
}

/** Calculates the forecast summary at the given confidence level (1-99). */
export function summarize(result: SimulationResult, confidenceLevel: number, startDate?: string): ForecastSummary {
  const p = confidenceLevel / 100;
  const effort = Math.round(percentile(result.simulations.map((s) => s.effortWeeks), p, true));
  const duration = Math.round(percentile(result.simulations.map((s) => s.durationInCalendarWeeks), p, true));
  const endDate = startDate ? addWeeksAndFormat(startDate, duration) : NO_START_DATE;
  return { confidenceLevel, effort, duration, endDate };
}

export interface ProbabilityRow extends ResultsTableRow {
  /** Formatted delivery date, or '' when there is no start date */
  date: string;
  comment: string;
  level: CertaintyLevel;
}

/** Builds the rows of the "All probabilities" table. */
export function probabilityRows(result: SimulationResult, startDate?: string): ProbabilityRow[] {
  return result.resultsTable.map((row) => ({
    ...row,
    date: startDate ? addWeeksAndFormat(startDate, row.Duration) : '',
    comment: likelihoodComment(row.Likelihood),
    level: certaintyLevel(row.Likelihood),
  }));
}

/** Number of probability rows shown before "Show more..." is clicked. */
export const INITIAL_PROBABILITY_ROWS = 9;

/**
 * Builds the plain-text "Simulation report" (same content as the original page).
 * @param elapsedMs time the simulation took, in milliseconds
 */
export function buildReport(
  result: SimulationResult,
  summary: ForecastSummary,
  numberOfSimulations: number,
  elapsedMs: number,
  hasStartDate: boolean,
): string {
  const { confidenceLevel, effort, duration, endDate } = summary;
  // Bug fix: a simulation faster than 1 ms used to report "Infinity simulations per second".
  const perSecond = Math.round((numberOfSimulations / Math.max(1, elapsedMs)) * 1000);
  const lines: string[] = [
    `Project forecast summary (with ${confidenceLevel}% of confidence):\n`,
    ` - Up to ${effort} person-weeks of effort\n`,
    ` - Can be delivered in up to ${duration} calendar weeks\n`,
  ];
  if (hasStartDate) lines.push(` - Can be delivered by ${endDate}\n`);
  lines.push(
    `\n\n`,
    `-----------------------------------------------------\n`,
    `                       DETAILS\n`,
    `-----------------------------------------------------\n`,
    `Elapsed time: ${elapsedMs} ms (${perSecond} simulations per second)\n`,
    'All probabilities:\n',
    `  Likelihood\tDuration\tTasks\tEffort          \tComment\n`,
  );
  for (const res of result.resultsTable) {
    const comment = likelihoodComment(res.Likelihood);
    lines.push(
      `  ${res.Likelihood}%      \t${res.Duration} weeks \t${res.TotalTasks}\t${res.Effort} person-weeks  \t(${comment})\n`,
    );
  }
  lines.push(
    `\n`,
    `Error rates:\n - Weekly throughput: ${result.tpErrorRate}%\n - Task lead-times: ${result.ltErrorRate}%\n`,
    `  (Aim to keep these below 25% by adding more sample data. (< 10% Great, < 25% Good)\n`,
    `   This is the measure of how two random groups of your sample data would align when forecasting.\n`,
    `   Anything below 25% is good, but lower is better. It grows if there is too little data\n`,
    `   and ALSO if the process changes over time and you use too much data.)\n`,
  );
  return lines.join('');
}
