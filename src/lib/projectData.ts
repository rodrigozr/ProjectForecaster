/**
 * Conversion between the editable form state, the simulation data model, the
 * shareable URL hash and exported project files. Framework-agnostic (no React / DOM dependencies besides atob/btoa).
 *
 * URL format (unchanged since v1): `#` + base64(JSON.stringify(ProjectData)).
 * File format: `<Project Name>.fcast.json` containing the same ProjectData JSON, pretty-printed.
 */
import type { Risk, SimulationInput } from './monteCarlo';

/** Full data model persisted in the URL hash. */
export interface ProjectData extends SimulationInput {
  projectName: string;
  confidenceLevel: number;
  startDate?: string;
  currentDate?: string;
  completedTasks?: number;
  remainingTasks?: number;
}

/** Editable risk row (all text, as typed by the user). */
export interface RiskRow {
  likelihood: string;
  lowImpact: string;
  highImpact: string;
  description: string;
}

/** Editable form state (all text, as typed by the user). */
export interface FormState {
  projectName: string;
  totalContributors: string;
  minContributors: string;
  maxContributors: string;
  numberOfTasks: string;
  numberOfSimulations: string;
  sCurveSize: string;
  confidenceLevel: string;
  startDate: string;
  currentDate: string;
  completedTasks: string;
  remainingTasks: string;
  tpSamples: string;
  ltSamples: string;
  splitRateSamples: string;
  risks: RiskRow[];
}

export const DEFAULT_NUMBER_OF_SIMULATIONS = 100000;
export const DEFAULT_CONFIDENCE_LEVEL = 85;

export const emptyRiskRow = (): RiskRow => ({ likelihood: '', lowImpact: '', highImpact: '', description: '' });

/** Initial form values (same defaults as the original page). */
export const defaultFormState = (): FormState => ({
  projectName: '',
  totalContributors: '1',
  minContributors: '',
  maxContributors: '',
  numberOfTasks: '1',
  numberOfSimulations: String(DEFAULT_NUMBER_OF_SIMULATIONS),
  sCurveSize: '20',
  confidenceLevel: String(DEFAULT_CONFIDENCE_LEVEL),
  startDate: '',
  currentDate: '',
  completedTasks: '',
  remainingTasks: '',
  tpSamples: '',
  ltSamples: '',
  splitRateSamples: '',
  risks: [emptyRiskRow()],
});

/** Text fields of the form that are filled from the URL by name. */
const TEXT_FIELDS = [
  'projectName',
  'totalContributors',
  'minContributors',
  'maxContributors',
  'numberOfTasks',
  'numberOfSimulations',
  'sCurveSize',
  'confidenceLevel',
  'startDate',
  'currentDate',
  'completedTasks',
  'remainingTasks',
  'tpSamples',
  'ltSamples',
  'splitRateSamples',
] as const satisfies readonly Exclude<keyof FormState, 'risks'>[];

/**
 * Parses samples separated by spaces, new lines or commas. Non-numeric and negative values are ignored.
 */
export function parseSamples(text: string): number[] {
  if (text.trim().length === 0) return [];
  return text
    .split(/[\s,]/)
    .filter((s) => s.trim().length > 0)
    .map(Number)
    .filter((n) => n >= 0);
}

/**
 * Converts risk rows into risks. A row is used when it has a likelihood and at least one impact;
 * a missing low impact defaults to 1, and a missing high impact defaults to the low impact.
 */
export function parseRisks(rows: RiskRow[]): Risk[] {
  const risks: Risk[] = [];
  for (const row of rows) {
    let { lowImpact, highImpact } = row;
    if (!row.likelihood || !(lowImpact || highImpact)) continue;
    if (!lowImpact) lowImpact = '1';
    else if (!highImpact) highImpact = lowImpact;
    risks.push({
      likelihood: parseInt(row.likelihood) || 0,
      lowImpact: parseInt(lowImpact) || 0,
      highImpact: parseInt(highImpact) || 0,
      description: row.description,
    });
  }
  return risks;
}

const toOneDecimal = (text: string) => Number(Number(text).toFixed(1));
const optionalInt = (text: string) => (text ? parseInt(text) : undefined);

