/**
 * viz-sdk.js
 *
 * This file contains the core classes for the custom visualization SDK.
 * - VizSDK: The main entry point for creating charts.
 * - DataProcessor: A utility class for handling data manipulation and aggregation.
 * - StackedColumnChart: A class for rendering and managing a stacked column chart.
 */

/**
 * The main SDK class, acting as a factory for creating visualizations.
 */
class VizSDK {
    /**
     * Creates and renders a chart of a specified type.
     * @param {string} type - The chart type, e.g., 'StackedColumn'.
     * @param {HTMLElement} container - The DOM element where the chart will be rendered.
     * @param {Array<Object>} data - The dataset to visualize.
     * @param {Object} options - Configuration options for the chart.
     * @returns {Object|null} The created chart instance or null on failure.
     */
    static createChart(type, container, data, options) {
        if (!container) {
            console.error("VizSDK Error: A container element must be provided.");
            return null;
        }

        switch (type) {
            case 'StackedColumn': {
                const chart = new StackedColumnChart(container, data, options);
                chart.render();
                return chart;
            }
            case 'Pie': {
                const chart = new PieChart(container, data, options);
                chart.render();
                return chart;
            }
            case 'Funnel': {
                const chart = new FunnelChart(container, data, options);
                chart.render();
                return chart;
            }
            case 'Line': {
                const chart = new LineChart(container, data, options);
                chart.render();
                return chart;
            }
            default:
                console.error(`VizSDK Error: Chart type "${type}" is not supported.`);
                return null;
        }
    }
}

/**
 * Handles data loading, processing, and aggregation.
 */
class DataProcessor {
    /**
     * @param {Array<Object>} data - The raw JSON dataset.
     */
    constructor(data) {
        this.data = data || [];
    }

    /**
     * Groups and aggregates data for a stacked column chart.
     * @param {string} categoryKey - The data key to group by (X-axis).
     * @param {string} stackByKey - The data key for stacking within each category.
     * @param {string} valueKey - The data key for the numerical value to aggregate.
     * @returns {{groupedData: Array<Object>, maxTotal: number, uniqueSegments: Array<string>}}
     */
    getStackedData(categoryKey, stackByKey, valueKey) {
        const grouped = {};
        const uniqueSegments = new Set();
        let maxTotal = 0;

        this.data.forEach(item => {
            const category = item[categoryKey];
            const segment = item[stackByKey];
            const value = item[valueKey];

            uniqueSegments.add(segment);

            if (!grouped[category]) {
                grouped[category] = {
                    total: 0,
                    segments: {}
                };
            }

            if (!grouped[category].segments[segment]) {
                grouped[category].segments[segment] = 0;
            }

            grouped[category].segments[segment] += value;
            grouped[category].total += value;
        });

        const groupedData = Object.keys(grouped).map(category => {
            if (grouped[category].total > maxTotal) {
                maxTotal = grouped[category].total;
            }
            return {
                category,
                ...grouped[category]
            };
        });

        return {
            groupedData,
            maxTotal,
            uniqueSegments: Array.from(uniqueSegments)
        };
    }

    /**
     * Aggregates data for a pie chart.
     * @param {string} categoryKey - The data key for the pie slices.
     * @param {string} valueKey - The data key for the numerical value.
     * @returns {{pieData: Array<Object>, total: number, uniqueCategories: Array<string>}}
     */
    getPieData(categoryKey, valueKey) {
        const aggregated = {};
        let total = 0;

        this.data.forEach(item => {
            const category = item[categoryKey];
            const value = item[valueKey];

            if (value > 0) {
                if (!aggregated[category]) {
                    aggregated[category] = 0;
                }
                aggregated[category] += value;
                total += value;
            }
        });

        const pieData = Object.keys(aggregated).map(category => ({
            category,
            value: aggregated[category]
        }));

        const uniqueCategories = Object.keys(aggregated);

        return { pieData, total, uniqueCategories };
    }

