import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import { HistoricalData, Risks } from './components/HistoricalData';
import { ProjectForm } from './components/ProjectForm';
import { Results } from './components/Results';
import { useForecaster } from './useForecaster';

export const VERSION = '2.0';
const REPO = 'https://github.com/rodrigozr/ProjectForecaster';
const WIKI = `${REPO}/wiki`;

export function App() {
  const f = useForecaster();
  return (
    <>
      <TopNavigation
        identity={{ href: '#', title: 'Project Forecaster', logo: { src: './favicon.png', alt: 'Project Forecaster' } }}
        utilities={[
          { type: 'button', text: 'Documentation', href: WIKI, external: true },
          {
            type: 'menu-dropdown',
            text: 'Feedback',
            items: [
              { id: 'issues', text: 'Issues', href: `${REPO}/issues`, external: true },
              { id: 'contribute', text: 'Contribute', href: `${REPO}/blob/master/CONTRIBUTING.md`, external: true },
            ],
          },
        ]}
      />
      <Box padding={{ horizontal: 'l', vertical: 'l' }}>
        <ContentLayout
          header={
            <Header
              variant="h1"
              description={
                <>
                  Forecast probabilities of a project&apos;s effort and duration using Monte Carlo simulations. Read the{' '}
                  <Link href={WIKI} external>
                    online documentation
                  </Link>{' '}
                  if you have any questions using this tool. Your data is{' '}
                  <Link href={`${WIKI}#user-content-is-my-project-data-safe`} external>
                    100% safe
                  </Link>{' '}
                  and never leaves your browser.
                </>
              }
            >
              Project forecaster
            </Header>
          }
        >
          <SpaceBetween size="l">
            <ProjectForm
              form={f.form}
              setField={f.setField}
              trackingExpanded={f.trackingExpanded}
              setTrackingExpanded={f.setTrackingExpanded}
            />
            <HistoricalData form={f.form} setField={f.setField} />
            <Risks risks={f.form.risks} addRisk={f.addRisk} setRisk={f.setRisk} />
            {f.error && (
              <Alert type="error" dismissible dismissAriaLabel="Dismiss" onDismiss={f.dismissError}>
                <span style={{ whiteSpace: 'pre-line' }}>{f.error}</span>
              </Alert>
            )}
            {f.shared && (
              <Alert type="success">You are all set! The link has been copied to your clipboard</Alert>
            )}
            <Box textAlign="center">
              <SpaceBetween direction="horizontal" size="s" alignItems="center">
                <Button variant="primary" onClick={f.run} loading={f.running}>
                  Run the simulation!
                </Button>
                <Button onClick={() => void f.share()}>Share simulation</Button>
              </SpaceBetween>
            </Box>
            {(f.running || f.output) && <Results running={f.running} output={f.output} />}
          </SpaceBetween>
        </ContentLayout>
      </Box>
      <Box textAlign="center" padding="l" color="text-body-secondary">
        Created by <Link href="https://edu.kanban.university/users/rodrigo-rosauro" external>Rodrigo Rosauro</Link>.
        <br />
        <Box variant="small">
          <i>
            (Inspired by Troy Magennis&apos;{' '}
            <Link
              href="https://github.com/FocusedObjective/FocusedObjective.Resources/blob/master/Spreadsheets/Throughput%20Forecaster.xlsx"
              external
            >
              Throughput Forecaster
            </Link>{' '}
            and Dimitar Bakardzhiev&apos;s{' '}
            <Link href="https://www.infoq.com/articles/noestimates-monte-carlo/" external>
              study
            </Link>
            )
          </i>
          .<br />
          <span>{`Version: ${VERSION}`}</span>
        </Box>
      </Box>
    </>
  );
}
