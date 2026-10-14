import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Bar, Line, Scatter } from 'react-chartjs-2';
import type { ChartConfig } from '../lib/charts';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Legend, Tooltip, annotationPlugin);

export function HistogramChart({ config }: { config: ChartConfig<'bar'> }) {
  return <Bar data={config.data} options={config.options} aria-label="Duration histogram" role="img" />;
}

export function BurnDownsChart({ config }: { config: ChartConfig<'line'> }) {
  return <Line data={config.data} options={config.options} aria-label="First 100 burn downs" role="img" />;
}

export function EffortScatterChart({ config }: { config: ChartConfig<'scatter'> }) {
  return (
    <Scatter data={config.data} options={config.options} aria-label="Effort scatter plot (first 500 runs)" role="img" />
  );
}