    /**
     * Prepares data for a funnel chart.
     * @param {string} categoryKey - The data key for the funnel stages.
     * @param {string} valueKey - The data key for the numerical value.
     * @returns {{funnelData: Array<Object>, maxValue: number}}
     */
    getFunnelData(categoryKey, valueKey) {
        // Aggregate data similar to pie chart
        const aggregated = {};
        this.data.forEach(item => {
            const category = item[categoryKey];
            const value = item[valueKey];
            if (value > 0) {
                if (!aggregated[category]) {
                    aggregated[category] = 0;
                }
                aggregated[category] += value;
            }
        });

        // Convert to array and sort descending by value
        let funnelData = Object.keys(aggregated).map(category => ({
            category,
            value: aggregated[category]
        })).sort((a, b) => b.value - a.value);

        const maxValue = funnelData.length > 0 ? funnelData[0].value : 0;

        // Calculate conversion rates
        funnelData = funnelData.map((d, i, arr) => {
            const conversion = (i === 0) ? 100 : (d.value / arr[i - 1].value) * 100;
            return { ...d, conversion: conversion.toFixed(2) };
        });

        return { funnelData, maxValue };
    }

    /**
     * Prepares data for a line chart.
     * @param {string} xKey - The data key for the x-axis.
     * @param {string} yKey - The data key for the y-axis (numerical value).
     * @returns {{lineData: Array<Object>, yMin: number, yMax: number}}
     */
    getLineData(xKey, yKey) {
        // For line charts, data is assumed to be pre-sorted by the x-axis key.
        const lineData = [...this.data];

        if (lineData.length === 0) {
            return { lineData: [], yMin: 0, yMax: 0 };
        }

        // Find min and max y-values for scaling the y-axis.
        let yMin = lineData[0][yKey];
        let yMax = lineData[0][yKey];

        lineData.forEach(item => {
            const value = item[yKey];
            if (value < yMin) yMin = value;
            if (value > yMax) yMax = value;
        });

        return { lineData, yMin, yMax };
    }
}

/**
 * Renders and manages a stacked column chart.
 */
class StackedColumnChart {
    /**
     * @param {HTMLElement} container - The DOM element for the chart.
     * @param {Array<Object>} data - The raw JSON data.
     * @param {Object} options - Chart configuration.
     * @param {string} options.categoryKey - The key for x-axis categories.
     * @param {string} options.stackByKey - The key for stacking segments.
     * @param {string} options.valueKey - The key for numerical values.
     */
    constructor(container, data, options) {
        this.container = container;
        this.data = data;
        this.options = options;
        this.dataProcessor = new DataProcessor(this.data);
        this.svgNS = "http://www.w3.org/2000/svg";
    }

    /**
     * Main method to render the chart.
     */
    render() {
        const { categoryKey, stackByKey, valueKey } = this.options;
        const { groupedData, maxTotal, uniqueSegments } = this.dataProcessor.getStackedData(categoryKey, stackByKey, valueKey);

        this.processedData = groupedData;
        this.maxTotal = maxTotal;
        this.uniqueSegments = uniqueSegments;

        // Clear container
        this.container.innerHTML = '';

        // Basic dimensions, dynamically calculated
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.margin = { top: 20, right: 20, bottom: 70, left: 60 };
        this.chartWidth = this.width - this.margin.left - this.margin.right;
        this.chartHeight = this.height - this.margin.top - this.margin.bottom;

        // Create SVG element
        this.svg = document.createElementNS(this.svgNS, "svg");
        this.svg.setAttribute('width', this.width);
        this.svg.setAttribute('height', this.height);
        this.container.appendChild(this.svg);

        this.chartArea = document.createElementNS(this.svgNS, 'g');
        this.chartArea.setAttribute('transform', `translate(${this.margin.left}, ${this.margin.top})`);
        this.svg.appendChild(this.chartArea);

        // Temp color map
        this.colorMap = {};
        const colors = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f'];
        this.uniqueSegments.forEach((segment, i) => {
            this.colorMap[segment] = colors[i % colors.length];
        });

        this._drawAxes();
        this._drawBars();
        this._drawLegend();
        this._createTooltip();
        this._setupInteractivity();
    }

