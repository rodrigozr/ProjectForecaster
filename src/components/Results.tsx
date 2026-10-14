import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import Textarea from '@cloudscape-design/components/textarea';
import { useState } from 'react';
import { INITIAL_PROBABILITY_ROWS, type CertaintyLevel, type ForecastSummary, type ProbabilityRow } from '../lib/report';
import type { ForecastOutput } from '../useForecaster';
import { BurnDownsChart, EffortScatterChart, HistogramChart } from './Charts';

const LEVEL_COLORS: Record<CertaintyLevel, string> = {
  'almost-certain': 'rgba(75, 192, 192, 0.2)',
  'somewhat-certain': 'rgba(255, 206, 86, 0.2)',
  'not-certain': 'rgba(255, 99, 132, 0.2)',
};

const cell = (row: ProbabilityRow, text: string) => (
  <div className={row.level} style={{ backgroundColor: LEVEL_COLORS[row.level], padding: '2px 4px' }}>
    {text}
  </div>
);

const COLUMNS = [
  { id: 'likelihood', header: 'Likelihood', cell: (r: ProbabilityRow) => cell(r, `${r.Likelihood}%`) },
  { id: 'effort', header: 'Effort', cell: (r: ProbabilityRow) => cell(r, String(r.Effort)) },
  { id: 'duration', header: 'Duration', cell: (r: ProbabilityRow) => cell(r, String(r.Duration)) },
  { id: 'tasks', header: 'Tasks', cell: (r: ProbabilityRow) => cell(r, String(r.TotalTasks)) },
  { id: 'date', header: 'Date', cell: (r: ProbabilityRow) => cell(r, r.date) },
  { id: 'comment', header: 'Comment', cell: (r: ProbabilityRow) => cell(r, r.comment) },
];

function Probabilities({ rows }: { rows: ProbabilityRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, INITIAL_PROBABILITY_ROWS);
  return (
    <Table
      variant="embedded"
      header={<Header variant="h3">All probabilities</Header>}
      columnDefinitions={COLUMNS}
      items={visible}
      trackBy={(r) => String(r.Likelihood)}
      footer={
        !showAll && rows.length > INITIAL_PROBABILITY_ROWS ? (
          <Box textAlign="center">
            <Button onClick={() => setShowAll(true)}>Show more...</Button>
          </Box>
        ) : undefined
      }
    />
  );
}

export function Results({ running, output }: { running: boolean; output: ForecastOutput | null }) {
  const summary = output?.summary;
  // While running, every value shows "Running..."; otherwise the output always exists.
  const value = (format: (s: ForecastSummary) => string) => (running ? 'Running...' : format(output!.summary));
  return (
    <Container header={<Header variant="h1">Simulation results</Header>}>
      <SpaceBetween size="l">
        <SpaceBetween size="s">
          <Header variant="h3">
            {summary ? `Project forecast summary (with ${summary.confidenceLevel}% of confidence):` : 'Project forecast summary:'}
          </Header>
          <KeyValuePairs
            columns={3}
            items={[
              { label: 'Effort', value: value((s) => `${s.effort} person-weeks`) },
              { label: 'Duration', value: value((s) => `${s.duration} calendar weeks`) },
              { label: 'Delivery date', value: value((s) => s.endDate) },
            ]}
          />
        </SpaceBetween>
        {output && (
          <>
            <Probabilities key={output.report} rows={output.rows} />
            <Header variant="h3">Charts</Header>
            <HistogramChart config={output.histogram} />
            <BurnDownsChart config={output.burnDowns} />
            <EffortScatterChart config={output.scatter} />
            <Header variant="h3">Simulation report</Header>
            <Textarea value={output.report} rows={23} readOnly ariaLabel="Simulation report" spellcheck={false} />
          </>
        )}
      </SpaceBetween>
    </Container>
  );
}
