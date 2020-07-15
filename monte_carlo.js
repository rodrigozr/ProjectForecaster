/**
 * Returns the value at a given percentile in a sorted numeric array.
 * "Linear interpolation between closest ranks" method
 * @param {Array} arr sorted numeric array
 * @param {Number} p percentile number between 0 (p0) and 1 (p100)
 * @returns the value at a given percentile
 */
function percentile(arr, p) {
    if (arr.length === 0) return 0;
    if (typeof p !== 'number') throw new TypeError('p must be a number');
    if (p <= 0) return arr[0];
    if (p >= 1) return arr[arr.length - 1];

    const index = (arr.length - 1) * p,
        lower = Math.floor(index),
        upper = lower + 1,
        weight = index % 1;

    if (upper >= arr.length) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}

/**
 * Sorts a numeric array
 * @param {Array} array numeric array
 */
function sortNumbers(array) {
    return array.sort((a, b) => a - b);
}

/**
 * Generates a random integer between "min" and "max"
 * @param {Number} min minimum number (inclusive)
 * @param {Number} max maximum number (inclusive)
 * @returns random integer
 */
function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Retrieves a random element from an array
 * @param {Array} array array of item
 */
function randomElement(array) {
    return array[randomInteger(0, array.length - 1)];
}

/**
 * Generates an average of random sample elements from a numeric array
 * @param {Array} array numeric array
 * @param {Number} minNumberOfItems minimum number of random samples to average
 * @param {Number} maxNumberOfItems maximum number of random samples to average
 * @returns the average for the random samples selected
 */
function randomSampleAverage(array, minNumberOfItems, maxNumberOfItems) {
    if (array.length == 0) return 0;
    const numberOfItems = randomInteger(minNumberOfItems, maxNumberOfItems);
    let total = 0;
    for (let i = 0; i < numberOfItems; i++) {
        total += randomElement(array);
    }
    return (total / numberOfItems);
}

/**
 * Calculates the estimated error rate/range for the given numeric array
 * @param {Array} array numeric array
 * @returns estimated error rate/range between 0 and 100
 */
function errorRate(array) {
    if (array.length <= 1) return 0;
    const sortedArray = sortNumbers([...array]);
    const min = Math.min(...sortedArray);
    const max = Math.max(...sortedArray);

    const group1 = [...sortedArray].filter((_val, index) => index % 2 != 0)
    const g1avg = group1.reduce((a, b) => a + b, 0) / group1.length;

    const group2 = [...sortedArray].filter((_val, index) => index % 2 == 0)
    const g2avg = group2.reduce((a, b) => a + b, 0) / group2.length;

    const avgError = Math.abs(g1avg - g2avg)

    return Math.round(100 * avgError / (max - min));
}

/**
 * Calculates the "S-curve" distribution of individual contributors for the given simulation data
 * @param {*} simulationData simulation data
 * @returns numeric array with exactly 100 elements, and each position in the array represents the number of individual contributors for that percentage of completion in the project
 */
function calculateContributorsDistribution(simulationData) {
    const { minContributors, maxContributors, sCurveSize } = simulationData;
    const curveSize = Math.max(0, Math.min(50, sCurveSize));
    const curveTailStart = 100 - curveSize;
    const contributorsRange = [];
    for (let i = minContributors; i < maxContributors; i++) {
        contributorsRange.push(i);
    }
    const contributorsDistribution = [];
    const get = p => Math.min(maxContributors, Math.max(minContributors, Math.round(percentile(contributorsRange, p))));
    for (let i = 0; i < 100; i++) {
        if (i < curveSize) contributorsDistribution.push(get(i / curveSize));
        else if (i < curveTailStart) contributorsDistribution.push(maxContributors);
        else contributorsDistribution.push(get((100 - i) / curveSize));
    }
    return contributorsDistribution;
}

/**
 * Executes a single round of Monte Carlo burn down simulation for the given simulation data
 * @param {*} simulationData simulation data
 * @returns simulation result for this round
 */