    /**
     * Draws the X and Y axes with labels.
     * @private
     */
    _drawAxes() {
        // Y-Axis
        const yAxis = document.createElementNS(this.svgNS, 'line');
        yAxis.setAttribute('x1', 0);
        yAxis.setAttribute('y1', 0);
        yAxis.setAttribute('x2', 0);
        yAxis.setAttribute('y2', this.chartHeight);
        yAxis.setAttribute('class', 'axis');
        this.chartArea.appendChild(yAxis);

        // Y-Axis Labels
        const yTicks = 5;
        for (let i = 0; i <= yTicks; i++) {
            const value = (this.maxTotal / yTicks) * i;
            const yPos = this.chartHeight - (value / this.maxTotal) * this.chartHeight;

            const label = document.createElementNS(this.svgNS, 'text');
            label.setAttribute('x', -10);
            label.setAttribute('y', yPos);
            label.setAttribute('class', 'axis-label y-axis-label');
            label.textContent = value.toLocaleString();
            this.chartArea.appendChild(label);
        }

        // X-Axis
        const xAxis = document.createElementNS(this.svgNS, 'line');
        xAxis.setAttribute('x1', 0);
        xAxis.setAttribute('y1', this.chartHeight);
        xAxis.setAttribute('x2', this.chartWidth);
        xAxis.setAttribute('y2', this.chartHeight);
        xAxis.setAttribute('class', 'axis');
        this.chartArea.appendChild(xAxis);

        // X-Axis Labels
        const barWidth = this.chartWidth / this.processedData.length;
        this.processedData.forEach((d, i) => {
            const xPos = (i * barWidth) + (barWidth / 2);
            const label = document.createElementNS(this.svgNS, 'text');
            label.setAttribute('x', xPos);
            label.setAttribute('y', this.chartHeight + 20);
            label.setAttribute('class', 'axis-label x-axis-label');
            label.textContent = d.category;
            this.chartArea.appendChild(label);
        });
    }

    /**
     * Draws the stacked columns of the chart.
     * @private
     */
    _drawBars() {
        const barWidth = this.chartWidth / this.processedData.length * 0.8; // 80% of space
        const barMargin = this.chartWidth / this.processedData.length * 0.1; // 10% margin on each side

        this.processedData.forEach((d, i) => {
            let yOffset = this.chartHeight;
            const xPos = (i * (barWidth + 2 * barMargin)) + barMargin;

            // Sort segments for consistent stacking order
            const sortedSegments = Object.keys(d.segments).sort();

            for (const segment of sortedSegments) {
                const value = d.segments[segment];
                const barHeight = (value / this.maxTotal) * this.chartHeight;

                yOffset -= barHeight;

                const rect = document.createElementNS(this.svgNS, 'rect');
                rect.setAttribute('x', xPos);
                rect.setAttribute('y', yOffset);
                rect.setAttribute('width', barWidth);
                rect.setAttribute('height', barHeight);
                rect.setAttribute('fill', this.colorMap[segment]);
                // Store data on the element for tooltips
                rect.dataset.category = d.category;
                rect.dataset.segment = segment;
                rect.dataset.value = value;

                this.chartArea.appendChild(rect);
            }
        });
    }

    /**
     * Draws the chart legend.
     * @private
     */
    _drawLegend() {
        const legendArea = document.createElementNS(this.svgNS, 'g');
        legendArea.setAttribute('transform', `translate(0, ${this.chartHeight + 40})`);
        this.chartArea.appendChild(legendArea);

        let xOffset = 0;
        this.uniqueSegments.forEach(segment => {
            const legendItem = document.createElementNS(this.svgNS, 'g');
            legendItem.setAttribute('transform', `translate(${xOffset}, 0)`);

            const rect = document.createElementNS(this.svgNS, 'rect');
            rect.setAttribute('width', 15);
            rect.setAttribute('height', 15);
            rect.setAttribute('fill', this.colorMap[segment]);
            legendItem.appendChild(rect);

            const text = document.createElementNS(this.svgNS, 'text');
            text.setAttribute('x', 20);
            text.setAttribute('y', 12);
            text.setAttribute('class', 'legend-label');
            text.textContent = segment;
            legendItem.appendChild(text);

            legendArea.appendChild(legendItem);

            // Adjust xOffset for the next item
            xOffset += text.getBBox().width + 30;
        });
    }

    /**
     * Sets up event listeners for interactivity (e.g., tooltips on hover).
     * @private
     */
    _setupInteractivity() {
        this.chartArea.addEventListener('mouseover', (e) => {
            const target = e.target;
            if (target.tagName === 'rect' && target.dataset.value) {
                const data = target.dataset;
                const content = `
                    <strong>Category:</strong> ${data.category}<br>
                    <strong>Segment:</strong> ${data.segment}<br>
                    <strong>Sales:</strong> ${parseInt(data.value).toLocaleString()}
                `;
                this.tooltip.innerHTML = content;
                this.tooltip.style.display = 'block';
                target.style.opacity = 0.7;
            }
        });

        this.chartArea.addEventListener('mousemove', (e) => {
            // Position tooltip near cursor
            this.tooltip.style.left = `${e.clientX + 15}px`;
            this.tooltip.style.top = `${e.clientY - 15}px`;
        });

        this.chartArea.addEventListener('mouseout', (e) => {
            const target = e.target;
            if (target.tagName === 'rect') {
                this.tooltip.style.display = 'none';
                target.style.opacity = 1;
            }
        });
    }

