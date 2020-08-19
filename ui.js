$(function () {
    $('[data-toggle="tooltip"]').tooltip({ delay: 500 });

    function parseSamples(selector) {
        let val = $(selector).val() || '';
        if (val.trim().length === 0) return [];
        return val.split(/[\s\n,]/).map(s => s.trim().length > 0 ? Number(s.trim()) : NaN).filter(n => n != NaN).filter(n => n >= 0);
    }
    function parseRisks(selector) {
        const risks = [];
        $(selector).find('tbody').find('.risk-row').each((_index, el) => {
            const $el = $(el);
            const risk = {
                likelihood: $el.find("input[name='likelihood']").val(),
                lowImpact: $el.find("input[name='lowImpact']").val(),
                highImpact: $el.find("input[name='highImpact']").val(),
                description: $el.find("input[name='description']").val(),
            };
            if (risk.likelihood && (risk.lowImpact || risk.highImpact)) {
                if (!risk.lowImpact) risk.lowImpact = '1';
                else if (!risk.highImpact) risk.highImpact = risk.lowImpact;
                risk.likelihood = parseInt(risk.likelihood) || 0;
                risk.lowImpact = parseInt(risk.lowImpact) || 0;
                risk.highImpact = parseInt(risk.highImpact) || 0;
                risks.push(risk);
            }
        });
        return risks;
    }
    const $riskRowTemplate = $('#risk-row-template').clone();
    function addRisk() {
        const $row = $riskRowTemplate.clone();
        $row.insertBefore($('#add-risk-row'));
        return $row;
    }
    function fillRisk(risk, $row) {
        $row.find("input[name='likelihood']").val(risk.likelihood);
        $row.find("input[name='lowImpact']").val(risk.lowImpact);
        $row.find("input[name='highImpact']").val(risk.highImpact);
        $row.find("input[name='description']").val(risk.description);
    }
    const $probabilitiesRowTemplate = $('#probabilities').find('.probabilities-row').clone();
    function addProbabilityRow() {
        const $row = $probabilitiesRowTemplate.clone();
        $row.insertBefore('#show-more-row');
        return $row;
    }
    function clearProbabilities() {
        $('.probabilities-row').remove();
    }

    function share() {
        if (readSimulationData()) {
            navigator.clipboard.writeText(location.href);
            $('#share').popover('show');
            setTimeout(() => $('#share').popover('dispose'), 5000);
        }
    }
    let currentlyLoadedHash = null;
    function readSimulationData() {
        const simulationData = {
            projectName: $('#projectName').val(),
            numberOfSimulations: parseInt($('#numberOfSimulations').val()),
            confidenceLevel: parseInt($('#confidenceLevel').val()) || 85,
            tpSamples: parseSamples('#tpSamples'),
            ltSamples: parseSamples('#ltSamples'),
            splitRateSamples: parseSamples('#splitRateSamples'),
            risks: parseRisks('#risks'),
            numberOfTasks: parseInt($('#numberOfTasks').val()),
            totalContributors: parseInt($('#totalContributors').val()),
            minContributors: parseInt($('#minContributors').val()),
            maxContributors: parseInt($('#maxContributors').val()),
            sCurveSize: parseInt($('#sCurveSize').val()),
            startDate: $('#startDate').val() || undefined
        };
        if (!simulationData.tpSamples.some(n => n >= 1)) {
            alert("Must have at least one weekly throughput sample greater than zero");
            return false;
        }
        if (simulationData.splitRateSamples.length > 0 && simulationData.splitRateSamples.some(n => n > 10 || n < 0.2)) {
            alert("Your split rates don't seem correct.\nFor a 10% split rate in a project, you should put '1.1', for example. Please correct before proceeding");
            return false;
        }
        simulationData.minContributors = simulationData.minContributors || simulationData.totalContributors;
        simulationData.maxContributors = simulationData.maxContributors || simulationData.totalContributors;
        const hash = '#' + btoa(JSON.stringify(simulationData));
        currentlyLoadedHash = hash;
        location.hash = hash;
        return simulationData;
    }
    function runSimulation() {
        const simulationData = readSimulationData();
        if (!simulationData) return;
        loadDataFromUrl();

        $('#results-main').show();
        const $results = $('#results');
        $results.val('');
        const write = str => $results.val($results.val() + str);
        $('#res-effort').val('Running...');

        setTimeout(() => {
            // Run the simulation
            const startTime = Date.now();
            const result = runMonteCarloSimulation(simulationData);
            const elapsed = Date.now() - startTime;
            $results.val('');

            // Report the results
            const confidenceLevel = simulationData.confidenceLevel;
            const reportPercentile = confidenceLevel / 100;
            const effort = Math.round(percentile(result.simulations.map(s => s.effortWeeks), reportPercentile, true));
            const duration = Math.round(percentile(result.simulations.map(s => s.durationInCalendarWeeks), reportPercentile, true));
            $('#res-summary-header').text(`Project forecast summary (with ${confidenceLevel}% of confidence):`);
            $('#res-effort').val(effort);
            $('#res-duration').val(duration);
            let endDate = '(No start date set)';
            if (simulationData.startDate) {
                endDate = moment(simulationData.startDate).add(duration, 'weeks').format("MMM Do YYYY");
            }
            $('#res-endDate').val(endDate);

            // Probabilities
            clearProbabilities();
            $('#show-more-row').show();
            $('#show-more').show();
            const addProbability = (res) => {
                const comment = res.Likelihood > 80 ? 'Almost certain' : res.Likelihood > 45 ? 'Somewhat certain' : 'Less than coin-toss odds';
                const style = res.Likelihood > 80 ? 'almost-certain' : res.Likelihood > 45 ? 'somewhat-certain' : 'not-certain';
                const $row = addProbabilityRow();
                const $cells = $row.find('td');
                $cells.addClass(style);
                $cells.eq(0).text(res.Likelihood + '%');
                $cells.eq(1).text(res.Effort.toString());
                $cells.eq(2).text(res.Duration.toString());
                $cells.eq(3).text(res.TotalTasks.toString());
                if (simulationData.startDate) {
                    $cells.eq(4).text(moment(simulationData.startDate).add(res.Duration, 'weeks').format("MMM Do YYYY"));
                }
                $cells.eq(5).text(comment);
            }
            result.resultsTable.slice(0, 9).forEach(addProbability);
            $('#show-more').off('click').on('click', () => {
                result.resultsTable.slice(9).forEach(addProbability);
                $('#show-more').off('click').hide();
                $('#show-more-row').hide();
            });

            drawHistogram('res-duration-histogram', result.simulations.map(s => s.durationInCalendarWeeks), confidenceLevel);
            drawBurnDowns('res-burn-downs', result.burnDowns);
            drawScatterPlot('res-effort-scatter-plot', result.simulations.map(s => s.effortWeeks), confidenceLevel);

            write(`Project forecast summary (with ${confidenceLevel}% of confidence):\n`);
            write(` - Up to ${effort} person-weeks of effort\n`);
            write(` - Can be delivered in up to ${duration} calendar weeks\n`);
            if (simulationData.startDate) {
                write(` - Can be delivered by ${endDate}\n`);
            }
            write(`\n\n`);
            write(`-----------------------------------------------------\n`);
            write(`                       DETAILS\n`);
            write(`-----------------------------------------------------\n`);
            write(`Elapsed time: ${elapsed} ms (${Math.round(simulationData.numberOfSimulations / elapsed * 1000)} simulations per second)\n`);
            write('All probabilities:\n')
            write(`  Likelihood\tDuration\tTasks\tEffort          \tComment\n`);
            for (const res of result.resultsTable) {
                const comment = res.Likelihood > 80 ? 'Almost certain' : res.Likelihood > 45 ? 'Somewhat certain' : 'Less than coin-toss odds';
                write(`  ${res.Likelihood}%      \t${res.Duration} weeks \t${res.TotalTasks}\t${res.Effort} person-weeks  \t(${comment})\n`);
            }
            write(`\n`);
            write(`Error rates:\n - Weekly throughput: ${result.tpErrorRate}%\n - Task lead-times: ${result.ltErrorRate}%\n`);
            write(`  (Aim to keep these below 25% by adding more sample data. (< 10% Great, < 25% Good)\n`);
            write(`   This is the measure of how two random groups of your sample data would align when forecasting.\n`);
            write(`   Anything below 25% is good, but lower is better. It grows if there is too little data\n`);
            write(`   and ALSO if the process changes over time and you use too much data.)\n`);
        }, 100);

    }
    function loadDataFromUrl() {
        try {
            currentlyLoadedHash = location.hash;
            const simulationData = JSON.parse(atob(location.hash.trim().substring(1)));
            for (const name of Object.getOwnPropertyNames(simulationData)) {
                const $el = $('#' + name);
                if ($el.is('input,textarea')) {
                    $el.val(typeof (simulationData[name]) == 'Array' ? simulationData[name].join(',') : simulationData[name]);
                }
            }
            $('#risks').find('.risk-row').remove();
            if (simulationData.risks && simulationData.risks.length > 0) {
                for (const risk of simulationData.risks) {
                    fillRisk(risk, addRisk());
                }
            }
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
    if (location.hash && location.hash.trim().length > 1) {
        if (loadDataFromUrl()) {
            runSimulation();
        }
    }
    window.onhashchange = function () {
        if (currentlyLoadedHash != location.hash) {
            location.reload();
        }
    }

    $('#addRisk').on('click', addRisk);
    $('#share').on('click', share);
    $('#run').on('click', runSimulation);

});