function simulateBurnDown(simulationData) {
    //  Caches the "S-curve" distribution in the first run
    if (!simulationData.contributorsDistribution) {
        simulationData.contributorsDistribution = calculateContributorsDistribution(simulationData);
    }
    const { tpSamples, ltSamples, splitRateSamples, risks, numberOfTasks, totalContributors, maxContributors, contributorsDistribution } = simulationData;

    // Retrieve a random split rate for this round
    const randomSplitRate = randomSampleAverage(splitRateSamples, 1, splitRateSamples.length) || 1.0;

    // Calculate random impacts for this round
    let impactTasks = 0;
    for (const risk of risks) {
        if (Math.random() <= risk.likelihood) {
            impactTasks += randomInteger(risk.lowImpact, risk.highImpact);
        }
    }

    // Calculate the number of tasks for this round
    const totalTasks = Math.round((numberOfTasks + impactTasks) * randomSplitRate);

    // Extend the duration by a random sample average of lead times
    const leadTime = randomSampleAverage(ltSamples, Math.round(ltSamples.length * 0.1), Math.round(ltSamples.length * 0.9)) || 0;
    let durationInCalendarWeeks = Math.round(leadTime / 7);
    
    let weekNumber = 0
    const simulatedTp = [];
    let effortWeeks = 0;
    let partialTp = 0;
    const burnDown = [];
    let remainingTasks = totalTasks;
    // Run the simulation
    while (remainingTasks > 0) {
        burnDown.push(remainingTasks);
        const randomTp = randomElement(tpSamples);
        const percentComplete = Math.max(0, Math.round((totalTasks - remainingTasks) / totalTasks * 100));
        const contributorsThisWeek = contributorsDistribution[percentComplete];
        const adjustedTp = (randomTp * (contributorsThisWeek / totalContributors)) + partialTp;
        const actualTp = Math.floor(adjustedTp);
        partialTp = (actualTp < adjustedTp) ? (adjustedTp - actualTp) : 0;
        simulatedTp.push(actualTp);
        remainingTasks -= actualTp;
        durationInCalendarWeeks++;
        weekNumber++;
        effortWeeks += contributorsThisWeek;
    }
    burnDown.push(0);
    return {
        totalTasks,
        durationInCalendarWeeks,
        simulatedTp,
        leadTime,
        effortWeeks,
        burnDown,
    }
}

/**
 * Run a full Monte Carlo simulation for the given data
 * @param {*} simulationData simulation data
 * @returns result of the simulation
 */
function runMonteCarloSimulation(simulationData) {
    const durationHistogram = [];
    const tasksHistogram = [];
    const ltHistogram = [];
    const effortHistogram = [];

    simulationData = {...simulationData};
    for (const risk of simulationData.risks) {
        if (risk.likelihood >= 1) risk.likelihood /= 100;
    }

    const { numberOfSimulations } = simulationData;
    const burnDowns = [];
    for (let i = 0; i < numberOfSimulations; i++) {
        const res = simulateBurnDown(simulationData);
        durationHistogram.push(res.durationInCalendarWeeks);
        tasksHistogram.push(res.totalTasks);
        ltHistogram.push(res.leadTime);
        effortHistogram.push(res.effortWeeks);
        if (i < 100) {
            burnDowns.push(res.burnDown);
        }
    }
    sortNumbers(durationHistogram);
    sortNumbers(tasksHistogram);
    sortNumbers(ltHistogram);
    sortNumbers(effortHistogram);

    const tpErrorRate = errorRate(simulationData.tpSamples);
    const ltErrorRate = errorRate(simulationData.ltSamples);

    let resultsTable = [];
    let p = 100;
    while (p >= 0) {
        const duration = percentile(durationHistogram, p / 100);
        const tasks = percentile(tasksHistogram, p / 100);
        const leadTime = percentile(ltHistogram, p / 100);
        const effort = percentile(effortHistogram, p / 100);
        resultsTable.push({
            Likelihood: p,
            Duration: Math.round(duration),
            TotalTasks: Math.round(tasks),
            Effort: Math.round(effort),
            LT: Math.round(leadTime)
        });
        p -= 5;
    }

    return {
        durationHistogram,
        tasksHistogram,
        ltHistogram,
        effortHistogram,
        tpErrorRate,
        ltErrorRate,
        burnDowns,
        resultsTable,
    }
}
