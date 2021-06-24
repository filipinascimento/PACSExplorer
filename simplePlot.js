
let chartMargin = { top: 40, right: 30, bottom: 30, left: 30 };

let chartWidth = 300 - chartMargin.left - chartMargin.right;
let chartHeight = 200 - chartMargin.top - chartMargin.bottom;

var xScale = d3.scaleLinear()
    .domain([0, n - 1])
    .range([0, chartWidth]);

var yScale = d3.scaleLinear()
    .domain([0, 1]) // input 
    .range([chartHeight, 0]);

// 7. d3's line generator
var line = d3.line()
    .x((d, i) => xScale(i))
    .y(d => yScale(d.y))
    .curve(d3.curveMonotoneX)

var dataset = d3.range(n).map(function (d) { return { "y": d3.randomUniform(1)() } })

var chartSVG = d3.select("#plotPanel").append("svg")
    .attr("width", chartWidth + chartMargin.left + chartMargin.right)
    .attr("height", chartHeight + chartMargin.top + chartMargin.bottom)
    .append("g")
    .attr("transform", "translate(" + chartMargin.left + "," + chartMargin.top + ")");

chartSVG.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + chartHeight + ")")
    .call(d3.axisBottom(xScale)); // Create an axis component with d3.axisBottom

chartSVG.append("g")
    .attr("class", "y axis")
    .call(d3.axisLeft(yScale)); // Create an axis component with d3.axisLeft

chartSVG.append("path")
    .datum(dataset) // 10. Binds data to the line 
    .attr("class", "line") // Assign a class for styling 
    .attr("fill", pacsColor(pacsForLevel(pacsCode, 1)))
    .attr("fill", )
    .attr("d", line); // 11. Calls the line generator 

chartSVG.selectAll(".dot")
    .data(dataset)
    .enter().append("circle") // Uses the enter().append() method
    .attr("class", "dot") // Assign a class for styling
    .attr("cx", function (d, i) { return xScale(i) })
    .attr("cy", function (d) { return yScale(d.y) })
    .attr("r", 5);


