import {DoorVisualization} from './visualization.js';

// Create and start visualization
const visualization = new DoorVisualization();
visualization.start();

// Expose for debugging
window.visualization = visualization;
export { visualization };
console.log('Visualization started');

console.log(visualization)