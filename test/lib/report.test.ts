import { describe, expect, it } from 'vitest';
import type { SimulationResult } from '../../src/lib/monteCarlo';
import {
  addWeeksAndFormat,
  buildReport,
  certaintyLevel,
  INITIAL_PROBABILITY_ROWS,
  likelihoodComment,
  NO_START_DATE,
  ordinal,
  parseDate,
  probabilityRows,
  summarize,
} from '../../src/lib/report';

const result = (): SimulationResult => ({
  simulations: [
    { durationInCalendarWeeks: 10, totalTasks: 20, leadTime: 1, effortWeeks: 30 },
    { durationInCalendarWeeks: 20, totalTasks: 40, leadTime: 2, effortWeeks: 60 },
  ],
  burnDowns: [],
  tpErrorRate: 12,
  ltErrorRate: 34,
  resultsTable: [
    { Likelihood: 100, Duration: 20, TotalTasks: 40, Effort: 60, LT: 2 },
    { Likelihood: 50, Duration: 15, TotalTasks: 30, Effort: 45, LT: 2 },
    { Likelihood: 0, Duration: 10, TotalTasks: 20, Effort: 30, LT: 1 },
  ],
});

describe('report', () => {
  describe('ordinal', () => {
    it.each([
      [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [10, '10th'], [11, '11th'], [12, '12th'], [13, '13th'],
      [21, '21st'], [22, '22nd'], [23, '23rd'], [30, '30th'], [31, '31st'], [111, '111th'],
    ])('formats %i as %s', (day, expected) => {
      expect(ordinal(day)).toBe(expected);
    });
  });

  describe('parseDate', () => {
    it('parses YYYY-MM-DD as a local date', () => {
      const date = parseDate('2020-09-07');
      expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2020, 8, 7, 0]);
    });

    it('falls back to the Date constructor for other formats', () => {
      expect(parseDate('2020/09/07').getDate()).toBe(7);
      expect(Number.isNaN(parseDate('nope').getTime())).toBe(true);
    });
  });

  describe('addWeeksAndFormat', () => {
    it('adds weeks and formats as "MMM Do YYYY" like moment did', () => {
      expect(addWeeksAndFormat('2020-09-07', 0)).toBe('Sep 7th 2020');
      expect(addWeeksAndFormat('2020-09-07', 17)).toBe('Jan 4th 2021');
      expect(addWeeksAndFormat('2020-12-31', 1)).toBe('Jan 7th 2021');
    });

    it('returns "Invalid date" for invalid dates', () => {
      expect(addWeeksAndFormat('garbage', 1)).toBe('Invalid date');
    });
  });

  describe('certaintyLevel / likelihoodComment', () => {
    it.each([
      [100, 'almost-certain', 'Almost certain'],
      [81, 'almost-certain', 'Almost certain'],
      [80, 'somewhat-certain', 'Somewhat certain'],
      [46, 'somewhat-certain', 'Somewhat certain'],
      [45, 'not-certain', 'Less than coin-toss odds'],
      [0, 'not-certain', 'Less than coin-toss odds'],
    ])('classifies %i%% as %s', (likelihood, level, comment) => {
      expect(certaintyLevel(likelihood)).toBe(level);
      expect(likelihoodComment(likelihood)).toBe(comment);
    });
  });

  describe('summarize', () => {
    it('reports effort and duration at the confidence level, with the delivery date', () => {
      expect(summarize(result(), 50, '2020-09-07')).toEqual({
        confidenceLevel: 50,
        effort: 45,
        duration: 15,
        endDate: 'Dec 21st 2020',
      });
    });

    it('reports that no start date is set', () => {
      expect(summarize(result(), 85).endDate).toBe(NO_START_DATE);
    });
  });

  describe('probabilityRows', () => {
    it('adds dates, comments and certainty levels', () => {
      const rows = probabilityRows(result(), '2020-09-07');
      expect(rows[0]).toEqual({
        Likelihood: 100, Duration: 20, TotalTasks: 40, Effort: 60, LT: 2,
        date: 'Jan 25th 2021', comment: 'Almost certain', level: 'almost-certain',
      });
      expect(rows.map((r) => r.level)).toEqual(['almost-certain', 'somewhat-certain', 'not-certain']);
    });

    it('leaves dates empty without a start date', () => {
      expect(probabilityRows(result()).every((r) => r.date === '')).toBe(true);
    });

    it('shows 9 rows before "Show more..."', () => {
      expect(INITIAL_PROBABILITY_ROWS).toBe(9);
    });
  });

  describe('buildReport', () => {
    it('builds the same text report as the original page', () => {
      const res = result();
      const text = buildReport(res, summarize(res, 50, '2020-09-07'), 1000, 4, true);
      expect(text).toBe(
        'Project forecast summary (with 50% of confidence):\n' +
          ' - Up to 45 person-weeks of effort\n' +
          ' - Can be delivered in up to 15 calendar weeks\n' +
          ' - Can be delivered by Dec 21st 2020\n' +
          '\n\n' +
          '-----------------------------------------------------\n' +
          '                       DETAILS\n' +
          '-----------------------------------------------------\n' +
          'Elapsed time: 4 ms (250000 simulations per second)\n' +
          'All probabilities:\n' +
          '  Likelihood\tDuration\tTasks\tEffort          \tComment\n' +
          '  100%      \t20 weeks \t40\t60 person-weeks  \t(Almost certain)\n' +
          '  50%      \t15 weeks \t30\t45 person-weeks  \t(Somewhat certain)\n' +
          '  0%      \t10 weeks \t20\t30 person-weeks  \t(Less than coin-toss odds)\n' +
          '\n' +
          'Error rates:\n - Weekly throughput: 12%\n - Task lead-times: 34%\n' +
          '  (Aim to keep these below 25% by adding more sample data. (< 10% Great, < 25% Good)\n' +
          '   This is the measure of how two random groups of your sample data would align when forecasting.\n' +
          '   Anything below 25% is good, but lower is better. It grows if there is too little data\n' +
          '   and ALSO if the process changes over time and you use too much data.)\n',
      );
    });

    it('omits the delivery date line without a start date', () => {
      const res = result();
      expect(buildReport(res, summarize(res, 50), 10, 5, false)).not.toContain('Can be delivered by');
    });

    it('does not report infinite speed for sub-millisecond runs (bug fix)', () => {
      const res = result();
      expect(buildReport(res, summarize(res, 50), 10, 0, false)).toContain('Elapsed time: 0 ms (10000 simulations per second)');
    });
  });
});
