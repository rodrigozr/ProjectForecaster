# ProjectForecaster
Forecast probabilities of a project's effort and duration using **Monte Carlo simulations**.

Public-facing URL: https://rodrigozr.github.io/ProjectForecaster/

* [Documentation and user-manual](https://github.com/rodrigozr/ProjectForecaster/wiki)
* [Sample project](https://rodrigozr.github.io/ProjectForecaster/#eyJwcm9qZWN0TmFtZSI6IlRlc3QgcHJvamVjdCIsIm51bWJlck9mU2ltdWxhdGlvbnMiOjEwMDAwMCwiY29uZmlkZW5jZUxldmVsIjo4NSwidHBTYW1wbGVzIjpbOCw1LDQsNiw2LDUsMywxLDMsMywyLDcsNiw2LDMsNSwyLDIsNSw2LDQsM10sImx0U2FtcGxlcyI6WzEzLjEsOSwxMy44LDcuMiw4LjgsMC41LDE1LDguMiwyMS45LDIyLjUsOS43LDcuMiwyLjEsMjkuOSwxNi4zLDguMSw1LDguNiwyOC40LDAuNSw3LDIxLjcsMC41LDQsNy4xLDUsMi4xLDIuMyw0LDMuMSwxLjIsMi41LDEuOCw2LjEsNi4zLDIsMTIsMTIuMywyLjEsNy4zLDIwLjQsMTMuMSwwLjUsNDguOSw5LjgsNy40LDEuOCwxNywxMi4xLDMyLjcsMTQuMywwLjksMjIuMiw3LDE2LDEzLjIsNS4yLDE0LjUsNi4yLDIuMiwzLjIsNi4zLDkuNSwxOC4zLDcsMTMsMS40LDcuMywxMC4xLDE5LDEyLjMsMC44LDcuMiwyNC4xLDMuMiwwLjUsNy4xLDEwLjEsNiwyMy4xLDE0LjMsMTIsMjAsMTYuNyw2LjksMi4xLDEuMiw1LjcsNy4xLDcsNC41LDcsNSwxMC4xLDYuM10sInNwbGl0UmF0ZVNhbXBsZXMiOlsxLjI5LDEuNTYsMS40NywwLjc1LDEuMjUsMS4yNSwxLjE4LDEsMV0sInJpc2tzIjpbeyJsaWtlbGlob29kIjo1MCwibG93SW1wYWN0IjoxMiwiaGlnaEltcGFjdCI6MTUsImRlc2NyaXB0aW9uIjoiUGVudGVzdCBtYXkgYmUgcmVxdWlyZWQifSx7Imxpa2VsaWhvb2QiOjc1LCJsb3dJbXBhY3QiOjUsImhpZ2hJbXBhY3QiOjgsImRlc2NyaXB0aW9uIjoiRGF0YWJhc2UgdXBncmFkZSBtYXkgYmUgcmVxdWlyZWQifSx7Imxpa2VsaWhvb2QiOjUsImxvd0ltcGFjdCI6MTUsImhpZ2hJbXBhY3QiOjIwLCJkZXNjcmlwdGlvbiI6IlBvdGVudGlhbCB3b3JsZC13aWRlIHBhbmRlbWljIn1dLCJudW1iZXJPZlRhc2tzIjozOCwidG90YWxDb250cmlidXRvcnMiOjEwLCJtaW5Db250cmlidXRvcnMiOjEsIm1heENvbnRyaWJ1dG9ycyI6NSwic0N1cnZlU2l6ZSI6MjAsInN0YXJ0RGF0ZSI6IjIwMjAtMDktMDcifQ==) (pre-filled with test data)

# Development
Built with TypeScript 7, React, [Cloudscape Design System](https://cloudscape.design/), Vite and Vitest.

```bash
nvm use            # Node.js 24+ (from .nvmrc; npm scripts fail on older versions)
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run coverage   # unit tests with coverage (100% lines/branches enforced)
npm run build      # type-check and build the static site into dist/
npm run clean      # delete build/test output (dist/, coverage/, caches)
```

Project layout:
* `src/lib/monteCarlo.ts` - standalone Monte Carlo engine (no dependencies, can be copied into other projects)
* `src/lib/projectData.ts` - form/data conversion and the shareable URL format (`#` + base64 JSON, compatible with all previous versions)
* `src/lib/report.ts`, `src/lib/charts.ts` - results formatting and chart configuration
* `src/components`, `src/App.tsx`, `src/useForecaster.ts` - React + Cloudscape UI
* `test/` - Vitest unit tests

The site is deployed to GitHub Pages by `.github/workflows/pages.yml` (Pages source must be set to "GitHub Actions").

Reusing the simulation engine:
```ts
import { runMonteCarloSimulation } from './monteCarlo';

const result = runMonteCarloSimulation({
  numberOfSimulations: 100000,
  tpSamples: [8, 5, 4, 6], ltSamples: [], splitRateSamples: [1.2], risks: [],
  numberOfTasks: 38, totalContributors: 10, minContributors: 1, maxContributors: 5, sCurveSize: 20,
});
console.log(result.resultsTable); // effort/duration/tasks per likelihood (100%..0%)
```

# Screen shots
![summary](https://github.com/rodrigozr/ProjectForecaster/wiki/summary.png)
![charts](https://github.com/rodrigozr/ProjectForecaster/wiki/charts.png)