    /**
     * Creates and manages the tooltip element.
     * @private
     */
    _createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'viz-tooltip';
        // Append to the main container to be positioned relative to the viewport
        document.body.appendChild(this.tooltip);
    }
}

/**
 * Renders and manages a pie chart.
 */
class PieChart {
    /**
     * @param {HTMLElement} container - The DOM element for the chart.
     * @param {Array<Object>} data - The raw JSON data.
     * @param {Object} options - Chart configuration.
     * @param {string} options.categoryKey - The key for pie chart categories.
     * @param {string} options.valueKey - The key for numerical values.
     */
    constructor(container, data, options) {
        this.container = container;
        this.data = data;
        this.options = options;
        this.dataProcessor = new DataProcessor(this.data);
        this.svgNS = "http://www.w3.org/2000/svg";
    }

    /**
     * Main method to render the chart.
     */
    render() {
        const { categoryKey, valueKey } = this.options;
        const { pieData, total, uniqueCategories } = this.dataProcessor.getPieData(categoryKey, valueKey);

        this.processedData = pieData;
        this.total = total;
        this.uniqueCategories = uniqueCategories;

        // Clear container
        this.container.innerHTML = '';

        // Dimensions
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.radius = Math.min(this.width, this.height) / 2 * 0.75;
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // Create SVG element
        this.svg = document.createElementNS(this.svgNS, "svg");
        this.svg.setAttribute('width', this.width);
        this.svg.setAttribute('height', this.height);
        this.container.appendChild(this.svg);

        // Chart area, centered
        this.chartArea = document.createElementNS(this.svgNS, 'g');
        this.chartArea.setAttribute('transform', `translate(${centerX}, ${centerY})`);
        this.svg.appendChild(this.chartArea);

        // Color map
        this.colorMap = {};
        const colors = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
        this.uniqueCategories.forEach((category, i) => {
            this.colorMap[category] = colors[i % colors.length];
        });

        this._drawSlices();
        this._drawLegend();
        this._createTooltip();
        this._setupInteractivity();
    }

    /**
     * Draws the individual pie slices.
     * @private
     */
    _drawSlices() {
        let startAngle = 0;
        this.processedData.forEach(d => {
            const percentage = d.value / this.total;
            const sweepAngle = percentage * 360;

            if(sweepAngle > 0) {
                const slice = this._createSlicePath(startAngle, sweepAngle, d.category, d.value);
                this.chartArea.appendChild(slice);
            }

            startAngle += sweepAngle;
        });
    }

    /**
     * Creates an SVG path element for a single pie slice.
     * @private
     */
    _createSlicePath(startAngle, sweepAngle, category, value) {
        const path = document.createElementNS(this.svgNS, 'path');
        const endAngle = startAngle + sweepAngle;

        const start = this._polarToCartesian(this.radius, startAngle);
        const end = this._polarToCartesian(this.radius, endAngle);

        const largeArcFlag = sweepAngle > 180 ? "1" : "0";

        const d = [
            "M", 0, 0,
            "L", start.x, start.y,
            "A", this.radius, this.radius, 0, largeArcFlag, 1, end.x, end.y,
            "Z"
        ].join(" ");

        path.setAttribute("d", d);
        path.setAttribute("fill", this.colorMap[category]);
        path.dataset.category = category;
        path.dataset.value = value;
        path.dataset.percentage = (value / this.total * 100).toFixed(2);

        return path;
    }

