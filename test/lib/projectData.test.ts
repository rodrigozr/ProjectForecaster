import { describe, expect, it } from 'vitest';
import {
  applyInProgress,
  calculateFields,
  decodeHash,
  defaultFormState,
  emptyRiskRow,
  encodeHash,
  formFromData,
  isInProgress,
  parseRisks,
  parseSamples,
  readForm,
  type FormState,
  type ProjectData,
} from '../../src/lib/projectData';
import { README_SAMPLE_HASH } from '../helpers/fixtures';


const validForm = (overrides: Partial<FormState> = {}): FormState => ({
  ...defaultFormState(),
  tpSamples: '3 4,5\n6',
  ...overrides,
});

const legacyEncode = (data: unknown) => '#' + btoa(JSON.stringify(data));

describe('projectData', () => {
  describe('defaultFormState', () => {
    it('uses the same defaults as the original page', () => {
      const form = defaultFormState();
      expect(form).toMatchObject({
        totalContributors: '1',
        numberOfTasks: '1',
        numberOfSimulations: '100000',
        sCurveSize: '20',
        confidenceLevel: '85',
      });
      expect(form.risks).toEqual([emptyRiskRow()]);
    });
  });

  describe('parseSamples', () => {
    it('returns an empty array for blank text', () => {
      expect(parseSamples('   ')).toEqual([]);
    });

    it('splits on spaces, new lines and commas, ignoring invalid and negative values', () => {
      expect(parseSamples('1, 2\n3\t4  x -5 0 1.5')).toEqual([1, 2, 3, 4, 0, 1.5]);
    });
  });

  describe('parseRisks', () => {
    it('ignores rows without a likelihood or without any impact', () => {
      expect(
        parseRisks([
          { likelihood: '', lowImpact: '1', highImpact: '2', description: 'a' },
          { likelihood: '10', lowImpact: '', highImpact: '', description: 'b' },
        ]),
      ).toEqual([]);
    });

    it('defaults a missing low impact to 1 and a missing high impact to the low impact', () => {
      expect(
        parseRisks([
          { likelihood: '50', lowImpact: '', highImpact: '7', description: 'low missing' },
          { likelihood: '25', lowImpact: '4', highImpact: '', description: 'high missing' },
          { likelihood: 'x', lowImpact: 'y', highImpact: 'z', description: 'invalid numbers' },
        ]),
      ).toEqual([
        { likelihood: 50, lowImpact: 1, highImpact: 7, description: 'low missing' },
        { likelihood: 25, lowImpact: 4, highImpact: 4, description: 'high missing' },
        { likelihood: 0, lowImpact: 0, highImpact: 0, description: 'invalid numbers' },
      ]);
    });
  });

  describe('readForm', () => {
    it('converts a valid form into project data', () => {
      const result = readForm(
        validForm({
          projectName: 'P',
          totalContributors: '4.56',
          minContributors: '1',
          maxContributors: '3.33',
          numberOfTasks: '20',
          startDate: '2020-01-01',
          currentDate: '2020-02-01',
          completedTasks: '5',
          remainingTasks: '10',
          ltSamples: '1 2',
          splitRateSamples: '1.1',
          risks: [{ likelihood: '50', lowImpact: '1', highImpact: '2', description: 'r' }],
        }),
      );
      expect(result).toEqual({
        ok: true,
        data: {
          projectName: 'P',
          numberOfSimulations: 100000,
          confidenceLevel: 85,
          tpSamples: [3, 4, 5, 6],
          ltSamples: [1, 2],
          splitRateSamples: [1.1],
          risks: [{ likelihood: 50, lowImpact: 1, highImpact: 2, description: 'r' }],
          numberOfTasks: 20,
          totalContributors: 4.6,
          minContributors: 1,
          maxContributors: 3.3,
          sCurveSize: 20,
          startDate: '2020-01-01',
          currentDate: '2020-02-01',
          completedTasks: 5,
          remainingTasks: 10,
        },
      });
    });

    it('defaults min/max contributors to the team size and optional fields to undefined', () => {
      const result = readForm(validForm({ totalContributors: '3', confidenceLevel: '', sCurveSize: '' }));
      expect(result.ok && result.data).toMatchObject({
        minContributors: 3,
        maxContributors: 3,
        confidenceLevel: 85,
        sCurveSize: 0,
        startDate: undefined,
        currentDate: undefined,
        completedTasks: undefined,
        remainingTasks: undefined,
      });
    });

    it.each([
      ['no throughput sample >= 1', { tpSamples: '0 0.5' }, 'Must have at least one weekly throughput sample greater than zero'],
      ['split rate too high', { splitRateSamples: '11' }, "Your split rates don't seem correct."],
      ['split rate too low', { splitRateSamples: '0.1' }, "Your split rates don't seem correct."],
      ['empty team size', { totalContributors: '' }, 'Team size must be greater than zero'],
      ['empty number of tasks', { numberOfTasks: '' }, 'Planned number of tasks is required'],
      ['zero simulations', { numberOfSimulations: '0' }, 'Number of simulations must be greater than zero'],
    ])('rejects %s', (_name, overrides, error) => {
      const result = readForm(validForm(overrides));
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toContain(error);
    });
  });

  describe('formFromData', () => {
    it('fills every field by name, joining arrays with commas', () => {
      const form = formFromData({
        projectName: 'X',
        tpSamples: [1, 2],
        numberOfTasks: 5,
        startDate: null,
        risks: [{ likelihood: 50, lowImpact: 1, highImpact: 2, description: 'd' }],
      });
      expect(form.projectName).toBe('X');
      expect(form.tpSamples).toBe('1,2');
      expect(form.numberOfTasks).toBe('5');
      expect(form.startDate).toBe('');
      expect(form.risks).toEqual([{ likelihood: '50', lowImpact: '1', highImpact: '2', description: 'd' }]);
    });

    it('leaves fields missing from old URLs empty and removes all risk rows', () => {
      const form = formFromData({ tpSamples: [1] });
      expect(form.totalContributors).toBe('');
      expect(form.currentDate).toBe('');
      expect(form.risks).toEqual([]);
    });

    it('handles risks with missing fields', () => {
      expect(formFromData({ risks: [{}] }).risks).toEqual([emptyRiskRow()]);
    });
  });

  describe('isInProgress', () => {
    it('requires start date, current date and remaining tasks', () => {
      expect(isInProgress({ startDate: 'a', currentDate: 'b', remainingTasks: '1' })).toBe(true);
      expect(isInProgress({ startDate: 'a', currentDate: 'b', remainingTasks: '' })).toBe(false);
      expect(isInProgress({ startDate: '', currentDate: 'b', remainingTasks: '1' })).toBe(false);
    });
  });

  describe('applyInProgress', () => {
    const data = (overrides: Partial<ProjectData> = {}): ProjectData => {
      const result = readForm(validForm({ numberOfTasks: '100', ltSamples: '1 2' }));
      if (!result.ok) throw new Error(result.error);
      return { ...result.data, ...overrides };
    };

    it('does nothing for projects that are not in progress', () => {
      const input = data({ startDate: '2020-01-01', remainingTasks: 10 });
      expect(applyInProgress(input)).toEqual(input);
    });

    it('forecasts remaining tasks from the current date, keeping lead times when nothing was completed', () => {
      const result = applyInProgress(
        data({ startDate: '2020-01-01', currentDate: '2020-03-01', remainingTasks: 40, completedTasks: 0 }),
      );
      expect(result).toMatchObject({ numberOfTasks: 40, startDate: '2020-03-01', ltSamples: [1, 2], sCurveSize: 20 });
    });

    it('drops lead times and halves the S-curve when enough tasks were completed', () => {
      const input = data({ startDate: '2020-01-01', currentDate: '2020-03-01', remainingTasks: 40, completedTasks: 9 });
      const result = applyInProgress(input);
      expect(result).toMatchObject({ numberOfTasks: 40, ltSamples: [], sCurveSize: 10 });
      expect(input.numberOfTasks).toBe(100);
    });

    it('keeps the S-curve when few tasks were completed or when it is 0', () => {
      const base = { startDate: '2020-01-01', currentDate: '2020-03-01', remainingTasks: 40 };
      expect(applyInProgress(data({ ...base, completedTasks: 8 })).sCurveSize).toBe(20);
      expect(applyInProgress(data({ ...base, completedTasks: 8, sCurveSize: 0 })).sCurveSize).toBe(0);
    });
  });

  describe('calculateFields', () => {
    it('is empty until both planned and actual tasks are known', () => {
      const empty = { actualTasks: '', actualSplitRate: '', splitRateStatus: '' };
      expect(calculateFields({ completedTasks: '', remainingTasks: '', numberOfTasks: '10' })).toEqual(empty);
      expect(calculateFields({ completedTasks: '1', remainingTasks: '', numberOfTasks: '' })).toEqual(empty);
    });

    it('calculates actual tasks and split rate status', () => {
      expect(calculateFields({ completedTasks: '6', remainingTasks: '6', numberOfTasks: '10' })).toEqual({
        actualTasks: '12',
        actualSplitRate: '1.20',
        splitRateStatus: 'over',
      });
      expect(calculateFields({ completedTasks: '5', remainingTasks: '5', numberOfTasks: '10' }).splitRateStatus).toBe('exact');
      expect(calculateFields({ completedTasks: '2', remainingTasks: '-3', numberOfTasks: '10' })).toEqual({
        actualTasks: '2',
        actualSplitRate: '0.20',
        splitRateStatus: 'under',
      });
    });
  });

  describe('encodeHash / decodeHash', () => {
    it('opens the README sample URL generated by the original version', () => {
      const data = decodeHash(README_SAMPLE_HASH);
      expect(data).toMatchObject({ projectName: 'Test project', numberOfTasks: 38, startDate: '2020-09-07' });
    });

    it('produces exactly the same hash as the original version for ASCII data', () => {
      const data = decodeHash(README_SAMPLE_HASH) as unknown as ProjectData;
      expect(encodeHash(data)).toBe(README_SAMPLE_HASH);
    });

    it('round-trips non-Latin1 characters (bug fix: btoa used to throw)', () => {
      const result = readForm(validForm({ projectName: 'Projeto 🚀 日本' }));
      if (!result.ok) throw new Error(result.error);
      expect(decodeHash(encodeHash(result.data))).toEqual(JSON.parse(JSON.stringify(result.data)));
    });

    it('decodes legacy Latin-1 hashes', () => {
      expect(decodeHash(legacyEncode({ projectName: 'Previsão café' }))).toEqual({ projectName: 'Previsão café' });
    });

    it('decodes URL-escaped, URL-safe and unpadded base64', () => {
      const hash = legacyEncode({ projectName: 'a?>' }); // contains '+' / '/' characters
      const padded = legacyEncode({ projectName: 'ab' }); // ends with '='
      expect(padded.endsWith('=')).toBe(true);
      expect(decodeHash(padded.replace(/=/g, '%3D'))).toEqual({ projectName: 'ab' });
      expect(decodeHash(hash.replace(/=+$/, ''))).toEqual({ projectName: 'a?>' });
      expect(decodeHash(hash.replace(/\+/g, '-').replace(/\//g, '_'))).toEqual({ projectName: 'a?>' });
      expect(decodeHash(`  ${hash}  `)).toEqual({ projectName: 'a?>' });
    });

    it('returns null for empty or invalid hashes', () => {
      expect(decodeHash('')).toBeNull();
      expect(decodeHash('#')).toBeNull();
      expect(decodeHash('#not base64!')).toBeNull();
      expect(decodeHash(legacyEncode('just a string'))).toBeNull();
      expect(decodeHash(legacyEncode(null))).toBeNull();
      expect(decodeHash(legacyEncode([1]))).toBeNull();
      expect(decodeHash('#' + btoa('{broken'))).toBeNull();
    });
  });
});
