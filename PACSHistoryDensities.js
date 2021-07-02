"use strict";

let dataFilename = "statisticsData.json";
let k_DefaultParameters = {
	hierarchyBitSet :[true, true, true, true],
	percentiles : [0.10, 0.5, 0.90],
	minimumBorder : 2,
	maximumBorder : 0,
	minimumCount: 1000,
	absoluteIntensity: true,
	selectedProperty : "Density",
	selectedFilterProperty : "Density",
	fromEnd: true,
	absolutePlot:false,
	smoothFilter : false,
	smoothVisualization: false,
	smoothCoefficient: 1,
	smoothWindow: 4
};

const PACSDisplayHeight = 20;
const PACSDisplayLevelPadding = 15;
const PACSDisplayTextPadding = 15;
const PACSGridColor = "#f2f2f2";
const PACSHeatMapStart = 100;

// Margins
const margin = {
	top: 30,
	right: 10,
	bottom: 10,
	left: 10
};

let width = 500 - margin.left - margin.right;
let height = 10000 - margin.top - margin.bottom;



d3.selection.prototype.moveToFront = function () {
	return this.each(function () {
		this.parentNode.appendChild(this);
	});
};
d3.selection.prototype.moveToBack = function () {
	return this.each(function () {
		var firstChild = this.parentNode.firstChild;
		if (firstChild) {
			this.parentNode.insertBefore(this, firstChild);
		}
	});
};


function interpolatePercentile(data, percentiles) {
	var cumsum = [data[0]];
	var rangeArray = [...data.keys()].map(d => d + 1);
	var totalSum = math.sum(data);
	for (let i = 0, l = data.length - 1; i < l; i++) {
		cumsum[i + 1] = cumsum[i] + data[i + 1];
	}
	let percentileInterpolate = d3.scaleLinear()
		.domain([0].concat(cumsum))
		.range([0].concat(rangeArray));

	let indices = [];
	for (let value of percentiles) {
		indices.push(percentileInterpolate(value * totalSum));
	}
	// let indices = [];
	// let totalSum = 0.0;
	// for (let i = 0; i < data.length; i++) {
	// 	totalSum+=data[i];
	// }
	// for (let value of percentiles){
	// 	let currentIndex = 0;
	// 	let cummulative = 0.0;
	// 	for (let i = 0; i < data.length; i++) {
	// 		cummulative+=data[i];
	// 		currentIndex = i;
	// 		if(cummulative/totalSum>=value){
	// 			break;
	// 		}
	// 	}
	// 	if(value==0.5){
	// 		let maxValue = 0.0;
	// 		for (let i = 0; i < data.length; i++) {
	// 			if(maxValue<data[i]){
	// 				maxValue=data[i];
	// 				currentIndex = i;
	// 			}
	// 		}
	// 	}
	// 	indices.push(currentIndex);
	// }

	//return [data.length*0.1,data.length*0.5,data.length*0.9];
	return indices;
}


let topAxis = d3.select("body")
	.append("div")
	.style("width", "100%")
	.style("height", margin.top + "px")
	.style("background-color", "white")
	.style("position", "fixed")
	.style("top", "0px")
	.style("left", "0px")
	.style("z-index", "2")


let menuItems = {
	//"name" : [params,values(...params), normalization(value,data)]
	// "Articles Count": [["Count"], count => count, null],
	// "Jaccard": [["Jaccard"], count => count, null],
	// "JaccardConsensus": [["JaccardConsensus"], count => count, null],
	// "Articles (%)": [["Count"], count => count, "SumCount"],
	// "Citations Count": [["Citations"], citations => citations, null],
	// "Citations (%)": [
	// 	["Citations"],
	// 	citations => citations,
	// 	"SumCitations"
	// ],
	// "Citations (Avg.)": [
	// 	["Citations", "Count"],
	// 	(citations, count) =>
	// 		citations.map((value, index) => {
	// 			let countValue = count[index];
	// 			return countValue ? value / countValue : 0;
	// 		}),
	// 	null
	// ]
	"Density": [["Density"], count => count, null]
}