    /**
     * Converts polar coordinates (radius, angle) to Cartesian (x, y).
     * @private
     */
    _polarToCartesian(radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: radius * Math.cos(angleInRadians),
            y: radius * Math.sin(angleInRadians)
        };
    }

    /**
     * Draws the chart legend.
     * @private
     */
    _drawLegend() {
        const legendArea = document.createElementNS(this.svgNS, 'g');
        const legendX = 20;
        const legendY = 20;
        legendArea.setAttribute('transform', `translate(${legendX}, ${legendY})`);
        this.svg.appendChild(legendArea);

        let yOffset = 0;
        this.uniqueCategories.forEach(category => {
            const legendItem = document.createElementNS(this.svgNS, 'g');
            legendItem.setAttribute('transform', `translate(0, ${yOffset})`);

            const rect = document.createElementNS(this.svgNS, 'rect');
            rect.setAttribute('width', 15);
            rect.setAttribute('height', 15);
            rect.setAttribute('fill', this.colorMap[category]);
            legendItem.appendChild(rect);

            const text = document.createElementNS(this.svgNS, 'text');
            text.setAttribute('x', 20);
            text.setAttribute('y', 12);
            text.setAttribute('class', 'legend-label');
            text.textContent = category;
            legendItem.appendChild(text);

            legendArea.appendChild(legendItem);
            yOffset += 25;
        });
    }

    /**
     * Creates and manages the tooltip element.
     * @private
     */
    _createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'viz-tooltip';
        document.body.appendChild(this.tooltip);
    }

    /**
     * Sets up event listeners for interactivity.
     * @private
     */
    _setupInteractivity() {
        this.chartArea.addEventListener('mouseover', (e) => {
            const target = e.target;
            if (target.tagName === 'path' && target.dataset.value) {
                const data = target.dataset;
                const content = `
                    <strong>${data.category}</strong><br>
                    Value: ${parseInt(data.value).toLocaleString()}<br>
                    (${data.percentage}%)
                `;
                this.tooltip.innerHTML = content;
                this.tooltip.style.display = 'block';
                target.style.opacity = 0.7;
            }
        });

        this.chartArea.addEventListener('mousemove', (e) => {
            this.tooltip.style.left = `${e.clientX + 15}px`;
            this.tooltip.style.top = `${e.clientY + 15}px`;
        });

        this.chartArea.addEventListener('mouseout', (e) => {
            const target = e.target;
            if (target.tagName === 'path') {
                this.tooltip.style.display = 'none';
                target.style.opacity = 1;
            }
        });
    }
}

/**
 * Renders and manages a line chart.
 */
class LineChart {
    /**
     * @param {HTMLElement} container - The DOM element for the chart.
     * @param {Array<Object>} data - The raw JSON data.
     * @param {Object} options - Chart configuration.
     * @param {string} options.xKey - The key for the x-axis.
     * @param {string} options.yKey - The key for the y-axis.
     */
    constructor(container, data, options) {
        this.container = container;
        this.data = data;
        this.options = options;
        this.dataProcessor = new DataProcessor(this.data);
        this.svgNS = "http://www.w3.org/2000/svg";
    }

    /**
     * Main method to render the chart.
     */
    render() {
        const { xKey, yKey } = this.options;
        const { lineData, yMin, yMax } = this.dataProcessor.getLineData(xKey, yKey);

        this.processedData = lineData;
        this.yMin = yMin;
        this.yMax = yMax;

        // Clear container
        this.container.innerHTML = '';

        // Dimensions
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.margin = { top: 20, right: 30, bottom: 40, left: 60 };
        this.chartWidth = this.width - this.margin.left - this.margin.right;
        this.chartHeight = this.height - this.margin.top - this.margin.bottom;

        // Create SVG element
        this.svg = document.createElementNS(this.svgNS, "svg");
        this.svg.setAttribute('width', this.width);
        this.svg.setAttribute('height', this.height);
        this.container.appendChild(this.svg);

        this.chartArea = document.createElementNS(this.svgNS, 'g');
        this.chartArea.setAttribute('transform', `translate(${this.margin.left}, ${this.margin.top})`);
        this.svg.appendChild(this.chartArea);

        this._drawAxes();
        this._drawLine();
        this._drawPoints();
        this._createTooltip();
        this._setupInteractivity();
    }

