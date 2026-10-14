import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import DatePicker from '@cloudscape-design/components/date-picker';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import Popover from '@cloudscape-design/components/popover';
import SpaceBetween from '@cloudscape-design/components/space-between';
import type { ReactNode } from 'react';
import { calculateFields, type FormState } from '../lib/projectData';
import type { TextField } from '../useForecaster';

export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover header={label} content={children} triggerType="custom" size="medium" position="right">
      <Link variant="info" ariaLabel={`Information about ${label}`}>
        Info
      </Link>
    </Popover>
  );
}

interface FieldProps {
  form: FormState;
  setField: (name: TextField, value: string) => void;
}

interface InputFieldProps extends FieldProps {
  name: TextField;
  label: string;
  required?: boolean;
  type?: 'text' | 'number';
  unit?: string;
  readOnly?: boolean;
  value?: string;
  color?: string;
  help?: ReactNode;
}

export function InputField({ form, setField, name, label, required, type = 'number', unit, readOnly, value, color, help }: InputFieldProps) {
  return (
    <FormField
      label={
        <span>
          {label}
          {required && <span style={{ color: 'red' }}>*</span>}
        </span>
      }
      info={help && <Info label={label}>{help}</Info>}
      secondaryControl={unit && <Box padding={{ top: 'xxs' }}>{unit}</Box>}
      stretch={false}
    >
      <Input
        type={type}
        value={value ?? form[name]}
        readOnly={readOnly}
        inputMode={type === 'number' ? 'decimal' : undefined}
        ariaLabel={label}
        ariaRequired={required}
        style={color ? { root: { color: { default: color, readonly: color } } } : undefined}
        onChange={({ detail }) => setField(name, detail.value)}
      />
    </FormField>
  );
}

function DateField({ form, setField, name, label, help }: FieldProps & { name: 'startDate' | 'currentDate'; label: string; help: ReactNode }) {
  return (
    <FormField label={label} info={<Info label={label}>{help}</Info>}>
      <DatePicker
        value={form[name]}
        placeholder="YYYY/MM/DD"
        ariaLabel={label}
        openCalendarAriaLabel={(selected) => `Choose ${label}${selected ? `, selected date is ${selected}` : ''}`}
        onChange={({ detail }) => setField(name, detail.value)}
      />
    </FormField>
  );
}

const SPLIT_RATE_COLORS = { over: '#dc3545', under: '#198754', exact: undefined, '': undefined } as const;

interface ProjectFormProps extends FieldProps {
  trackingExpanded: boolean;
  setTrackingExpanded: (expanded: boolean) => void;
}

