import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, VERSION } from '../src/App';
import { encodeHash, readForm, defaultFormState } from '../src/lib/projectData';
import { README_SAMPLE_HASH } from './helpers/fixtures';

vi.mock('react-chartjs-2', () => {
  const chart = (type: string) => (props: { data: unknown; 'aria-label': string }) => (
    <div data-testid={`chart-${type}`} aria-label={props['aria-label']} data-points={JSON.stringify(props.data).length} />
  );
  return { Bar: chart('bar'), Line: chart('line'), Scatter: chart('scatter') };
});

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const change = (label: string, value: string) => fireEvent.change(input(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const flush = () => act(() => vi.advanceTimersByTime(200));
const report = () => (screen.getByLabelText('Simulation report') as HTMLTextAreaElement).value;

/** Fills the minimum valid form with a small number of simulations so tests stay fast. */
function fillMinimum() {
  change('Weekly throughput', '3 4 5 6');
  change('Number of simulations', '300');
}

function sampleHash(overrides: Partial<ReturnType<typeof defaultFormState>> = {}) {
  const result = readForm({ ...defaultFormState(), tpSamples: '2 3', numberOfSimulations: '200', ...overrides });
  if (!result.ok) throw new Error(result.error);
  return encodeHash(result.data);
}

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = '';
  });

  describe('initial page', () => {
    it('shows the form with default values and no results', () => {
      render(<App />);
      expect(input('Team size').value).toBe('1');
      expect(input('Planned number of tasks').value).toBe('1');
      expect(input('Number of simulations').value).toBe('100000');
      expect(input('"S-Curve" size').value).toBe('20');
      expect(input('Confidence level').value).toBe('85');
      expect(screen.getByLabelText('Risk 1 likelihood')).toBeInTheDocument();
      expect(screen.queryByText('Simulation results')).not.toBeInTheDocument();
      expect(screen.getByText(`Version: ${VERSION}`)).toBeInTheDocument();
    });

    it('links to the documentation and feedback pages', () => {
      render(<App />);
      expect(screen.getAllByRole('link', { name: /online documentation/ })[0]).toHaveAttribute(
        'href',
        'https://github.com/rodrigozr/ProjectForecaster/wiki',
      );
      expect(screen.getAllByText('Documentation').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Feedback').length).toBeGreaterThan(0);
    });
  });

  describe('running a simulation', () => {
    it('shows "Running..." and then the summary, probabilities, charts and report', () => {
      render(<App />);
      fillMinimum();
      change('Start date', '2020/09/07');
      click('Run the simulation!');
      expect(screen.getAllByText('Running...')).toHaveLength(3);
      flush();
      expect(screen.getByText('Project forecast summary (with 85% of confidence):')).toBeInTheDocument();
      expect(report()).toContain('Project forecast summary (with 85% of confidence):');
      expect(report()).toContain(' - Can be delivered by ');
      expect(screen.getByTestId('chart-bar')).toHaveAttribute('aria-label', 'Duration histogram');
      expect(screen.getByTestId('chart-line')).toHaveAttribute('aria-label', 'First 100 burn downs');
      expect(screen.getByTestId('chart-scatter')).toHaveAttribute('aria-label', 'Effort scatter plot (first 500 runs)');
      expect(window.location.hash.length).toBeGreaterThan(1);
    });

    it('reports when there is no start date', () => {
      render(<App />);
      fillMinimum();
      click('Run the simulation!');
      flush();
      expect(screen.getByText('(No start date set)')).toBeInTheDocument();
      expect(report()).not.toContain('Can be delivered by');
    });

    it('shows 9 probabilities and the rest after "Show more..."', () => {
      render(<App />);
      fillMinimum();
      click('Run the simulation!');
      flush();
      const table = () => within(screen.getByRole('table'));
      expect(table().getAllByText(/^\d+%$/)).toHaveLength(9);
      click('Show more...');
      expect(table().getAllByText(/^\d+%$/)).toHaveLength(21);
      expect(screen.queryByRole('button', { name: 'Show more...' })).not.toBeInTheDocument();
      expect(table().getAllByText('Less than coin-toss odds').length).toBeGreaterThan(0);
    });

    it('normalizes the form after running, like the original page', () => {
      render(<App />);
      fillMinimum();
      change('Team size', '4');
      change('Risk 1 likelihood', '50');
      change('Risk 1 high impact', '3');
      fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
      click('Run the simulation!');
      expect(input('Minimum contributors').value).toBe('4');
      expect(input('Maximum contributors').value).toBe('4');
      expect(input('Weekly throughput').value).toBe('3,4,5,6');
      expect(input('Risk 1 low impact').value).toBe('1');
      expect(screen.queryByLabelText('Risk 2 likelihood')).not.toBeInTheDocument();
    });

    it('shows validation errors and lets the user dismiss them', () => {
      render(<App />);
      click('Run the simulation!');
      expect(screen.getByText('Must have at least one weekly throughput sample greater than zero')).toBeInTheDocument();
      click(/dismiss/i);
      expect(screen.queryByText(/weekly throughput sample/)).not.toBeInTheDocument();
      expect(window.location.hash).toBe('');
    });
  });

  describe('URL compatibility', () => {
    it('opens the README sample URL generated by the original version and runs it', () => {
      window.location.hash = README_SAMPLE_HASH;
      render(<App />);
      expect(input('Project name').value).toBe('Test project');
      expect(input('Planned number of tasks').value).toBe('38');
      expect(input('Start date').value).toBe('2020/09/07');
      expect((screen.getByLabelText('Risk 3 description') as HTMLInputElement).value).toBe('Potential world-wide pandemic');
      expect(screen.getAllByText('Running...')).toHaveLength(3);
      act(() => vi.advanceTimersByTime(5000));
      expect(report()).toContain('Project forecast summary (with 85% of confidence):');
      expect(window.location.hash).toBe(README_SAMPLE_HASH);
    });

    it('ignores invalid hashes and keeps the defaults', () => {
      window.location.hash = '#garbage!!';
      render(<App />);
      expect(input('Team size').value).toBe('1');
      expect(screen.queryByText('Simulation results')).not.toBeInTheDocument();
    });

    it('opens in-progress projects with the tracking section expanded', () => {
      window.location.hash = sampleHash({ startDate: '2020-01-01', currentDate: '2020-03-01', remainingTasks: '5', completedTasks: '3' });
      render(<App />);
      expect(input('Tasks remaining').value).toBe('5');
      expect(input('Actual number of tasks').value).toBe('8');
      flush();
      expect(report()).toContain('Can be delivered by');
    });

    it('loads and runs a different hash when the URL changes (back button / pasted link)', () => {
      render(<App />);
      act(() => {
        window.location.hash = sampleHash({ projectName: 'Changed' });
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(input('Project name').value).toBe('Changed');
      flush();
      expect(report()).toContain('Project forecast summary');
    });

    it('resets the page when the URL changes to an empty hash', () => {
      window.location.hash = sampleHash({ projectName: 'Loaded' });
      render(<App />);
      flush();
      act(() => {
        window.location.hash = '';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(input('Project name').value).toBe('');
      expect(input('Team size').value).toBe('1');
      expect(screen.queryByText('Simulation results')).not.toBeInTheDocument();
    });

    it('ignores hash changes made by the app itself', () => {
      render(<App />);
      fillMinimum();
      change('Project name', 'Mine');
      click('Run the simulation!');
      act(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
      expect(input('Project name').value).toBe('Mine');
    });
  });

  describe('sharing', () => {
    it('copies the link to the clipboard and shows a confirmation for 5 seconds', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      render(<App />);
      fillMinimum();
      await act(async () => click('Share simulation'));
      expect(writeText).toHaveBeenCalledWith(window.location.href);
      expect(window.location.href).toContain('#ey');
      expect(screen.getByText('You are all set! The link has been copied to your clipboard')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.queryByText(/You are all set/)).not.toBeInTheDocument();
    });

    it('explains how to copy the link when the clipboard is unavailable', async () => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      render(<App />);
      fillMinimum();
      await act(async () => click('Share simulation'));
      expect(screen.getByText(/Could not copy the link/)).toBeInTheDocument();
    });

    it('does not share invalid data', async () => {
      const writeText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      render(<App />);
      await act(async () => click('Share simulation'));
      expect(writeText).not.toHaveBeenCalled();
      expect(screen.getByText(/weekly throughput sample/)).toBeInTheDocument();
    });
  });

  describe('risks', () => {
    it('adds rows and edits each row independently', () => {
      render(<App />);
      click('Add row');
      change('Risk 2 description', 'Second');
      change('Risk 1 description', 'First');
      expect(input('Risk 1 description').value).toBe('First');
      expect(input('Risk 2 description').value).toBe('Second');
    });
  });

  describe('re-running', () => {
    it('shows "Running..." over the previous results until the new run finishes', () => {
      render(<App />);
      fillMinimum();
      click('Run the simulation!');
      flush();
      click('Run the simulation!');
      expect(screen.getAllByText('Running...')).toHaveLength(3);
      expect(screen.getByLabelText('Simulation report')).toBeInTheDocument();
      flush();
      expect(screen.queryByText('Running...')).not.toBeInTheDocument();
    });
  });

  describe('in-progress project tracking', () => {
    it('calculates the actual number of tasks and split rate with colors', () => {
      render(<App />);
      fireEvent.click(screen.getByText('In-progress project tracking'));
      change('Planned number of tasks', '10');
      change('Completed tasks', '6');
      change('Tasks remaining', '6');
      expect(input('Actual number of tasks').value).toBe('12');
      expect(input('Actual split rate').value).toBe('1.20');
      expect(input('Actual split rate').getAttribute('style')).toContain('#dc3545');
      change('Tasks remaining', '2');
      expect(input('Actual split rate').getAttribute('style')).toContain('#198754');
      change('Tasks remaining', '4');
      expect(input('Actual split rate').getAttribute('style') ?? '').not.toContain('#');
      change('Completed tasks', '');
      change('Tasks remaining', '');
      expect(input('Actual split rate').value).toBe('');
    });
  });

  describe('help', () => {
    it('shows field help in a popover', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: 'Information about Team size' }));
      expect(screen.getByText(/generated the weekly throughput samples you collected/)).toBeInTheDocument();
    });
  });

  describe('cleanup', () => {
    it('stops listening to URL changes and cancels pending work when unmounted', () => {
      const { unmount } = render(<App />);
      fillMinimum();
      click('Run the simulation!');
      unmount();
      act(() => vi.advanceTimersByTime(1000));
      act(() => {
        window.location.hash = sampleHash();
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(document.body.textContent).toBe('');
    });
  });
});
