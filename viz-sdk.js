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
            case 'StackedColumn':
                const chart = new StackedColumnChart(container, data, options);
                chart.render();
                return chart;
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