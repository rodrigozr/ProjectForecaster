import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Textarea from '@cloudscape-design/components/textarea';
import type { ReactNode } from 'react';
import type { FormState, RiskRow } from '../lib/projectData';
import type { TextField } from '../useForecaster';
import { Info } from './ProjectForm';

interface SamplesFieldProps {
  form: FormState;
  setField: (name: TextField, value: string) => void;
  name: 'tpSamples' | 'ltSamples' | 'splitRateSamples';
  label: string;
  required?: boolean;
  help: ReactNode;
}

function SamplesField({ form, setField, name, label, required, help }: SamplesFieldProps) {
  return (
    <FormField
      label={
        <span>
          {label}
          {required && <span style={{ color: 'red' }}>*</span>}
        </span>
      }
      info={<Info label={label}>{help}</Info>}
      stretch
    >
      <Textarea
        value={form[name]}
        rows={4}
        ariaLabel={label}
        ariaRequired={required}
        spellcheck={false}
        onChange={({ detail }) => setField(name, detail.value)}
      />
    </FormField>
  );
}

export function HistoricalData({ form, setField }: Pick<SamplesFieldProps, 'form' | 'setField'>) {
  const props = { form, setField };
  return (
    <Container header={<Header variant="h2">Historical data</Header>}>
      <ColumnLayout columns={3}>
        <SamplesField
          {...props}
          name="tpSamples"
          label="Weekly throughput"
          required
          help={
            <>
              Paste here your historical data of <u>weekly throughput</u>. It is very important that this data represents only
              throughput of project-related tasks (not including bug-fixes, external requests, etc).
              <br />
              <br />
              Values can be separated by spaces, lines or commas
              <br />
              <br />
              Minimum: 7 weeks of data. Maximum: 24 weeks of data
            </>
          }
        />
        <SamplesField
          {...props}
          name="ltSamples"
          label="Task lead-times"
          help={
            <>
              Optionally paste here your historical data of tasks <u>lead-time</u> (a.k.a cycle time) - one entry per task. It is
              very important that this data represents only the lead-time of project-related tasks (not including bug-fixes,
              external requests, etc).
              <br />
              <br />
              Values can be separated by spaces, lines or commas
            </>
          }
        />
        <SamplesField
          {...props}
          name="splitRateSamples"
          label="Projects split rates"
          help={
            <>
              Optionally paste here your historical data of project&apos;s <u>split rates</u> (actual tasks quantity at the end of
              the project divided by the originally planned tasks quantity) - one entry per project.
              <br />
              For a 10% split rate in a project, you should put &apos;1.1&apos;, for example.
              <br />
              <br />
              Values can be separated by spaces, lines or commas
            </>
          }
        />
      </ColumnLayout>
    </Container>
  );
}

interface RisksProps {
  risks: RiskRow[];
  addRisk: () => void;
  setRisk: (index: number, name: keyof RiskRow, value: string) => void;
}

const RISK_COLUMNS: { name: keyof RiskRow; label: string; unit?: string; type: 'number' | 'text' }[] = [
  { name: 'likelihood', label: 'Likelihood', unit: '%', type: 'number' },
  { name: 'lowImpact', label: 'Low impact', unit: 'tasks', type: 'number' },
  { name: 'highImpact', label: 'High impact', unit: 'tasks', type: 'number' },
  { name: 'description', label: 'Description', type: 'text' },
];

const RISK_GRID = [{ colspan: 2 }, { colspan: 2 }, { colspan: 2 }, { colspan: 6 }];

export function Risks({ risks, addRisk, setRisk }: RisksProps) {
  return (
    <Container
      header={
        <Header variant="h2" description="You can optionally model risks of your project, which will be added to the simulations.">
          Risks
        </Header>
      }
    >
      <SpaceBetween size="s">
        <Grid gridDefinition={RISK_GRID}>
          {RISK_COLUMNS.map((column) => (
            <strong key={column.name}>
              {column.label}
              {column.unit && ` (${column.unit})`}
            </strong>
          ))}
        </Grid>
        {risks.map((risk, index) => (
          <Grid key={index} gridDefinition={RISK_GRID}>
            {RISK_COLUMNS.map((column) => (
              <Input
                key={column.name}
                type={column.type}
                value={risk[column.name]}
                ariaLabel={`Risk ${index + 1} ${column.label.toLowerCase()}`}
                onChange={({ detail }) => setRisk(index, column.name, detail.value)}
              />
            ))}
          </Grid>
        ))}
        <Button onClick={addRisk}>Add row</Button>
      </SpaceBetween>
    </Container>
  );
}