export function ProjectForm({ form, setField, trackingExpanded, setTrackingExpanded }: ProjectFormProps) {
  const props = { form, setField };
  const calculated = calculateFields(form);
  return (
    <SpaceBetween size="l">
      <ColumnLayout columns={2}>
        <Container header={<Header variant="h2">Project properties</Header>}>
          <SpaceBetween size="m">
            <InputField {...props} name="projectName" label="Project name" type="text" />
            <InputField
              {...props}
              name="totalContributors"
              label="Team size"
              unit="contributors"
              required
              help={
                <>
                  Total number of <u>individual contributors</u> on this team or service.
                  <br />
                  <br />
                  This must represent the number of individual contributors that generated the weekly throughput samples you collected.
                </>
              }
            />
            <InputField
              {...props}
              name="minContributors"
              label="Minimum contributors"
              help={
                <>
                  Minimum number of <u>individual contributors</u> who will start working in the project.
                  <br />
                  <br />
                  This is used to model the project&apos;s S-curve to forecast the project duration in calendar weeks
                  <br />
                  <br />
                  <u>Optional:</u> If you only want to forecast the project effort, this is not necessary, so you can leave it empty.
                </>
              }
            />
            <InputField
              {...props}
              name="maxContributors"
              label="Maximum contributors"
              help={
                <>
                  Maximum number of <u>individual contributors</u> who can work in the project (maximum parallelism). Cannot be
                  higher than the &apos;Team size&apos;.
                  <br />
                  <br />
                  This is used to model the project&apos;s S-curve to forecast the project duration in calendar weeks
                  <br />
                  <br />
                  <u>Optional:</u> If you only want to forecast the project effort, this is not necessary, so you can leave it empty.
                </>
              }
            />
            <InputField
              {...props}
              name="numberOfTasks"
              label="Planned number of tasks"
              required
              help={
                <>
                  Number of tasks planned for this project.
                  <br />
                  <br />
                  Notice that tasks should be within a reasonable range of size (up to 500% difference in sizes is perfectly
                  fine). It doesn&apos;t matter how you are breaking down your projects, as long as tasks sizes are within this
                  range. This could be user stories, or any other granular level that makes sense to you.
                </>
              }
            />
          </SpaceBetween>
        </Container>
        <Container header={<Header variant="h2">Simulation properties</Header>}>
          <SpaceBetween size="m">
            <InputField
              {...props}
              name="numberOfSimulations"
              label="Number of simulations"
              required
              help={
                <>
                  Number of simulations to execute.
                  <br />
                  <br />
                  Recommended minimum: 10K, Default: 100K, Max: 10MM
                </>
              }
            />
            <InputField
              {...props}
              name="sCurveSize"
              label={'"S-Curve" size'}
              unit="%"
              help={
                <>
                  Size of the S-Curve at the beginning and end of the project. Empirical evidence demonstrates that most projects
                  have lower productivity in the first 20% and last 20% of the project
                  <br />
                  <br />
                  Minimum: 0%, Default: 20%, Max: 50%
                </>
              }
            />
            <InputField
              {...props}
              name="confidenceLevel"
              label="Confidence level"
              unit="%"
              help={
                <>
                  Level of confidence to report in the results.
                  <br />
                  <br />
                  Minimum: 1%, Default: 85%, Max: 99%
                </>
              }
            />
            <DateField
              {...props}
              name="startDate"
              label="Start date"
              help={
                <>
                  <u>Optional:</u> Planned start date for this project. Set this if you want to calculate a planned end date
                </>
              }
            />
          </SpaceBetween>
        </Container>
      </ColumnLayout>
      <Box variant="small">
        <i>
          (Fields marked with a red <span style={{ color: 'red' }}>*</span> are mandatory)
        </i>
      </Box>
      <ExpandableSection
        variant="container"
        headerText="In-progress project tracking"
        expanded={trackingExpanded}
        onChange={({ detail }) => setTrackingExpanded(detail.expanded)}
      >
        <SpaceBetween size="m">
          <Box>
            <i>To forecast the remaining work of an in-progress project, fill the start date and all the fields below:</i>
          </Box>
          <ColumnLayout columns={2}>
            <SpaceBetween size="m">
              <DateField
                {...props}
                name="currentDate"
                label="Current date"
                help="Current date for the forecasting of remaining work. (Don't forget to set the Start Date as well)"
              />
              <InputField {...props} name="completedTasks" label="Completed tasks" help="Number of tasks completed so far" />
              <InputField {...props} name="remainingTasks" label="Tasks remaining" help="Number of tasks still remaining" />
            </SpaceBetween>
            <SpaceBetween size="m">
              <InputField
                {...props}
                name="completedTasks"
                label="Actual number of tasks"
                readOnly
                value={calculated.actualTasks}
                help="Sum of completed and remaining tasks"
              />
              <InputField
                {...props}
                name="completedTasks"
                label="Actual split rate"
                readOnly
                value={calculated.actualSplitRate}
                color={SPLIT_RATE_COLORS[calculated.splitRateStatus]}
                help="Actual number of tasks divided by the originally planned number of tasks"
              />
            </SpaceBetween>
          </ColumnLayout>
        </SpaceBetween>
      </ExpandableSection>
    </SpaceBetween>
  );
}