export type ReadResult = { ok: true; data: ProjectData } | { ok: false; error: string };

/**
 * Validates the form and converts it into simulation data (same rules as the original page).
 */
export function readForm(form: FormState): ReadResult {
  const tpSamples = parseSamples(form.tpSamples);
  const splitRateSamples = parseSamples(form.splitRateSamples);
  const totalContributors = toOneDecimal(form.totalContributors);
  const numberOfTasks = parseInt(form.numberOfTasks);
  const numberOfSimulations = parseInt(form.numberOfSimulations);

  if (!tpSamples.some((n) => n >= 1)) {
    return { ok: false, error: 'Must have at least one weekly throughput sample greater than zero' };
  }
  if (splitRateSamples.some((n) => n > 10 || n < 0.2)) {
    return {
      ok: false,
      error:
        "Your split rates don't seem correct.\nFor a 10% split rate in a project, you should put '1.1', for example. Please correct before proceeding",
    };
  }
  // Bug fix: these mandatory fields used to be accepted when empty/invalid, producing NaN or empty results.
  if (!(totalContributors > 0)) {
    return { ok: false, error: 'Team size must be greater than zero' };
  }
  if (!(numberOfTasks >= 0)) {
    return { ok: false, error: 'Planned number of tasks is required' };
  }
  if (!(numberOfSimulations > 0)) {
    return { ok: false, error: 'Number of simulations must be greater than zero' };
  }

  const data: ProjectData = {
    projectName: form.projectName,
    numberOfSimulations,
    confidenceLevel: parseInt(form.confidenceLevel) || DEFAULT_CONFIDENCE_LEVEL,
    tpSamples,
    ltSamples: parseSamples(form.ltSamples),
    splitRateSamples,
    risks: parseRisks(form.risks),
    numberOfTasks,
    totalContributors,
    minContributors: toOneDecimal(form.minContributors) || totalContributors,
    maxContributors: toOneDecimal(form.maxContributors) || totalContributors,
    // Bug fix: an empty S-curve size used to turn every contributor count into NaN. Empty now means 0%.
    sCurveSize: parseInt(form.sCurveSize) || 0,
    startDate: form.startDate || undefined,
    currentDate: form.currentDate || undefined,
    completedTasks: optionalInt(form.completedTasks),
    remainingTasks: optionalInt(form.remainingTasks),
  };
  return { ok: true, data };
}

const fieldText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(',');
  return String(value);
};

/**
 * Builds the form state from (possibly partial / old-format) data loaded from a URL.
 * Like the original page, every field missing from the data is left empty.
 */
export function formFromData(data: Partial<Record<keyof ProjectData, unknown>>): FormState {
  const form = { ...defaultFormState(), risks: [] as RiskRow[] };
  for (const field of TEXT_FIELDS) {
    form[field] = fieldText(data[field]);
  }
  if (Array.isArray(data.risks)) {
    form.risks = (data.risks as Partial<Record<keyof Risk, unknown>>[]).map((risk) => ({
      likelihood: fieldText(risk.likelihood),
      lowImpact: fieldText(risk.lowImpact),
      highImpact: fieldText(risk.highImpact),
      description: fieldText(risk.description),
    }));
  }
  return form;
}

/** Whether the form describes an in-progress project (start date, current date and remaining tasks). */
export function isInProgress(form: Pick<FormState, 'startDate' | 'currentDate' | 'remainingTasks'>): boolean {
  return Boolean(form.startDate && form.currentDate && form.remainingTasks);
}

/**
 * Adjusts the simulation data to forecast only the remaining work of an in-progress project.
 * Returns a new object; the input is not modified.
 */
export function applyInProgress(data: ProjectData): ProjectData {
  const result = { ...data };
  if (result.startDate && result.currentDate && result.remainingTasks) {
    result.numberOfTasks = result.remainingTasks;
    result.startDate = result.currentDate;
    if (result.completedTasks && result.completedTasks > 0) {
      result.ltSamples = [];
      if (result.sCurveSize && result.completedTasks > result.numberOfTasks * (result.sCurveSize / 100)) {
        result.sCurveSize = Math.round(result.sCurveSize / 2);
      }
    }
  }
  return result;
}

