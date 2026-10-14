import { useCallback, useEffect, useRef, useState } from 'react';
import { burnDownsChart, effortScatterChart, histogramChart, type ChartConfig } from './lib/charts';
import { runMonteCarloSimulation } from './lib/monteCarlo';
import {
  applyInProgress,
  decodeHash,
  defaultFormState,
  emptyRiskRow,
  encodeHash,
  formFromData,
  isInProgress,
  readForm,
  type FormState,
  type ProjectData,
  type RiskRow,
} from './lib/projectData';
import { buildReport, probabilityRows, summarize, type ForecastSummary, type ProbabilityRow } from './lib/report';

/** Delay before running the simulation, so the "Running..." state can render first (same as v1). */
export const RUN_DELAY_MS = 100;
/** How long the "link copied" confirmation stays visible (same as v1). */
export const SHARE_MESSAGE_MS = 5000;

export interface ForecastOutput {
  summary: ForecastSummary;
  rows: ProbabilityRow[];
  report: string;
  histogram: ChartConfig<'bar'>;
  burnDowns: ChartConfig<'line'>;
  scatter: ChartConfig<'scatter'>;
}

export type TextField = Exclude<keyof FormState, 'risks'>;

/**
 * Application state and behavior: form editing, URL hash persistence/sharing and running the simulation.
 */
export function useForecaster(win: Window = window) {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [trackingExpanded, setTrackingExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<ForecastOutput | null>(null);
  const [shared, setShared] = useState(false);
  const loadedHash = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const later = useCallback(
    (fn: () => void, ms: number) => {
      timers.current.push(win.setTimeout(fn, ms));
    },
    [win],
  );

  const execute = useCallback(
    (data: ProjectData) => {
      setRunning(true);
      later(() => {
        const simulationData = applyInProgress(data);
        const startTime = Date.now();
        const result = runMonteCarloSimulation(simulationData);
        const elapsed = Date.now() - startTime;
        const { confidenceLevel, startDate, numberOfSimulations } = simulationData;
        const summary = summarize(result, confidenceLevel, startDate);
        setOutput({
          summary,
          rows: probabilityRows(result, startDate),
          report: buildReport(result, summary, numberOfSimulations, elapsed, Boolean(startDate)),
          histogram: histogramChart(result.simulations.map((s) => s.durationInCalendarWeeks), confidenceLevel),
          burnDowns: burnDownsChart(result.burnDowns),
          scatter: effortScatterChart(result.simulations.map((s) => s.effortWeeks), confidenceLevel),
        });
        setRunning(false);
      }, RUN_DELAY_MS);
    },
    [later],
  );

  /** Validates the form and stores it in the URL hash. Returns the data, or null on validation errors. */
  const save = useCallback(
    (current: FormState): ProjectData | null => {
      const result = readForm(current);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setError(null);
      const hash = encodeHash(result.data);
      loadedHash.current = hash;
      win.location.hash = hash;
      return result.data;
    },
    [win],
  );

  const showForm = useCallback((next: FormState) => {
    setForm(next);
    setTrackingExpanded(isInProgress(next));
  }, []);

  const run = useCallback(
    (current: FormState) => {
      const data = save(current);
      if (!data) return;
      // Like v1, the form is reloaded from the saved URL so it shows the normalized values.
      showForm(formFromData(decodeHash(loadedHash.current as string) as Partial<ProjectData>));
      execute(data);
    },
    [save, showForm, execute],
  );

  /** Loads the form from the current URL hash and runs it (or resets the page when the hash is empty/invalid). */
  const loadFromUrl = useCallback(() => {
    loadedHash.current = win.location.hash;
    const data = decodeHash(win.location.hash);
    setOutput(null);
    setError(null);
    if (!data) {
      showForm(defaultFormState());
      return;
    }
    const loaded = formFromData(data);
    showForm(loaded);
    run(loaded);
  }, [win, showForm, run]);

  useEffect(() => {
    loadedHash.current = win.location.hash;
    if (win.location.hash.trim().length > 1) loadFromUrl();
    // v1 reloaded the page when the hash was changed externally (e.g. back button or pasted link).
    const onHashChange = () => {
      if (win.location.hash !== loadedHash.current) loadFromUrl();
    };
    win.addEventListener('hashchange', onHashChange);
    const pending = timers.current;
    return () => {
      win.removeEventListener('hashchange', onHashChange);
      pending.forEach((t) => win.clearTimeout(t));
    };
    // Run once on mount (all callbacks are stable for a given window).
  }, []);

  const setField = useCallback((name: TextField, value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
  }, []);

  const addRisk = useCallback(() => {
    setForm((f) => ({ ...f, risks: [...f.risks, emptyRiskRow()] }));
  }, []);

  const setRisk = useCallback((index: number, name: keyof RiskRow, value: string) => {
    setForm((f) => ({ ...f, risks: f.risks.map((r, i) => (i === index ? { ...r, [name]: value } : r)) }));
  }, []);

  const share = useCallback(async () => {
    if (!save(form)) return;
    try {
      await win.navigator.clipboard.writeText(win.location.href);
      setShared(true);
      later(() => setShared(false), SHARE_MESSAGE_MS);
    } catch {
      setError('Could not copy the link to your clipboard. Please copy it from the address bar.');
    }
  }, [form, save, win, later]);

  return {
    form,
    setField,
    addRisk,
    setRisk,
    trackingExpanded,
    setTrackingExpanded,
    error,
    dismissError: () => setError(null),
    running,
    output,
    shared,
    run: () => run(form),
    share,
  };
}

export type Forecaster = ReturnType<typeof useForecaster>;
