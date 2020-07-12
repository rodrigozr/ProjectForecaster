$(function () {
    $('[data-toggle="tooltip"]').tooltip();

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
    function addRisk() {
        const $row = $(`
        <tr>
            <td><input type="number" min="0" max="100" name="likelihood"></input>%</td>
            <td><input type="number" min="0" max="100" name="lowImpact"></input> tasks</td>
            <td><input type="number" min="0" max="100" name="highImpact"></input> tasks</td>
            <td><input type="text" name="description"></input></td>
        </tr>
        `);
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
            console.log('uhuu');
            navigator.clipboard.writeText(location.href);
            $('#share').popover('show');
            setTimeout(() => $('#share').popover('dispose'), 2000);
        }
    }
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
        const b64 = btoa(JSON.stringify(simulationData));
        location.hash = b64;
        return simulationData;
    }
    $('#addRisk').on('click', addRisk);
    $('#share').on('click', share);
    $('#run').on('click', function () {
        const simulationData = readSimulationData();
        if (!simulationData) return;

        // Run the simulation
        const result = runMonteCarloSimulation(simulationData);
        $('#results-main').show();
        const $results = $('#results');
        $results.val(`Error rate - TP: ${result.tpErrorRate}%, LT: ${result.ltErrorRate}% (Aim to keep this below 25%. By adding more sample data. Lower is better)\n\n`);
        for (const res of result.resultsTable) {
            $results.val($results.val() + `Likelihood: ${res.Likelihood}%\tDuration: ${res.Duration}\tTotalTasks: ${res.TotalTasks}\tEffort: ${res.Effort}\tLT: ${res.LT}\n`);
        }
    });
    if (location.hash && location.hash.trim().length > 1) {
        try {
            const simulationData = JSON.parse(atob(location.hash.trim().substring(1)));
            for (const name of Object.getOwnPropertyNames(simulationData)) {
                const $el = $('#' + name);
                if ($el.is('input,textarea')) {
                    $el.val(typeof (simulationData[name]) == 'Array' ? simulationData[name].join(',') : simulationData[name]);
                }
            }
            if (simulationData.risks.length > 0) {
                for (let i = 0; i < simulationData.risks.length; i++) {
                    const risk = simulationData.risks[i];
                    fillRisk(risk, i == 0 ? $('#risks').find('tbody').find('tr') : addRisk());
                }
                for (const risk of simulationData.risks) {

                }
            }
        } catch (error) {
            console.error(error);
        }
    }
});