    /**
     * Draws the X and Y axes.
     * @private
     */
    _drawAxes() {
        const yRange = this.yMax - this.yMin;

        // Y-Axis
        const yAxis = document.createElementNS(this.svgNS, 'line');
        yAxis.setAttribute('x1', 0);
        yAxis.setAttribute('y1', 0);
        yAxis.setAttribute('x2', 0);
        yAxis.setAttribute('y2', this.chartHeight);
        yAxis.setAttribute('class', 'axis');
        this.chartArea.appendChild(yAxis);

        // Y-Axis Labels
        const yTicks = 5;
        for (let i = 0; i <= yTicks; i++) {
            const value = this.yMin + (yRange / yTicks) * i;
            const yPos = this.chartHeight - ((value - this.yMin) / yRange) * this.chartHeight;

            const label = document.createElementNS(this.svgNS, 'text');
            label.setAttribute('x', -10);
            label.setAttribute('y', yPos);
            label.setAttribute('class', 'axis-label y-axis-label');
            label.textContent = value.toLocaleString();
            this.chartArea.appendChild(label);
        }

        // X-Axis
        const xAxis = document.createElementNS(this.svgNS, 'line');
        xAxis.setAttribute('x1', 0);
        xAxis.setAttribute('y1', this.chartHeight);
        xAxis.setAttribute('x2', this.chartWidth);
        xAxis.setAttribute('y2', this.chartHeight);
        xAxis.setAttribute('class', 'axis');
        this.chartArea.appendChild(xAxis);

        // X-Axis Labels
        const xStep = this.chartWidth / (this.processedData.length - 1);
        this.processedData.forEach((d, i) => {
            const xPos = i * xStep;
            const label = document.createElementNS(this.svgNS, 'text');
            label.setAttribute('x', xPos);
            label.setAttribute('y', this.chartHeight + 20);
            label.setAttribute('class', 'axis-label x-axis-label');
            label.textContent = d[this.options.xKey];
            this.chartArea.appendChild(label);
        });
    }