export interface CalculatedFields {
  actualTasks: string;
  actualSplitRate: string;
  /** 'over' when more tasks than planned, 'under' when fewer, 'exact' when equal, '' when not calculated */
  splitRateStatus: 'over' | 'under' | 'exact' | '';
}

/** Calculates "Actual number of tasks" and "Actual split rate" for in-progress tracking. */
export function calculateFields(form: Pick<FormState, 'completedTasks' | 'remainingTasks' | 'numberOfTasks'>): CalculatedFields {
  const value = (text: string) => Math.max(0, parseInt(text) || 0);
  const actualTasks = value(form.completedTasks) + value(form.remainingTasks);
  const plannedTasks = value(form.numberOfTasks);
  if (!plannedTasks || !actualTasks) {
    return { actualTasks: '', actualSplitRate: '', splitRateStatus: '' };
  }
  const splitRate = actualTasks / plannedTasks;
  return {
    actualTasks: String(actualTasks),
    actualSplitRate: splitRate.toFixed(2),
    splitRateStatus: splitRate > 1 ? 'over' : splitRate === 1 ? 'exact' : 'under',
  };
}

/**
 * Encodes data as a URL hash. ASCII-only data produces exactly the same hash as the original page;
 * other characters are encoded as UTF-8 (bug fix: the original page threw on non-Latin1 characters).
 */
export function encodeHash(data: ProjectData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return '#' + btoa(binary);
}

/** Project data as loaded from a URL hash or a file: possibly partial, old-format or hand-edited. */
export type LoadedData = Partial<Record<keyof ProjectData, unknown>>;

/** Parses project data JSON. @returns the parsed object, or null when the JSON is invalid or not an object */
function parseProjectJson(json: string): LoadedData | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as LoadedData;
  } catch {
    return null;
  }
}

/**
 * Decodes a URL hash produced by any version of Project Forecaster.
 * Accepts UTF-8 and legacy Latin-1 payloads, missing padding, URL-escaped and URL-safe base64.
 * @returns the decoded object, or null when the hash is empty or invalid
 */
export function decodeHash(hash: string): LoadedData | null {
  let payload = hash.trim().replace(/^#/, '');
  if (payload.length === 0) return null;
  try {
    if (payload.includes('%')) payload = decodeURIComponent(payload);
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    let json: string;
    try {
      json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      json = binary; // legacy hashes encoded Latin-1 characters as single bytes
    }
    return parseProjectJson(json);
  } catch {
    return null;
  }
}

/** Extension of exported project files. */
export const FILE_EXTENSION = '.fcast.json';
/** MIME type of exported project files. */
export const FILE_MIME_TYPE = 'application/json';
/** File name used when the project has no usable name. */
export const DEFAULT_FILE_NAME = 'Project';

/**
 * File name for exporting a project: `<Project Name>.fcast.json`.
 * Characters that are not allowed in file names are replaced with `_`, and leading/trailing spaces and dots are removed.
 */
export function exportFileName(projectName: string): string {
  const name = projectName
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '');
  return (name || DEFAULT_FILE_NAME) + FILE_EXTENSION;
}

const JSON_NUMBER = String.raw`-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?`;
/**
 * A pretty-printed array of numbers (one number per line). JSON strings cannot contain raw line breaks,
 * so this only matches arrays, never text inside string values.
 */
const PRETTY_NUMBER_ARRAY = new RegExp(String.raw`\[\n\s*(${JSON_NUMBER}(?:,\n\s*${JSON_NUMBER})*)\n\s*\]`, 'g');

/**
 * Encodes data as the contents of an exported project file: the same JSON as the URL hash, pretty-printed,
 * with arrays of numbers (the samples) kept on a single line.
 */
export function encodeFile(data: ProjectData): string {
  const json = JSON.stringify(data, null, 2).replace(
    PRETTY_NUMBER_ARRAY,
    (_, items: string) => `[${items.replace(/,\n\s*/g, ', ')}]`,
  );
  return json + '\n';
}

/**
 * Decodes the contents of an exported project file (a byte order mark is ignored).
 * @returns the decoded object, or null when the file is not a JSON object
 */
export function decodeFile(text: string): LoadedData | null {
  return parseProjectJson(text.replace(/^\uFEFF/, ''));
}