let menuKeys = Object.keys(menuItems);
d3.select("#inputDataSelector")
.selectAll("option.fileOptions")
.data(menuKeys)
.enter()
.append("option")
.classed("fileOptions", true)
.text((d) => d)

d3.select("#inputDataSelector").property("value",k_DefaultParameters.selectedProperty);

d3.select("#filterSelector")
.selectAll("option.fileOptions")
.data(menuKeys)
.enter()
.append("option")
.classed("fileOptions", true)
.text((d) => d)

d3.select("#filterSelector").property("value",k_DefaultParameters.selectedProperty);


function generateVisualization(data, inputParameters) {
	let parameters = Object.assign({},k_DefaultParameters);
	if (inputParameters) {
		Object.assign(parameters, inputParameters);
	}
	window.statisticsData = data;

	let PACSTree = data.PACSTree;
	let PACSDict = data.PACSDict;
	let PACSCitations = data.Citations;
	let PACSCount = data.Count;
	let PACSFeatures = data.PACSFeatures;
	let PACSKeywords = data.PACSKeywords;
	let PACSMinYear = data.MinYear;
	let PACSMaxYear = data.MaxYear;
	let PACS4thLevelDict = data.PACS4thLevelDict;
	let PACSSumData = {
		"SumCitations": data.Citations,
		"SumCount" : data.Count
	}
	let pacsColor = d3.scaleOrdinal(d3.schemeCategory10);

	let pacsForLevel = (pacsCode, level) => {
		pacsCode = pacsCode.replace(".", "");
		if (((level == 1) && (pacsCode.length > 0))) {
			return (pacsCode[0] + "0");
		} else if ((((level == 2) && (pacsCode.length >= 2)) && (pacsCode[1] != '0'))) {
			return pacsCode.slice(0, 2);
		} else if (((level == 3) && (pacsCode.length >= 4))) {
			return PACS4thLevelDict[pacsCode.slice(0, 4)];
		} else if ((((level == 4) && (pacsCode.length >= 6)) && (PACS4thLevelDict[pacsCode.slice(0, 4)] != pacsCode))) {
			return pacsCode.slice(0, 6);
		} else {
			return null;
		}
	}

	let calculateFeatureData = (features,propertyName) =>{
		let params = [];
		let [paramKeys,calcFunction,normalizeKey] = menuItems[propertyName];
		for (let key of paramKeys){
			params.push(features[key]);
		}
		//console.log(params);
		let nonNormalizedFeature = calcFunction(...params);
		
		if(normalizeKey){
			let normalizeFeature = PACSSumData[normalizeKey];
			return nonNormalizedFeature.map((d,index) => {
				return d/normalizeFeature[index];
			});
		}else{
			return nonNormalizedFeature;
		}
		
	}

	let displayFilter = ([pacsCode, level]) => {
		if (parameters.hierarchyBitSet[level] && pacsCode in PACSFeatures) {
			// if("Count" in PACSFeatures[pacsCode]){
			// 	let countData = PACSFeatures[pacsCode]["Count"];
			// 	let maxValue = Math.max(...countData);
			// 	let minValue = Math.min(...countData);

			// 	let featureData = calculateFeatureData(PACSFeatures[pacsCode],parameters.selectedFilterProperty);
			// 	if(parameters.smoothFilter){
			// 		featureData = Taira.smoothen(featureData, Taira.ALGORITHMS.GAUSSIAN, parameters.smoothWindow, parameters.smoothCoefficient, false)
			// 	}
			// 	let boxPlotPercentiles = interpolatePercentile(featureData, parameters.percentiles);
			// 	return maxValue > minValue && math.sum(countData) > parameters.minimumCount && boxPlotPercentiles[0] >= parameters.minimumBorder && (boxPlotPercentiles[2] <= featureData.length - parameters.maximumBorder);
			// }else{
			// 	return true;
			// }
			let countData = PACSFeatures[pacsCode]["Density"]
			let maxValue = Math.max(...countData);
			let minValue = Math.min(...countData);
			return maxValue > minValue 
		} else {
			return false;
		}
	}

	window.pacsForLevel = pacsForLevel;
	d3.selectAll(".plot").remove();
	let svg = d3.select("body")
		.append("svg")
		.classed("plot", true)
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom);

	let plotArea = svg
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	let allPACS = [];
	let treeString = "";
	Object.keys(PACSTree).sort().forEach((key, index) => {
		let pacsQueue = [[PACSTree[key], key, 0]];
		while (pacsQueue.length > 0) {
			let tree, pacsCode, level;
			[tree, pacsCode, level] = pacsQueue.pop();
			let levelString = "";
			for (let l = 0; l < level; l++) {
				levelString += "--";
			}
			allPACS.push([pacsCode, level]);
			treeString += (levelString + pacsCode + "\n");
			Object.keys(tree).sort().reverse().forEach((pacsKey, index) => {
				pacsQueue.push([tree[pacsKey], pacsKey, level + 1]);
			});
		}
	});

	let displayedPACS = allPACS.filter(displayFilter);
	// let displayedPACS = allPACS;

	 
	let rectWidth = (width - PACSHeatMapStart) / (PACSMaxYear - PACSMinYear + 1);

	//d3.select("body").select("div.topAxisMenu").remove();
	let topAxis = d3.select("body")
		.append("div")
		.classed("topAxisMenu",true)
		.style("width", "100%")
		.style("height", margin.top + "px")
		.style("background-color", "white")
		.style("position", "fixed")
		.style("top", "0px")
		.style("left", "0px")
		.style("z-index", "2")

	let topAxisSVG = topAxis.append("svg")
		.attr("width", PACSHeatMapStart + width + margin.left + margin.right)
		.attr("height", margin.top)
		.classed("axis", true);

	let axisScale = d3.scaleLinear()
		.domain([PACSMinYear,PACSMaxYear])
		.range([PACSHeatMapStart, width-rectWidth*1]);

	var yearAxis = d3.axisTop(axisScale).tickFormat(d3.format("d")).ticks((PACSMaxYear-PACSMinYear+1)/10);

	let axisArea = topAxisSVG.append("g")
		.attr("transform", "translate(" + (margin.left+rectWidth*0.5) + "," + 27 + ")")
		.call(yearAxis);
	
	window.displayedPACS = displayedPACS;
	//console.log(treeString);


	height = PACSDisplayHeight * displayedPACS.length;
	svg.attr("height", height + margin.top + margin.bottom);

	plotArea.append("line")
		.style("stroke", PACSGridColor)
		.attr("x1", PACSHeatMapStart)
		.attr("x2", PACSHeatMapStart)
		.attr("y1", 0)
		.attr("y2", height);

	plotArea.append("line")
		.style("stroke", PACSGridColor)
		.attr("x1", width)
		.attr("x2", width)
		.attr("y1", 0)
		.attr("y2", height);

	let colorMin = Infinity;
	let colorMax = -Infinity;
	
	if(parameters.absoluteIntensity || parameters.absolutePlot){
		displayedPACS.forEach(([pacsCode, level], index) => {
			let featureData = calculateFeatureData(PACSFeatures[pacsCode],parameters.selectedProperty);
			if(parameters.smoothVisualization){
				featureData = Taira.smoothen(featureData, Taira.ALGORITHMS.GAUSSIAN, parameters.smoothWindow, parameters.smoothCoefficient, false)
			}
			let maxValue = Math.max(...featureData);
			let minValue = Math.min(...featureData);
			colorMin = math.min(colorMin,minValue);
			colorMax = math.max(colorMax,maxValue);
		});
	}

	let chartMargin = { top: 10, right: 20, bottom: 30, left: 50 };

	let chartWidth = 400 - chartMargin.left - chartMargin.right;
	let chartHeight = 200 - chartMargin.top - chartMargin.bottom;

	let chartXScale = d3.scaleLinear()
		.domain([PACSMinYear, PACSMaxYear])
		.range([0, chartWidth]);

	let chartYScale = d3.scaleLinear()
		.domain([0, 1])
		.range([chartHeight, 0]);

	if(parameters.absolutePlot){
		chartYScale = chartYScale.domain([colorMin, colorMax]);
	}
	

	let tooltip = d3.select("body").append("div")
	.attr("class", "tooltip")
	.style("display", "none");
	
	d3.select("#plotPanel svg").remove();
	
	let chartSVG = d3.select("#plotPanel").append("svg")
		.attr("width", chartWidth + chartMargin.left + chartMargin.right)
		.attr("height", chartHeight + chartMargin.top + chartMargin.bottom)
		.append("g")
		.attr("transform", "translate(" + chartMargin.left + "," + chartMargin.top + ")");
	
		d3.select("#plotPanel").style("height", (chartHeight + chartMargin.top + chartMargin.bottom)+ "px")
		
	let chartAxisBottom = d3.axisBottom(chartXScale).tickFormat(d3.format("d")).ticks((PACSMaxYear-PACSMinYear+1)/10);;
	let chartAxisLeft = d3.axisLeft(chartYScale);

	chartSVG.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + chartHeight + ")")
		.call(chartAxisBottom);

	chartSVG.append("g")
		.attr("class", "y axis")
		.call(chartAxisLeft);
	
	
	let birthDates = [];
	displayedPACS.forEach(([pacsCode, level], index) => {

		//Draw PACS History
		let pacsDisplayArea = plotArea.append("g")
			.attr("transform", "translate(0," + (index * PACSDisplayHeight) + ")");

		pacsDisplayArea.append("text")
			.attr("class", "pacsName" + level)
			.attr("x", PACSDisplayLevelPadding * level)
			.attr("y", PACSDisplayTextPadding)
			.attr("fill", pacsColor(pacsForLevel(pacsCode, 1)))
			//.attr("fill", )
			.text(pacsCode);

		for (let l = 0; l < level; l++) {
			let lineX = PACSDisplayLevelPadding * l + 0.5 * PACSDisplayLevelPadding;

			pacsDisplayArea.append("line")
				.attr("class", "hierarchy-line")
				.style("stroke", PACSGridColor)
				.attr("x1", lineX)
				.attr("x2", lineX)
				.attr("y1", 0)
				.attr("y2", PACSDisplayHeight);
		}

		let pacsHeatmapArea = pacsDisplayArea.append("g")
			.attr("transform", "translate(" + PACSHeatMapStart + "," + (0) + ")");

		//console.log(pacsCode);

		let featureData = calculateFeatureData(PACSFeatures[pacsCode],parameters.selectedProperty);
		if(parameters.smoothVisualization){
			featureData = Taira.smoothen(featureData, Taira.ALGORITHMS.GAUSSIAN, parameters.smoothWindow, parameters.smoothCoefficient, false)
		}
		
		let maxValue = Math.max(...featureData);
		let minValue = Math.min(...featureData);

		if (maxValue == minValue) {
			maxValue = 1;
			minValue = 0;
		}
		
		// minValue = 0;

		//var colorScale = d3.scaleSequential(d3["interpolateGnBu"])
		//.domain([0, maxValue]);
		var colorScale = d3.scaleLinear()
			.domain([parameters.absoluteIntensity?colorMin:minValue, parameters.absoluteIntensity?colorMax:maxValue])
			.range(["#ffffff", d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(0.5)])

		//console.log(featureData);
		for (let year = PACSMinYear; year <= PACSMaxYear; year++) {
			let yearIndex = year - PACSMinYear;
			//console.log(yearIndex);
			pacsHeatmapArea.append("rect")
				.attr("x", rectWidth * yearIndex)
				.attr("y", 0)
				.attr("width", rectWidth)
				.attr("height", PACSDisplayHeight)
				.attr("stroke", colorScale(featureData[yearIndex]))
				.attr("stroke-width", "0")
				.attr("fill", colorScale(featureData[yearIndex]));

		}

		let chartDataset = featureData.map((d) => (
			{ "y": parameters.absolutePlot?d:(d-minValue)/(maxValue-minValue)})
		);

		//console.log(chartDataset);

		let chartClassCode = pacsCode.replace("-","M").replace("+","P")
		let pacsChart = chartSVG.append("g").attr("class", "plot"+chartClassCode);

		let line = d3.line()
			.x((d, i) => chartXScale(i+PACSMinYear))
			.y(d => chartYScale(d.y))
			// .curve(d3.curveMonotoneX)

		pacsChart.append("path")
			.datum(chartDataset)
			.attr("class", "line")
			.attr("fill", "none")
			.attr("stroke", pacsColor(pacsForLevel(pacsCode, 1)))
			.attr("opacity",0.2)
			.attr("d", line);

		// pacsChart.selectAll(".dot")
		// 	.data(chartDataset)
		// 	.enter().append("circle") // Uses the enter().append() method
		// 	.attr("class", "dot") // Assign a class for styling
		// 	.attr("cx", (d,i) => chartXScale(i+PACSMinYear) )
		// 	.attr("cy", (d) => chartYScale(d.y))
		// 	.attr("r", 2);



		pacsDisplayArea.append("line")
			.attr("class", "hierarchy-line")
			.style("stroke", PACSGridColor)
			.attr("x1", PACSDisplayLevelPadding * (level - 1) + 0.5 * PACSDisplayLevelPadding)
			.attr("x2", width)
			.attr("y1", 0)
			.attr("y2", 0);

		var xScale = d3.scaleLinear()
			.domain([0, (featureData).length])
			.range([PACSHeatMapStart, width]);

		let boxPlotPercentiles = interpolatePercentile(featureData, parameters.percentiles);



		pacsDisplayArea.append("line")
		.attr("class", "boxplot-line")
		.style("stroke", d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(1.5))
		.style("stroke-width", "2px")
		.style("stroke-linecap", "square")
		.attr("x1", xScale(boxPlotPercentiles[0]))
		.attr("x2", xScale(boxPlotPercentiles[0]))
		.attr("y1", PACSDisplayHeight * 0.35)
		.attr("y2", PACSDisplayHeight - 2);

		birthDates.push(Math.round(boxPlotPercentiles[0])+PACSMinYear);
		if(parameters.fromEnd){
			pacsDisplayArea.append("line")
				.attr("class", "boxplot-line")
				.style("stroke", d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(1.5))
				.style("stroke-width", "2px")
				.style("stroke-linecap", "square")
				.attr("x1", xScale(boxPlotPercentiles[0]))
				.attr("x2", xScale(PACSMaxYear-PACSMinYear+1))
				.attr("y1", PACSDisplayHeight - 2)
				.attr("y2", PACSDisplayHeight - 2);
		}else{

			pacsDisplayArea.append("line")
				.attr("class", "boxplot-line")
				.style("stroke", d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(1.5))
				.style("stroke-width", "2px")
				.style("stroke-linecap", "square")
				.attr("x1", xScale(boxPlotPercentiles[0]))
				.attr("x2", xScale(boxPlotPercentiles[2]))
				.attr("y1", PACSDisplayHeight - 2)
				.attr("y2", PACSDisplayHeight - 2);

			pacsDisplayArea.append("line")
				.attr("class", "boxplot-line")
				.style("stroke", d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(1.5))
				.style("stroke-width", "2px")
				.style("stroke-linecap", "square")
				.attr("x1", xScale(boxPlotPercentiles[1]))
				.attr("x2", xScale(boxPlotPercentiles[1]))
				.attr("y1", PACSDisplayHeight * 0.35)
				.attr("y2", PACSDisplayHeight - 2);

			pacsDisplayArea.append("line")
				.attr("class", "boxplot-line")
				.style("stroke", d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(1.5))
				.style("stroke-width", "2px")
				.style("stroke-linecap", "square")
				.attr("x1", xScale(boxPlotPercentiles[2]))
				.attr("x2", xScale(boxPlotPercentiles[2]))
				.attr("y1", PACSDisplayHeight * 0.35)
				.attr("y2", PACSDisplayHeight - 2);
		}
		
		let selectionRect = pacsDisplayArea.append("rect")
			.attr("x", PACSHeatMapStart+1)
			.attr("y", 1)
			.style("opacity", 0.0)
			.attr("width", width-PACSHeatMapStart-2)
			.attr("height", PACSDisplayHeight-3)
			.attr("fill", "none")
			.attr("stroke","#333333")
			.attr("stroke-width",2)

		pacsDisplayArea.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.style("opacity", 0.0)
			.attr("width", width)
			.attr("height", PACSDisplayHeight)
			.attr("fill", "white")
			.on("click", d => {
				if(selectionRect.classed("selected")){
					selectionRect.classed("selected",false);
					selectionRect.style("opacity", 0.0);
					d3.select(".plot"+chartClassCode+" .line")
						.attr("opacity",0.2)
						.attr("stroke-width",1.0)
				}else{
					selectionRect.classed("selected",true);
					selectionRect.style("opacity", 1.0);
					d3.select(".plot"+chartClassCode).moveToFront();
						d3.select(".plot"+chartClassCode+" .line")
						.attr("opacity",1.0)
						.attr("stroke-width",1.5)
				}
			})
			.on("mousemove", d=>{

				tooltip
				.style("left", (d3.event.pageX) + "px")
				.style("top", (d3.event.pageY) + "px");

			})
			.on("mouseover", d=>{
				let fullName = "";
				for(let i=0;i<4;i++){
					let pacsName = "";
					if(pacsForLevel(pacsCode,i) in PACSDict){
						pacsName = PACSDict[pacsForLevel(pacsCode,i)];
					}

					d3.select("#pacsLevel"+i)
					.style("color",d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(1.5))
					.text(pacsName);
					if(i>1 && pacsName!=""){
						fullName+=": ";
					}
					fullName+=pacsName;
				}

				tooltip.text(fullName)
				tooltip.style("color",d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(1.5))
				let backgroundColor = d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).brighter(1)
				backgroundColor.opacity = 0.8;
				console.log(backgroundColor)
				// tooltip.style("background",backgroundColor)

				let pacsKeywordsText = "";
				if(pacsCode in PACSKeywords){
					pacsKeywordsText = PACSKeywords[pacsCode].join(", ");
				}

				d3.select("#pacsKeywords")
				.style("color",d3.rgb(pacsColor(pacsForLevel(pacsCode, 1))).darker(1.5))
				.text(pacsKeywordsText);
				
				// d3.select(".plot"+chartClassCode+" .line")
				// .attr("opacity",1.0)
				// .attr("stroke-width",3.0);
			})
			.on("mouseenter",d=>{
				d3.select(".plot"+chartClassCode).moveToFront();
				d3.select(".plot"+chartClassCode+" .line")
				.attr("opacity",1.0)
				.attr("stroke-width",3.0)
  			tooltip.style("display", "inline");
			})
			.on("mouseout", d=> {
				tooltip.style("display", "none");
				for(let i=0;i<4;i++){
					let pacsName = "";
					if(pacsForLevel(pacsCode,i)){
						
					}
					d3.select("#pacsLevel"+i).text("");
				}
				d3.select("#plotArea").select("svg").remove();

				if(selectionRect.classed("selected")){
					d3.select(".plot"+chartClassCode+" .line")
					.attr("opacity",1.0)
					.attr("stroke-width",1.5)
				}else{
					d3.select(".plot"+chartClassCode+" .line")
						.attr("opacity",0.2)
						.attr("stroke-width",1.0)
				}
			});
	})


	let histogramMargin = { top: 10, right: 20, bottom: 20, left: 50 };
	
		let histogramWidth = 400 - histogramMargin.left - histogramMargin.right;
		let histogramHeight = 75 - histogramMargin.top - histogramMargin.bottom;
	
		let histogramXScale = d3.scaleLinear()
			.domain([PACSMinYear-0.5, PACSMaxYear+0.5])
			.range([0, histogramWidth]);
	
		d3.select("#histogramPanel svg").remove();
		
		let histogramSVG = d3.select("#histogramPanel").append("svg")
			.attr("width", histogramWidth + histogramMargin.left + histogramMargin.right)
			.attr("height", histogramHeight + histogramMargin.top + histogramMargin.bottom)
			.append("g")
			.attr("transform", "translate(" + histogramMargin.left + "," + histogramMargin.top + ")");
	
	

		var bins = d3.histogram()
			.domain(histogramXScale.domain())
			.thresholds(50)
			(birthDates);

		var histogramYScale = d3.scaleLinear()
			.domain([0, d3.max(bins, function (d) { return d.length; })])
			.range([histogramHeight, 0]);

		let barWidth = (histogramXScale(bins[0].x1) - histogramXScale(bins[0].x0))*1.9;
		var bar = histogramSVG.selectAll(".bar")
			.data(bins)
			.enter().append("g")
			.attr("class", "bar")
			.attr("transform", function (d) { return "translate(" + (histogramXScale(d.x0)-barWidth/2) + "," + histogramYScale(d.length) + ")"; });

		bar.append("rect")
			.attr("x", 0)
			.attr("width", barWidth)
			.attr("height", function (d) { return histogramHeight - histogramYScale(d.length); });

		// var formatCount = d3.format(",.0f");
		// bar.append("text")
		// 	.attr("dy", ".75em")
		// 	.attr("y", 6)
		// 	.attr("x", (histogramXScale(bins[0].x1) - histogramXScale(bins[0].x0)) / 2)
		// 	.attr("text-anchor", "middle")
		// 	.text(function (d) { return formatCount(d.length); });

		let histogramAxisBottom = d3.axisBottom(histogramXScale).tickFormat(d3.format("d")).ticks((PACSMaxYear-PACSMinYear+1)/10);;
		let histogramAxisLeft = d3.axisLeft(histogramYScale).ticks(2);
	
		histogramSVG.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + histogramHeight + ")")
			.call(histogramAxisBottom);
	
		histogramSVG.append("g")
			.attr("class", "y axis")
			.call(histogramAxisLeft);

		
}


