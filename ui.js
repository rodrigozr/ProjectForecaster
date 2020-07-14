$(function () {
    $('[data-toggle="tooltip"]').tooltip({delay: 500});

    function parseSamples(selector) {
        let val = $(selector).val() || '';
        if (val.trim().length === 0) return [];
        return val.split(/[\s\n,]/).map(s => s.trim().length > 0 ? Number(s.trim()) : NaN).filter(n => n != NaN).filter(n => n >= 0);
    }
    function parseRisks(selector) {
        const risks = [];
        $(selector).find('tbody').find('tr').each((_index, el) => {
            const $el = $(el);
            const risk = {
                likelihood: $el.find("input[name='likelihood']").val(),
                lowImpact: $el.find("input[name='lowImpact']").val(),
                highImpact: $el.find("input[name='highImpact']").val(),
                description: $el.find("input[name='description']").val(),
            };
            if (risk.likelihood && risk.lowImpact && risk.highImpact) {
                risk.likelihood = parseInt(risk.likelihood) || 0;
                risk.lowImpact = parseInt(risk.lowImpact) || 0;
                risk.highImpact = parseInt(risk.highImpact) || 0;
                risks.push(risk);
            }
        });
        return risks;
    }
    const $riskRowTemplate = $('#risks').find('tbody').find('tr').clone();
    function addRisk() {
        const $row = $riskRowTemplate.clone();
        $('#risks').find('tbody').append($row);
        return $row;
    }
    function fillRisk(risk, $row) {
        $row.find("input[name='likelihood']").val(risk.likelihood);
        $row.find("input[name='lowImpact']").val(risk.lowImpact);
        $row.find("input[name='highImpact']").val(risk.highImpact);
        $row.find("input[name='description']").val(risk.description);
    }
    function share() {
        if (readSimulationData()) {
            navigator.clipboard.writeText(location.href);
            $('#share').popover('show');
            setTimeout(() => $('#share').popover('dispose'), 2000);
        }
    }
    let currentlyLoadedHash = null;
    function readSimulationData() {
        const simulationData = {
            teamName: $('#teamName').val(),
            projectName: $('#projectName').val(),
            numberOfSimulations: parseInt($('#numberOfSimulations').val()),
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
    $('#addRisk').on('click', addRisk);
    $('#share').on('click', share);
    $('#run').on('click', function () {
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
            const p85 = result.resultsTable.filter(r => r.Likelihood == 85).pop();
            $('#res-effort').val(p85.Effort);
            $('#res-duration').val(p85.Duration);
            let endDate = '(No start date set)';
            if (simulationData.startDate) {
                const oneWeek = 1000 * 60 * 60 * 24 * 7;
                endDate = new Date(new Date(simulationData.startDate).getTime() + (p85.Duration * oneWeek)).toDateString();
            }
            $('#res-endDate').val(endDate);
            drawHistogram('res-duration-histogram', result.durationHistogram);

            write(`Project forecast summary (with 85% of confidence):\n`);
            write(` - Up to ${p85.Effort} person-weeks of effort\n`);
            write(` - Can be delivered in up to ${p85.Duration} calendar weeks\n`);
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

    });
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
            $('#risks').find('tbody').find('tr').remove();
            if (simulationData.risks && simulationData.risks.length > 0) {
                for (const risk of simulationData.risks) {
                    fillRisk(risk, addRisk());
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
    if (location.hash && location.hash.trim().length > 1) {
        loadDataFromUrl();
    }
    window.onhashchange = function() {
        if (currentlyLoadedHash != location.hash) {
            location.reload();
        }
    }

});