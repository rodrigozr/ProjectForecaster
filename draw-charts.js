const chartsCache = {};

function drawHistogram(id, durations) {
    if (chartsCache[id]) {
        chartsCache[id].destroy();
        chartsCache[id] = null;
    }
    const ctx = document.getElementById(id).getContext('2d');
    const histogram = {};
    for (const val of durations) {
        histogram[val] = (histogram[val] || 0) + 1;
    }
    const keys = sortNumbers(Object.keys(histogram));
    const labels = keys.map(n => n.toString());
    const data = keys.map(key => histogram[key]);

    chartsCache[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Duration in calendar weeks',
                data: data,
                borderWidth: 1,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',                
            }]
        },
        options: {
            tooltips: {
                mode: 'disabled'
            },
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }],
                xAxes: [
                    {
                        scaleLabel: {
                            display: true,
                            labelString: 'Calendar weeks'
                        }
                    }
                ]
            }
        }
    });
}