function readParameters(){
	var parameters = {};
	parameters.hierarchyBitSet = [
		d3.select("#levelCheckbox1").node().checked,
		d3.select("#levelCheckbox2").node().checked,
		d3.select("#levelCheckbox3").node().checked,
		d3.select("#levelCheckbox4").node().checked];
	let percentileValue = +document.getElementById('percentile').value;
	parameters.minimumBorder = +document.getElementById('borderMin').value;
	parameters.maximumBorder = +document.getElementById('borderMax').value;
	parameters.minimumCount= +document.getElementById('minimumCount').value;
	parameters.selectedProperty = d3.select("#inputDataSelector").property('value');
	parameters.selectedFilterProperty = d3.select("#filterSelector").property('value');
	parameters.absoluteIntensity = d3.select("#normalizeColor").node().checked;
	parameters.fromEnd = d3.select("#endPercentile").node().checked;
	parameters.absolutePlot = d3.select("#absoluteChart").node().checked;
	parameters.smoothFilter = d3.select("#filterSmooth").node().checked;
	parameters.smoothVisualization = d3.select("#visualizationSmooth").node().checked;
	parameters.smoothCoefficient = +document.getElementById('smoothingCoefficient').value;
	parameters.smoothWindow = +document.getElementById('smoothingWindowSize').value;
	if(parameters.fromEnd){
		parameters.percentiles = [1.0-percentileValue/100.0, 1.0, 1.0];
	}else{
		parameters.percentiles = [0.5-percentileValue/200.0, 0.5, 0.5+percentileValue/200.0];
	}
	return parameters;
}





function generateNewVisualization(){
	d3.json(dataFilename, (error, data) => {	
		generateVisualization(data,readParameters());
	});
}
generateNewVisualization();