    /**
     * Draws the line path.
     * @private
     */
    _drawLine() {
        const path = document.createElementNS(this.svgNS, 'path');
        const xStep = this.chartWidth / (this.processedData.length - 1);
        const yRange = this.yMax - this.yMin;

        const pathData = this.processedData.map((d, i) => {
            const x = i * xStep;
            const y = this.chartHeight - ((d[this.options.yKey] - this.yMin) / yRange) * this.chartHeight;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(" ");

        path.setAttribute('d', pathData);
        path.setAttribute('class', 'line-path');
        this.chartArea.appendChild(path);
    }

    /**
     * Draws the points on the line.
     * @private
     */
    _drawPoints() {
        const xStep = this.chartWidth / (this.processedData.length - 1);
        const yRange = this.yMax - this.yMin;

        this.processedData.forEach((d, i) => {
            const x = i * xStep;
            const y = this.chartHeight - ((d[this.options.yKey] - this.yMin) / yRange) * this.chartHeight;

            const circle = document.createElementNS(this.svgNS, 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', 5);
            circle.setAttribute('class', 'line-point');

            circle.dataset.xValue = d[this.options.xKey];
            circle.dataset.yValue = d[this.options.yKey];

            this.chartArea.appendChild(circle);
        });
    }

    /**
     * Creates the tooltip element.
     * @private
     */
    _createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'viz-tooltip';
        document.body.appendChild(this.tooltip);
    }

    /**
     * Sets up interactivity for points.
     * @private
     */
    _setupInteractivity() {
        this.chartArea.addEventListener('mouseover', (e) => {
            if (e.target.tagName === 'circle') {
                e.target.style.r = '7';
                const data = e.target.dataset;
                const content = `
                    <strong>${this.options.xKey}:</strong> ${data.xValue}<br>
                    <strong>${this.options.yKey}:</strong> ${parseInt(data.yValue).toLocaleString()}
                `;
                this.tooltip.innerHTML = content;
                this.tooltip.style.display = 'block';
            }
        });

        this.chartArea.addEventListener('mousemove', (e) => {
            this.tooltip.style.left = `${e.clientX + 15}px`;
            this.tooltip.style.top = `${e.clientY + 15}px`;
        });

        this.chartArea.addEventListener('mouseout', (e) => {
            if (e.target.tagName === 'circle') {
                e.target.style.r = '5';
                this.tooltip.style.display = 'none';
            }
        });
    }
}

/**
 * Renders and manages a funnel chart.
 */
class FunnelChart {
    /**
     * @param {HTMLElement} container - The DOM element for the chart.
     * @param {Array<Object>} data - The raw JSON data.
     * @param {Object} options - Chart configuration.
     * @param {string} options.categoryKey - The key for funnel stages.
     * @param {string} options.valueKey - The key for numerical values.
     */
    constructor(container, data, options) {
        this.container = container;
        this.data = data;
        this.options = options;
        this.dataProcessor = new DataProcessor(this.data);
        this.svgNS = "http://www.w3.org/2000/svg";
    }

    /**
     * Main method to render the chart.
     */
    render() {
        const { categoryKey, valueKey } = this.options;
        const { funnelData, maxValue } = this.dataProcessor.getFunnelData(categoryKey, valueKey);

        this.processedData = funnelData;
        this.maxValue = maxValue;

        // Clear container
        this.container.innerHTML = '';

        // Dimensions
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.margin = { top: 20, right: 20, bottom: 20, left: 20 };
        this.chartWidth = this.width - this.margin.left - this.margin.right;
        this.chartHeight = this.height - this.margin.top - this.margin.bottom;

        // Create SVG element
        this.svg = document.createElementNS(this.svgNS, "svg");
        this.svg.setAttribute('width', this.width);
        this.svg.setAttribute('height', this.height);
        this.container.appendChild(this.svg);

        this.chartArea = document.createElementNS(this.svgNS, 'g');
        this.chartArea.setAttribute('transform', `translate(${this.margin.left}, ${this.margin.top})`);
        this.svg.appendChild(this.chartArea);

        // Color map
        this.colorMap = {};
        const colors = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949'];
        this.processedData.forEach((d, i) => {
            this.colorMap[d.category] = colors[i % colors.length];
        });

        this._drawStages();
        this._createTooltip();
        this._setupInteractivity();
    }

    /**
     * Draws the trapezoidal stages of the funnel.
     * @private
     */
    _drawStages() {
        const stageCount = this.processedData.length;
        if (stageCount === 0) return;

        const stageHeight = this.chartHeight / stageCount;
        const centerX = this.chartWidth / 2;

        this.processedData.forEach((d, i) => {
            const topValue = d.value;
            const bottomValue = (i + 1 < stageCount) ? this.processedData[i + 1].value : 0;

            const topWidth = (topValue / this.maxValue) * this.chartWidth;
            const bottomWidth = (bottomValue / this.maxValue) * this.chartWidth;

            const y1 = i * stageHeight;
            const y2 = (i + 1) * stageHeight;

            const points = [
                `${centerX - topWidth / 2},${y1}`,
                `${centerX + topWidth / 2},${y1}`,
                `${centerX + bottomWidth / 2},${y2}`,
                `${centerX - bottomWidth / 2},${y2}`
            ].join(" ");

            const polygon = document.createElementNS(this.svgNS, 'polygon');
            polygon.setAttribute('points', points);
            polygon.setAttribute('fill', this.colorMap[d.category]);
            polygon.dataset.category = d.category;
            polygon.dataset.value = d.value;
            polygon.dataset.conversion = d.conversion;

            this.chartArea.appendChild(polygon);

            // Add labels
            const label = document.createElementNS(this.svgNS, 'text');
            label.setAttribute('x', centerX);
            label.setAttribute('y', y1 + stageHeight / 2);
            label.setAttribute('class', 'funnel-label');
            label.textContent = `${d.category}: ${d.value.toLocaleString()}`;
            this.chartArea.appendChild(label);
        });
    }

    /**
     * Creates and manages the tooltip element.
     * @private
     */
    _createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'viz-tooltip';
        document.body.appendChild(this.tooltip);
    }

    /**
     * Sets up event listeners for interactivity.
     * @private
     */
    _setupInteractivity() {
        this.chartArea.addEventListener('mouseover', (e) => {
            const target = e.target;
            if (target.tagName === 'polygon' && target.dataset.value) {
                const data = target.dataset;
                const content = `
                    <strong>${data.category}</strong><br>
                    Value: ${parseInt(data.value).toLocaleString()}<br>
                    Conversion: ${data.conversion}%
                `;
                this.tooltip.innerHTML = content;
                this.tooltip.style.display = 'block';
                target.style.opacity = 0.7;
            }
        });

        this.chartArea.addEventListener('mousemove', (e) => {
            this.tooltip.style.left = `${e.clientX + 15}px`;
            this.tooltip.style.top = `${e.clientY + 15}px`;
        });

        this.chartArea.addEventListener('mouseout', (e) => {
            const target = e.target;
            if (target.tagName === 'polygon') {
                this.tooltip.style.display = 'none';
                target.style.opacity = 1;
            }
        });
    }
}