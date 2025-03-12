import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// -------------------- New Math Functions --------------------

// Standard Normal PDF
function stdNormalPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Black-Scholes Gamma calculation
function computeGamma(S, K, r, sigma, T) {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return stdNormalPDF(d1) / (S * sigma * Math.sqrt(T));
}

// -------------------- End New Math Functions --------------------

// State variables
const state = {
  currentSymbol: "AAPL",
  expiryRange: 90, // days
  apiKey: "L6GIbyiZ5w3ndPhkJaJpMNnHSMgh5ckc",
  showGamma: true,
  showLabels: true,
  surfaceType: "surface", // wireframe, points, or surface
  colorScheme: "rainbow", // rainbow, heatmap, monochrome
  gammaDisplayMode: "plane", // plane, points, lines
  showOptionsChain: true, // Show options chain table
  normalizeStrikes: false, // New toggle: normalize strike prices around ATM (100%)
  riskFreeRate: 0.035, // Risk-free rate for Black-Scholes
  contractMultiplier: 100, // For gamma exposure scaling
  desiredVolHeight: 100, // Desired max height for normalized IV in the surface
  atmPrice: 0 // Will be set when synthetic data is generated
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); // Dark background like Bloomberg

// Camera setup
const camera = new THREE.PerspectiveCamera(
  60, // Field of view
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);
camera.position.set(300, 150, 400);

// Renderer
const renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  alpha: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.5;
controls.maxPolarAngle = Math.PI / 2; // Prevent camera from going below the grid
controls.minDistance = 100;
controls.maxDistance = 1000;
controls.update();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

// Add subtle spotlight to enhance the 3D appearance
const spotLight = new THREE.SpotLight(0xffffff, 0.5);
spotLight.position.set(0, 500, 200);
spotLight.castShadow = true;
spotLight.angle = Math.PI / 4;
scene.add(spotLight);

// Storage for meshes
let volatilityMesh = null;
let gammaOverlayMesh = null;
let surfaceMesh = null;
let axisLines = new THREE.Group();
let labelGroup = new THREE.Group();
let gridGroup = new THREE.Group();
scene.add(axisLines);
scene.add(labelGroup);
scene.add(gridGroup);

// Helper function to transform strike values if normalization is enabled.
// When enabled, strike values are expressed relative to the ATM price (scaled to 100).
function transformStrike(strike) {
  if (state.normalizeStrikes && state.atmPrice) {
    return (strike / state.atmPrice) * 100;
  }
  return strike;
}

// Create initial grid with Bloomberg-like look
function createGrid() {
  // Clear previous grid
  scene.remove(gridGroup);
  gridGroup = new THREE.Group();
  
  // Create a flat ground grid (matches Bloomberg)
  const gridSize = 1000;
  const gridDivisions = 20;
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x222222);
  gridHelper.position.y = 0;
  gridGroup.add(gridHelper);
  
  scene.add(gridGroup);
}

// Create Bloomberg-style UI dashboard
function createDashboard() {
  // Remove existing dashboard if any
  const existingDashboard = document.getElementById('vol-dashboard');
  if (existingDashboard) {
    existingDashboard.remove();
  }
  
  // Create new dashboard
  const dashboard = document.createElement('div');
  dashboard.id = 'vol-dashboard';
  dashboard.style.position = 'absolute';
  dashboard.style.top = '0';
  dashboard.style.left = '0';
  dashboard.style.right = '0';
  dashboard.style.padding = '5px 10px';
  dashboard.style.backgroundColor = '#FFA500'; // Bloomberg-like orange header
  dashboard.style.color = 'black';
  dashboard.style.fontFamily = 'Arial, sans-serif';
  dashboard.style.fontSize = '14px';
  dashboard.style.fontWeight = 'bold';
  dashboard.style.zIndex = '1000';
  dashboard.style.display = 'flex';
  dashboard.style.justifyContent = 'space-between';
  dashboard.style.alignItems = 'center';
  dashboard.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
  
  // Header section (left side)
  const headerSection = document.createElement('div');
  headerSection.style.display = 'flex';
  headerSection.style.alignItems = 'center';
  
  const title = document.createElement('div');
  title.textContent = 'Volatility Surface';
  title.style.marginRight = '20px';
  headerSection.appendChild(title);
  
  dashboard.appendChild(headerSection);
  
  // Main controls section
  const controlsContainer = document.createElement('div');
  controlsContainer.style.position = 'absolute';
  controlsContainer.style.top = '40px';
  controlsContainer.style.left = '10px';
  controlsContainer.style.width = '250px';
  controlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  controlsContainer.style.color = 'white';
  controlsContainer.style.padding = '10px';
  controlsContainer.style.borderRadius = '5px';
  controlsContainer.style.zIndex = '999';
  
  // Add ticker input
  const tickerDiv = document.createElement('div');
  tickerDiv.style.marginBottom = '10px';
  
  const tickerLabel = document.createElement('label');
  tickerLabel.textContent = 'Ticker:';
  tickerLabel.style.display = 'inline-block';
  tickerLabel.style.width = '120px';
  tickerDiv.appendChild(tickerLabel);
  
  const tickerInput = document.createElement('input');
  tickerInput.type = 'text';
  tickerInput.value = state.currentSymbol;
  tickerInput.style.width = '100px';
  tickerInput.style.backgroundColor = '#333';
  tickerInput.style.color = 'white';
  tickerInput.style.border = '1px solid #666';
  tickerInput.style.padding = '3px 5px';
  tickerDiv.appendChild(tickerInput);
  
  controlsContainer.appendChild(tickerDiv);
  
  // Add expiry range selector
  const expiryDiv = document.createElement('div');
  expiryDiv.style.marginBottom = '10px';
  
  const expiryLabel = document.createElement('label');
  expiryLabel.textContent = 'Max Expiry (days):';
  expiryLabel.style.display = 'inline-block';
  expiryLabel.style.width = '120px';
  expiryDiv.appendChild(expiryLabel);
  
  const expiryInput = document.createElement('input');
  expiryInput.type = 'number';
  expiryInput.min = '1';
  expiryInput.max = '365';
  expiryInput.value = state.expiryRange;
  expiryInput.style.width = '100px';
  expiryInput.style.backgroundColor = '#333';
  expiryInput.style.color = 'white';
  expiryInput.style.border = '1px solid #666';
  expiryInput.style.padding = '3px 5px';
  expiryDiv.appendChild(expiryInput);
  
  controlsContainer.appendChild(expiryDiv);
  
  // Toggle switches
  const togglesDiv = document.createElement('div');
  togglesDiv.style.marginBottom = '10px';
  
  // Show Gamma toggle
  const gammaDiv = document.createElement('div');
  gammaDiv.style.marginBottom = '5px';
  
  const gammaCheckbox = document.createElement('input');
  gammaCheckbox.type = 'checkbox';
  gammaCheckbox.id = 'gammaToggle';
  gammaCheckbox.checked = state.showGamma;
  gammaCheckbox.style.marginRight = '5px';
  gammaDiv.appendChild(gammaCheckbox);
  
  const gammaLabel = document.createElement('label');
  gammaLabel.textContent = 'Show Gamma';
  gammaLabel.htmlFor = 'gammaToggle';
  gammaDiv.appendChild(gammaLabel);
  
  togglesDiv.appendChild(gammaDiv);
  
  // Gamma display type
  const gammaTypeDiv = document.createElement('div');
  gammaTypeDiv.style.marginBottom = '5px';
  gammaTypeDiv.style.marginLeft = '20px';
  
  const gammaTypeLabel = document.createElement('label');
  gammaTypeLabel.textContent = 'Gamma Display:';
  gammaTypeLabel.style.display = 'inline-block';
  gammaTypeLabel.style.width = '100px';
  gammaTypeDiv.appendChild(gammaTypeLabel);
  
  const gammaTypeSelect = document.createElement('select');
  gammaTypeSelect.style.width = '100px';
  gammaTypeSelect.style.backgroundColor = '#333';
  gammaTypeSelect.style.color = 'white';
  gammaTypeSelect.style.border = '1px solid #666';
  gammaTypeSelect.style.padding = '3px 5px';
  
  ['plane', 'points', 'lines'].forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
    if (opt === state.gammaDisplayMode) option.selected = true;
    gammaTypeSelect.appendChild(option);
  });
  
  gammaTypeDiv.appendChild(gammaTypeSelect);
  togglesDiv.appendChild(gammaTypeDiv);
  
  // Show Labels toggle
  const labelsDiv = document.createElement('div');
  labelsDiv.style.marginBottom = '5px';
  
  const labelsCheckbox = document.createElement('input');
  labelsCheckbox.type = 'checkbox';
  labelsCheckbox.id = 'labelsToggle';
  labelsCheckbox.checked = state.showLabels;
  labelsCheckbox.style.marginRight = '5px';
  labelsDiv.appendChild(labelsCheckbox);
  
  const labelsLabel = document.createElement('label');
  labelsLabel.textContent = 'Show Labels';
  labelsLabel.htmlFor = 'labelsToggle';
  labelsDiv.appendChild(labelsLabel);
  
  togglesDiv.appendChild(labelsDiv);

  // Show Options Chain toggle
  const chainDiv = document.createElement('div');
  chainDiv.style.marginBottom = '5px';
  
  const chainCheckbox = document.createElement('input');
  chainCheckbox.type = 'checkbox';
  chainCheckbox.id = 'chainToggle';
  chainCheckbox.checked = state.showOptionsChain;
  chainCheckbox.style.marginRight = '5px';
  chainDiv.appendChild(chainCheckbox);
  
  const chainLabel = document.createElement('label');
  chainLabel.textContent = 'Show Options Chain';
  chainLabel.htmlFor = 'chainToggle';
  chainDiv.appendChild(chainLabel);
  
  togglesDiv.appendChild(chainDiv);

  // NEW: Normalize Strikes toggle
  const normDiv = document.createElement('div');
  normDiv.style.marginBottom = '5px';
  
  const normCheckbox = document.createElement('input');
  normCheckbox.type = 'checkbox';
  normCheckbox.id = 'normalizeStrikesToggle';
  normCheckbox.checked = state.normalizeStrikes;
  normCheckbox.style.marginRight = '5px';
  normDiv.appendChild(normCheckbox);
  
  const normLabel = document.createElement('label');
  normLabel.textContent = 'Normalize Strikes';
  normLabel.htmlFor = 'normalizeStrikesToggle';
  normDiv.appendChild(normLabel);
  
  togglesDiv.appendChild(normDiv);
  
  controlsContainer.appendChild(togglesDiv);
  
  // Display settings
  const displayDiv = document.createElement('div');
  displayDiv.style.marginBottom = '10px';
  
  // Surface type selector
  const surfaceTypeDiv = document.createElement('div');
  surfaceTypeDiv.style.marginBottom = '5px';
  
  const surfaceTypeLabel = document.createElement('label');
  surfaceTypeLabel.textContent = 'Display Type:';
  surfaceTypeLabel.style.display = 'inline-block';
  surfaceTypeLabel.style.width = '120px';
  surfaceTypeDiv.appendChild(surfaceTypeLabel);
  
  const surfaceTypeSelect = document.createElement('select');
  surfaceTypeSelect.style.width = '100px';
  surfaceTypeSelect.style.backgroundColor = '#333';
  surfaceTypeSelect.style.color = 'white';
  surfaceTypeSelect.style.border = '1px solid #666';
  surfaceTypeSelect.style.padding = '3px 5px';
  
  ['surface', 'wireframe', 'points'].forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
    if (opt === state.surfaceType) option.selected = true;
    surfaceTypeSelect.appendChild(option);
  });
  
  surfaceTypeDiv.appendChild(surfaceTypeSelect);
  displayDiv.appendChild(surfaceTypeDiv);
  
  // Color scheme selector
  const colorDiv = document.createElement('div');
  colorDiv.style.marginBottom = '5px';
  
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Color Scheme:';
  colorLabel.style.display = 'inline-block';
  colorLabel.style.width = '120px';
  colorDiv.appendChild(colorLabel);
  
  const colorSelect = document.createElement('select');
  colorSelect.style.width = '100px';
  colorSelect.style.backgroundColor = '#333';
  colorSelect.style.color = 'white';
  colorSelect.style.border = '1px solid #666';
  colorSelect.style.padding = '3px 5px';
  
  ['rainbow', 'heatmap', 'monochrome'].forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
    if (opt === state.colorScheme) option.selected = true;
    colorSelect.appendChild(option);
  });
  
  colorDiv.appendChild(colorSelect);
  displayDiv.appendChild(colorDiv);
  
  controlsContainer.appendChild(displayDiv);
  
  // Buttons
  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.display = 'flex';
  buttonsDiv.style.justifyContent = 'space-between';
  buttonsDiv.style.marginTop = '15px';
  
  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh Data';
  refreshButton.style.backgroundColor = '#0078D4'; // Blue button 
  refreshButton.style.color = 'white';
  refreshButton.style.border = 'none';
  refreshButton.style.padding = '6px 12px';
  refreshButton.style.cursor = 'pointer';
  refreshButton.style.borderRadius = '3px';
  buttonsDiv.appendChild(refreshButton);
  
  const rotateButton = document.createElement('button');
  rotateButton.textContent = 'Toggle Rotation';
  rotateButton.style.backgroundColor = '#0078D4'; // Blue button
  rotateButton.style.color = 'white';
  rotateButton.style.border = 'none';
  rotateButton.style.padding = '6px 12px';
  rotateButton.style.cursor = 'pointer';
  rotateButton.style.borderRadius = '3px';
  buttonsDiv.appendChild(rotateButton);
  
  controlsContainer.appendChild(buttonsDiv);
  
  // Status display
  const statusDiv = document.createElement('div');
  statusDiv.id = 'status';
  statusDiv.style.marginTop = '10px';
  statusDiv.style.fontSize = '12px';
  statusDiv.style.color = '#aaa';
  controlsContainer.appendChild(statusDiv);
  
  // Add controls to document
  document.body.appendChild(dashboard);
  document.body.appendChild(controlsContainer);
  
  // Add legend for color scale
  createColorLegend();
  
  // Add axis labels (like Bloomberg)
  createAxisLabels();
  
  // Event listeners
  refreshButton.addEventListener('click', () => {
    state.currentSymbol = tickerInput.value.toUpperCase();
    state.expiryRange = parseInt(expiryInput.value) || 90;
    state.showGamma = gammaCheckbox.checked;
    state.showLabels = labelsCheckbox.checked;
    state.showOptionsChain = chainCheckbox.checked;
    state.normalizeStrikes = normCheckbox.checked;
    state.surfaceType = surfaceTypeSelect.value;
    state.colorScheme = colorSelect.value;
    state.gammaDisplayMode = gammaTypeSelect.value;
    
    updateStatus(`Fetching data for ${state.currentSymbol}...`);
    fetchAndDisplayData();
    
    // Update UI elements
    updateLabelVisibility();
    createColorLegend(); // Update legend with new color scheme
    
    // Update options chain visibility
    const optionsChainTable = document.getElementById('options-chain');
    if (optionsChainTable) {
      optionsChainTable.style.display = state.showOptionsChain ? 'block' : 'none';
    }
  });
  
  rotateButton.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    rotateButton.textContent = controls.autoRotate ? 'Stop Rotation' : 'Toggle Rotation';
  });
  
  gammaCheckbox.addEventListener('change', () => {
    state.showGamma = gammaCheckbox.checked;
    if (gammaOverlayMesh) {
      gammaOverlayMesh.visible = state.showGamma;
    }
    // Show/hide gamma display type selector
    gammaTypeDiv.style.display = state.showGamma ? 'block' : 'none';
  });
  
  gammaTypeSelect.addEventListener('change', () => {
    state.gammaDisplayMode = gammaTypeSelect.value;
    if (state.showGamma) {
      // Refresh the visualization with new gamma display mode
      fetchAndDisplayData();
    }
  });
  
  labelsCheckbox.addEventListener('change', () => {
    state.showLabels = labelsCheckbox.checked;
    updateLabelVisibility();
  });

  chainCheckbox.addEventListener('change', () => {
    state.showOptionsChain = chainCheckbox.checked;
    const optionsChainTable = document.getElementById('options-chain');
    if (optionsChainTable) {
      optionsChainTable.style.display = state.showOptionsChain ? 'block' : 'none';
    }
  });
  
  surfaceTypeSelect.addEventListener('change', () => {
    state.surfaceType = surfaceTypeSelect.value;
    updateVisualizationType();
  });
  
  colorSelect.addEventListener('change', () => {
    state.colorScheme = colorSelect.value;
    fetchAndDisplayData(); // Refresh with new color scheme
    createColorLegend(); // Update the legend
  });
  
  // Show/hide gamma display type based on gamma checkbox
  gammaTypeDiv.style.display = state.showGamma ? 'block' : 'none';
}

// Update label visibility based on checkbox
function updateLabelVisibility() {
  labelGroup.visible = state.showLabels;
  
  // Also update axis labels
  const axisLabelsDiv = document.getElementById('axis-labels');
  if (axisLabelsDiv) {
    axisLabelsDiv.style.display = state.showLabels ? 'block' : 'none';
  }
  
  // Update color legend visibility
  const legendDiv = document.getElementById('color-legend');
  if (legendDiv) {
    legendDiv.style.display = state.showLabels ? 'block' : 'none';
  }
}

// Create Bloomberg-style axis labels
function createAxisLabels() {
  // Remove any existing axis labels
  const existingLabels = document.getElementById('axis-labels');
  if (existingLabels) {
    existingLabels.remove();
  }
  
  const axisLabelsDiv = document.createElement('div');
  axisLabelsDiv.id = 'axis-labels';
  axisLabelsDiv.style.position = 'absolute';
  axisLabelsDiv.style.bottom = '10px';
  axisLabelsDiv.style.left = '10px';
  axisLabelsDiv.style.color = 'white';
  axisLabelsDiv.style.fontSize = '14px';
  axisLabelsDiv.style.fontFamily = 'Arial, sans-serif';
  axisLabelsDiv.style.fontWeight = 'bold';
  axisLabelsDiv.style.pointerEvents = 'none'; // Don't interfere with controls
  
  // X-Axis Label (Strike)
  const xAxisLabel = document.createElement('div');
  xAxisLabel.textContent = state.normalizeStrikes ? 'Normalized Strike (%)' : 'Strike';
  xAxisLabel.style.position = 'absolute';
  xAxisLabel.style.bottom = '10px';
  xAxisLabel.style.left = '50%';
  xAxisLabel.style.transform = 'translateX(-50%)';
  xAxisLabel.style.backgroundColor = 'rgba(0,0,0,0.7)';
  xAxisLabel.style.padding = '5px 10px';
  xAxisLabel.style.borderRadius = '3px';
  axisLabelsDiv.appendChild(xAxisLabel);
  
  // Y-Axis Label (IV)
  const yAxisLabel = document.createElement('div');
  yAxisLabel.textContent = 'Implied Volatility (%)';
  yAxisLabel.style.position = 'absolute';
  yAxisLabel.style.left = '20px';
  yAxisLabel.style.bottom = '50%';
  yAxisLabel.style.transform = 'rotate(-90deg) translateX(50%)';
  yAxisLabel.style.transformOrigin = 'left bottom';
  yAxisLabel.style.backgroundColor = 'rgba(0,0,0,0.7)';
  yAxisLabel.style.padding = '5px 10px';
  yAxisLabel.style.borderRadius = '3px';
  axisLabelsDiv.appendChild(yAxisLabel);
  
  // Z-Axis Label (Days to Expiry)
  const zAxisLabel = document.createElement('div');
  zAxisLabel.textContent = 'Days to Expiry';
  zAxisLabel.style.position = 'absolute';
  zAxisLabel.style.right = '20px';
  zAxisLabel.style.bottom = '10px';
  zAxisLabel.style.backgroundColor = 'rgba(0,0,0,0.7)';
  zAxisLabel.style.padding = '5px 10px';
  zAxisLabel.style.borderRadius = '3px';
  axisLabelsDiv.appendChild(zAxisLabel);
  
  // Add vertical IV labels at fixed intervals (Bloomberg style)
  const ivValues = [10, 20, 30, 40, 50, 60, 70, 80];
  ivValues.forEach(iv => {
    const ivLabel = document.createElement('div');
    ivLabel.textContent = `${iv}%`;
    ivLabel.style.position = 'absolute';
    ivLabel.style.left = '10px';
    // Position based on percentage of window height
    ivLabel.style.bottom = `${(iv / 80) * 40 + 10}%`;
    ivLabel.style.backgroundColor = 'rgba(0,0,0,0.7)';
    ivLabel.style.padding = '2px 5px';
    ivLabel.style.borderRadius = '3px';
    ivLabel.style.fontSize = '12px';
    axisLabelsDiv.appendChild(ivLabel);
    
    // Add horizontal guide line
    const guideLine = document.createElement('div');
    guideLine.style.position = 'absolute';
    guideLine.style.left = '45px';
    guideLine.style.right = '20px';
    guideLine.style.bottom = `${(iv / 80) * 40 + 11}%`;
    guideLine.style.borderBottom = '1px dashed rgba(255,255,255,0.2)';
    axisLabelsDiv.appendChild(guideLine);
  });
  
  document.body.appendChild(axisLabelsDiv);
  
  // Set initial visibility based on checkbox
  axisLabelsDiv.style.display = state.showLabels ? 'block' : 'none';
}

// Create color legend (like Bloomberg)
function createColorLegend() {
  // Remove existing legend if any
  const existingLegend = document.getElementById('color-legend');
  if (existingLegend) {
    existingLegend.remove();
  }
  
  const legendDiv = document.createElement('div');
  legendDiv.id = 'color-legend';
  legendDiv.style.position = 'absolute';
  legendDiv.style.top = '100px';
  legendDiv.style.right = '20px';
  legendDiv.style.width = '40px';
  legendDiv.style.height = '200px';
  legendDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  legendDiv.style.borderRadius = '5px';
  legendDiv.style.padding = '10px 5px';
  legendDiv.style.display = state.showLabels ? 'block' : 'none';
  
  // Create gradient based on color scheme
  const gradientDiv = document.createElement('div');
  gradientDiv.style.width = '20px';
  gradientDiv.style.height = '180px';
  gradientDiv.style.margin = '0 auto';
  
  let gradientColors;
  
  switch (state.colorScheme) {
    case 'rainbow':
      gradientColors = 'linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff)';
      break;
    case 'heatmap':
      gradientColors = 'linear-gradient(to bottom, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff)';
      break;
    case 'monochrome':
      gradientColors = 'linear-gradient(to bottom, #ffffff, #cccccc, #999999, #666666, #000000)';
      break;
    default:
      gradientColors = 'linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff)';
  }
  
  gradientDiv.style.background = gradientColors;
  legendDiv.appendChild(gradientDiv);
  
  // Add labels
  const highLabel = document.createElement('div');
  highLabel.textContent = 'High IV';
  highLabel.style.color = 'white';
  highLabel.style.fontSize = '10px';
  highLabel.style.textAlign = 'center';
  highLabel.style.marginBottom = '5px';
  legendDiv.insertBefore(highLabel, gradientDiv);
  
  const lowLabel = document.createElement('div');
  lowLabel.textContent = 'Low IV';
  lowLabel.style.color = 'white';
  lowLabel.style.fontSize = '10px';
  lowLabel.style.textAlign = 'center';
  lowLabel.style.marginTop = '5px';
  legendDiv.appendChild(lowLabel);
  
  document.body.appendChild(legendDiv);
}

// Update visualization type based on user selection
function updateVisualizationType() {
  if (!volatilityMesh || !surfaceMesh) return;
  
  switch (state.surfaceType) {
    case 'wireframe':
      volatilityMesh.visible = false;
      if (surfaceMesh.material) {
        surfaceMesh.material.wireframe = true;
        surfaceMesh.material.transparent = true;
        surfaceMesh.material.opacity = 0.8;
      }
      surfaceMesh.visible = true;
      break;
    case 'points':
      volatilityMesh.visible = true;
      surfaceMesh.visible = false;
      break;
    case 'surface':
      volatilityMesh.visible = false;
      if (surfaceMesh.material) {
        surfaceMesh.material.wireframe = false;
        surfaceMesh.material.transparent = true;
        surfaceMesh.material.opacity = 0.9;
      }
      surfaceMesh.visible = true;
      break;
  }
}

// Update status display
function updateStatus(message) {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
  }
}

// Create text label for 3D scene
function createTextLabel(text, position, color = 0xffffff, size = 1, compact = false) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (compact) {
    // Compact labels for strike prices
    canvas.width = 128;
    canvas.height = 64;
    
    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.85)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    context.lineWidth = 1;
    context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    
    // Draw text
    context.font = 'bold 16px Arial';
    context.fillStyle = 'rgba(255, 255, 255, 1.0)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Handle multi-line text
    const lines = text.split('\n');
    const lineHeight = 18;
    const startY = (canvas.height - (lines.length * lineHeight)) / 2 + 4;
    
    lines.forEach((line, i) => {
      context.fillText(line, canvas.width / 2, startY + (i * lineHeight));
    });
  } else {
    // Standard labels
    canvas.width = 256;
    canvas.height = 128;
    
    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    context.lineWidth = 2;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // Draw text
    context.font = 'bold 24px Arial';
    context.fillStyle = 'rgba(255, 255, 255, 1.0)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Handle multi-line text
    const lines = text.split('\n');
    const lineHeight = 28;
    const startY = (canvas.height - (lines.length * lineHeight)) / 2 + 10;
    
    lines.forEach((line, i) => {
      context.fillText(line, canvas.width / 2, startY + (i * lineHeight));
    });
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  
  if (compact) {
    sprite.scale.set(20 * size, 10 * size, 1);
  } else {
    sprite.scale.set(40 * size, 20 * size, 1);
  }
  
  return sprite;
}

// Create axis line with ticks
function createAxis(start, end, ticks, axis, color = 0xffffff) {
  const material = new THREE.LineBasicMaterial({ color: color });
  const points = [start, end];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  
  axisLines.add(line);
  
  // Add tick marks
  if (ticks && ticks.length > 0) {
    for (const tick of ticks) {
      let tickPos;
      let tickLength = 5;
      let labelPos;
      
      switch (axis) {
        case 'x':
          tickPos = new THREE.Vector3(tick.value, 0, start.z);
          labelPos = new THREE.Vector3(tick.value, -10, start.z);
          break;
        case 'y':
          tickPos = new THREE.Vector3(start.x, tick.value, start.z);
          labelPos = new THREE.Vector3(start.x - 20, tick.value, start.z);
          break;
        case 'z':
          tickPos = new THREE.Vector3(start.x, 0, tick.value);
          labelPos = new THREE.Vector3(start.x, -10, tick.value);
          break;
      }
      
      if (tickPos && labelPos) {
        // Add tick line
        const tickGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(tickPos.x, tickPos.y, tickPos.z),
          new THREE.Vector3(tickPos.x, tickPos.y - tickLength, tickPos.z)
        ]);
        const tickLine = new THREE.Line(tickGeometry, material);
        axisLines.add(tickLine);
        
        // Add tick label
        if (tick.label) {
          const label = createTextLabel(tick.label, labelPos, color, 0.5, true); // Compact labels
          labelGroup.add(label);
        }
      }
    }
  }
  
  return line;
}

// Get color based on value and chosen color scheme
function getColorForValue(normalizedValue) {
  let color = new THREE.Color();
  
  switch (state.colorScheme) {
    case 'rainbow':
      // Rainbow: Blue (low) to Red (high)
      color.setHSL(0.7 - normalizedValue * 0.7, 1.0, 0.5);
      break;
    case 'heatmap':
      // Heatmap: Blue (low) to Green to Red (high)
      if (normalizedValue < 0.5) {
        // Blue to Green (0-0.5)
        color.setRGB(
          0,
          normalizedValue * 2,
          1 - normalizedValue * 2
        );
      } else {
        // Green to Red (0.5-1)
        color.setRGB(
          (normalizedValue - 0.5) * 2,
          1 - (normalizedValue - 0.5) * 2,
          0
        );
      }
      break;
    case 'monochrome':
      // Black-to-white
      color.setRGB(normalizedValue, normalizedValue, normalizedValue);
      break;
    default:
      // Default rainbow
      color.setHSL(0.7 - normalizedValue * 0.7, 1.0, 0.5);
  }
  
  return color;
}

// Fetch options data from Polygon.io
async function fetchOptionsData() {
  updateStatus(`Fetching options data for ${state.currentSymbol}...`);
  
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(now.getDate() + state.expiryRange); 
  
  const fromDate = now.toISOString().split('T')[0];
  const toDate = expiryDate.toISOString().split('T')[0];
  
  const url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${state.currentSymbol}&expiration_date.gte=${fromDate}&expiration_date.lte=${toDate}&limit=1000&apiKey=${state.apiKey}`;
  
  try {
    updateStatus(`Requesting data from Polygon API...`);
    console.log(`Fetching data from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Polygon.io response:", data);
    
    if (!data.results || data.results.length === 0) {
      updateStatus(`No options data available for ${state.currentSymbol}. Try another ticker.`);
      return null;
    }
    
    updateStatus(`Received ${data.results.length} contracts for ${state.currentSymbol}`);
    return data.results;
  } catch (error) {
    console.error("Error fetching options data:", error);
    updateStatus(`Error: ${error.message}`);
    return null;
  }
}

// -------------------- Updated Synthetic Data Generation --------------------
// Generate synthetic IV and Greek data using refined gamma math
function generateSyntheticData(contracts, baseIV = 0.3) {
  const syntheticData = [];
  
  // Get the current stock price (approximate from ATM options)
  let stockPrice = 0;
  const atmOptions = contracts.filter(c => c.strike_price > 0 && c.contract_type && c.expiration_date);
  
  if (atmOptions.length > 0) {
    // Sort by how close to expiration
    const nearTermOptions = atmOptions.sort((a, b) => {
      const dateA = new Date(a.expiration_date);
      const dateB = new Date(b.expiration_date);
      return dateA - dateB;
    });
    
    // Use the average of a few strikes as an approximation
    const midIndex = Math.floor(nearTermOptions.length / 2);
    stockPrice = nearTermOptions[midIndex].strike_price;
  } else {
    // Fallback to a default value
    stockPrice = 100;
  }
  
  // Store ATM price for normalization
  state.atmPrice = stockPrice;
  
  console.log(`Estimated current stock price: ${stockPrice}`);
  
  // Group by expiration date for better term structure
  const expirationGroups = {};
  
  contracts.forEach(contract => {
    if (!contract.strike_price || !contract.expiration_date) return;
    
    const expDate = contract.expiration_date;
    if (!expirationGroups[expDate]) {
      expirationGroups[expDate] = [];
    }
    
    expirationGroups[expDate].push(contract);
  });
  
  // Generate a consistent IV surface with realistic term structure
  Object.entries(expirationGroups).forEach(([expDate, contracts]) => {
    const expiryDate = new Date(expDate);
    const daysToExpiry = (expiryDate - new Date()) / (1000 * 60 * 60 * 24);
    
    if (daysToExpiry <= 0) return;
    
    // For this expiry, create a realistic volatility smile
    const strikes = contracts.map(c => c.strike_price).sort((a, b) => a - b);
    
    // Calculate moneyness for all strikes
    const atmIndex = findClosestIndex(strikes, stockPrice);
    const atmStrike = strikes[atmIndex];
    
    // Adjustments for term structure
    const termFactor = Math.sqrt(daysToExpiry / 30); // Square root of time
    const baseIVForTerm = baseIV * (1 + 0.1 * (Math.log(daysToExpiry / 30) / Math.log(12))); // Slight increase with time
    
    // Generate the volatility smile for this expiry
    contracts.forEach(contract => {
      const strike = contract.strike_price;
      const moneyness = (strike - atmStrike) / atmStrike;
      
      // Create a realistic smile shape (parabolic)
      let iv = baseIVForTerm + 0.06 * Math.pow(moneyness, 2);
      
      // Add put skew (higher IV for lower strikes)
      if (moneyness < 0) {
        iv += 0.02 * Math.abs(moneyness);
      }
      
      // Add randomness to make it look more realistic
      iv += (Math.random() * 0.02 - 0.01);
      
      // Compute time to expiry in years
      const timeToExpiry = daysToExpiry / 365;
      
      // Compute Black-Scholes gamma using our refined math
      const gamma_bs = computeGamma(stockPrice, strike, state.riskFreeRate, iv, timeToExpiry);
      // Compute gamma exposure: gamma * open interest * contract multiplier
      const openInterest = Math.floor(Math.random() * 1000) + 50;
      const gammaExposure = gamma_bs * openInterest * state.contractMultiplier;
      
      // Calculate realistic option greeks (delta, theta, vega) remain similar for demonstration
      let delta;
      if (contract.contract_type === 'call') {
        delta = 0.5 + 0.5 * (1 - Math.exp(-10 * moneyness));
      } else {
        delta = -0.5 - 0.5 * (1 - Math.exp(-10 * -moneyness));
      }
      
      const theta = -stockPrice * 0.01 * gamma_bs / termFactor;
      const vega = stockPrice * 0.01 * gamma_bs * termFactor;
      
      // Black-Scholes approximation for option price
      const rate = state.riskFreeRate;
      const d1 = (Math.log(stockPrice / strike) + (rate + 0.5 * iv * iv) * timeToExpiry) / (iv * Math.sqrt(timeToExpiry));
      const d2 = d1 - iv * Math.sqrt(timeToExpiry);
      
      const normCDF = (x) => {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.398942280401433 * Math.exp(-0.5 * x * x);
        const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
        return x >= 0 ? 1 - p : p;
      };
      
      let optionPrice;
      if (contract.contract_type === 'call') {
        optionPrice = stockPrice * normCDF(d1) - strike * Math.exp(-rate * timeToExpiry) * normCDF(d2);
      } else {
        optionPrice = strike * Math.exp(-rate * timeToExpiry) * normCDF(-d2) - stockPrice * normCDF(-d1);
      }
      
      const bidPrice = optionPrice * (0.95 + Math.random() * 0.03);
      const askPrice = optionPrice * (1.02 + Math.random() * 0.03);
      const lastPrice = optionPrice * (0.97 + Math.random() * 0.06);
      
      syntheticData.push({
        ticker: contract.ticker,
        strike: strike,
        daysToExpiry: daysToExpiry,
        iv: iv,
        // Use gamma exposure as the gamma metric for visualization and table
        gamma: gammaExposure,
        delta: delta,
        theta: theta,
        vega: vega,
        contract_type: contract.contract_type,
        moneyness: moneyness,
        bid_price: bidPrice,
        ask_price: askPrice,
        last_price: lastPrice,
        open_interest: openInterest,
        volume: Math.floor(Math.random() * openInterest * 0.8),
        expiration_date: contract.expiration_date
      });
    });
  });
  
  return syntheticData;
}

// Helper function to find closest index in an array
function findClosestIndex(arr, val) {
  let minDiff = Infinity;
  let closestIndex = 0;
  
  for (let i = 0; i < arr.length; i++) {
    const diff = Math.abs(arr[i] - val);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

// -------------------- End Updated Synthetic Data Generation --------------------

// Clear previous visualization
function clearScene() {
  if (volatilityMesh) scene.remove(volatilityMesh);
  if (gammaOverlayMesh) scene.remove(gammaOverlayMesh);
  if (surfaceMesh) scene.remove(surfaceMesh);
  
  scene.remove(axisLines);
  axisLines = new THREE.Group();
  scene.add(axisLines);
  
  scene.remove(labelGroup);
  labelGroup = new THREE.Group();
  scene.add(labelGroup);
  
  volatilityMesh = null;
  gammaOverlayMesh = null;
  surfaceMesh = null;
}

// Process and visualize data
async function fetchAndDisplayData() {
  // Clear previous visualization
  clearScene();
  
  // Update grid
  createGrid();
  
  // Fetch contract data
  const contracts = await fetchOptionsData();
  if (!contracts || contracts.length === 0) return;
  
  // For now, generate synthetic data
  // In a real implementation, you would fetch real market data
  const processedData = generateSyntheticData(contracts);
  
  updateStatus(`Creating visualization with ${processedData.length} data points...`);
  console.log("Processed data sample:", processedData.slice(0, 3));
  
  // Create the visualization
  createVolatilitySurface(processedData);
  
  // Create options chain table
  if (state.showOptionsChain) {
    createOptionsChainTable(processedData);
  }
}

// Create options chain table
function createOptionsChainTable(data) {
  // Remove existing table if any
  const existingTable = document.getElementById('options-chain');
  if (existingTable) {
    existingTable.remove();
  }
  
  // Create table container
  const tableContainer = document.createElement('div');
  tableContainer.id = 'options-chain';
  tableContainer.style.position = 'fixed';
  tableContainer.style.bottom = '0';
  tableContainer.style.left = '0';
  tableContainer.style.right = '0';
  tableContainer.style.height = '250px';
  tableContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  tableContainer.style.color = 'white';
  tableContainer.style.fontFamily = 'Arial, sans-serif';
  tableContainer.style.fontSize = '12px';
  tableContainer.style.overflowY = 'auto';
  tableContainer.style.zIndex = '1000';
  tableContainer.style.padding = '10px';
  tableContainer.style.borderTop = '1px solid #444';
  tableContainer.style.display = state.showOptionsChain ? 'block' : 'none';
  
  // Create table header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '10px';
  
  const title = document.createElement('h3');
  title.textContent = `${state.currentSymbol} Options Chain`;
  title.style.margin = '0';
  header.appendChild(title);
  
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Hide Chain';
  closeButton.style.backgroundColor = '#0078D4';
  closeButton.style.color = 'white';
  closeButton.style.border = 'none';
  closeButton.style.padding = '5px 10px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.borderRadius = '3px';
  header.appendChild(closeButton);
  
  tableContainer.appendChild(header);
  
  // Create the table
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.textAlign = 'center';
  
  // Create the table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const headers = [
    'Exp. Date', 'Type', 'Strike', 'Last', 'Bid', 'Ask', 'IV', 'Delta', 'Gamma', 'Theta', 'Vega', 'OI'
  ];
  
  headers.forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    th.style.padding = '5px';
    th.style.borderBottom = '1px solid #444';
    th.style.backgroundColor = '#222';
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create table body
  const tbody = document.createElement('tbody');
  
  // Group data by expiration date
  const expiryGroups = {};
  
  data.forEach(item => {
    if (!item.daysToExpiry) return;
    
    const expiryKey = Math.round(item.daysToExpiry);
    if (!expiryGroups[expiryKey]) {
      expiryGroups[expiryKey] = [];
    }
    
    expiryGroups[expiryKey].push(item);
  });
  
  // Sort expiry dates
  const sortedExpiries = Object.keys(expiryGroups).map(Number).sort((a, b) => a - b);
  
  // Add rows grouped by expiration date
  sortedExpiries.forEach(expiryDays => {
    // Sort by strike and then by type (puts then calls)
    const contracts = expiryGroups[expiryDays].sort((a, b) => {
      if (a.strike !== b.strike) return a.strike - b.strike;
      if (a.contract_type === 'put' && b.contract_type === 'call') return -1;
      if (a.contract_type === 'call' && b.contract_type === 'put') return 1;
      return 0;
    });
    
    // Create a header row for this expiration
    const expiryHeaderRow = document.createElement('tr');
    const expiryHeader = document.createElement('td');
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    expiryHeader.textContent = `Expiration: ${expiryDate.toLocaleDateString()}`;
    expiryHeader.colSpan = headers.length;
    expiryHeader.style.backgroundColor = '#333';
    expiryHeader.style.padding = '5px';
    expiryHeader.style.fontWeight = 'bold';
    
    expiryHeaderRow.appendChild(expiryHeader);
    tbody.appendChild(expiryHeaderRow);
    
    // Add rows for all contracts
    contracts.forEach(contract => {
      const row = document.createElement('tr');
      
      // Generate row data
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + contract.daysToExpiry);
      
      // If strikes are normalized, convert strike value
      const strikeVal = state.normalizeStrikes ? transformStrike(contract.strike) : contract.strike;
      
      const cells = [
        expDate.toLocaleDateString(),
        contract.contract_type.toUpperCase(),
        strikeVal.toFixed(2),
        '$' + (contract.last_price || (contract.strike * 0.05)).toFixed(2),
        '$' + (contract.bid_price || (contract.strike * 0.045)).toFixed(2),
        '$' + (contract.ask_price || (contract.strike * 0.055)).toFixed(2),
        (contract.iv * 100).toFixed(2) + '%',
        contract.delta ? contract.delta.toFixed(3) : 'N/A',
        contract.gamma ? contract.gamma.toFixed(4) : 'N/A',
        contract.theta ? contract.theta.toFixed(4) : 'N/A',
        contract.vega ? contract.vega.toFixed(4) : 'N/A',
        contract.open_interest || Math.floor(Math.random() * 1000)
      ];
      
      cells.forEach(cellText => {
        const td = document.createElement('td');
        td.textContent = cellText;
        td.style.padding = '3px';
        td.style.borderBottom = '1px solid #333';
        
        // Color code based on contract type
        if (contract.contract_type === 'call') {
          td.style.color = '#4CAF50'; // Green for calls
        } else {
          td.style.color = '#F44336'; // Red for puts
        }
        
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
  });
  
  table.appendChild(tbody);
  tableContainer.appendChild(table);
  
  // Event listener for the close button
  closeButton.addEventListener('click', () => {
    tableContainer.style.display = tableContainer.style.display === 'none' ? 'block' : 'none';
    closeButton.textContent = tableContainer.style.display === 'none' ? 'Show Chain' : 'Hide Chain';
    state.showOptionsChain = tableContainer.style.display !== 'none';
    
    // Update checkbox in controls
    const chainCheckbox = document.getElementById('chainToggle');
    if (chainCheckbox) {
      chainCheckbox.checked = state.showOptionsChain;
    }
  });
  
  document.body.appendChild(tableContainer);
}

// Calculate appropriate step size for axis ticks
function calculateAxisStep(min, max) {
  const range = max - min;
  
  if (range <= 5) return 1;
  if (range <= 20) return 2;
  if (range <= 50) return 5;
  if (range <= 100) return 10;
  if (range <= 500) return 50;
  
  return Math.ceil(range / 10);
}

// Interpolate missing values in grid
function interpolateGrid(grid, rows, cols) {
  // First pass: fill in missing values using nearby valid points
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (!grid[i][j]) {
        // Look for valid nearby points
        const neighbors = [];
        const weights = [];
        
        // Check neighboring cells
        for (let di = -2; di <= 2; di++) {
          for (let dj = -2; dj <= 2; dj++) {
            if (di === 0 && dj === 0) continue;
            
            const ni = i + di;
            const nj = j + dj;
            
            if (ni >= 0 && ni < rows && nj >= 0 && nj < cols && grid[ni][nj]) {
              neighbors.push(grid[ni][nj]);
              // Closer neighbors get higher weight
              weights.push(1 / (Math.abs(di) + Math.abs(dj)));
            }
          }
        }
        
        if (neighbors.length > 0) {
          // Weighted average of neighbors
          let ivSum = 0;
          let gammaSum = 0;
          let weightSum = 0;
          
          for (let k = 0; k < neighbors.length; k++) {
            if (neighbors[k].iv !== undefined) {
              ivSum += neighbors[k].iv * weights[k];
            }
            
            if (neighbors[k].gamma !== undefined) {
              gammaSum += neighbors[k].gamma * weights[k];
            }
            
            weightSum += weights[k];
          }
          
          grid[i][j] = {};
          
          if (ivSum > 0) {
            grid[i][j].iv = ivSum / weightSum;
          }
          
          if (gammaSum > 0) {
            grid[i][j].gamma = gammaSum / weightSum;
          }
          
          grid[i][j].count = 1; // Mark as interpolated
        }
      }
    }
  }
  
  // Second pass: fill any remaining gaps with global averages
  let ivSum = 0;
  let gammaSum = 0;
  let countIV = 0;
  let countGamma = 0;
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (grid[i][j]) {
        if (grid[i][j].iv !== undefined) {
          ivSum += grid[i][j].iv;
          countIV++;
        }
        if (grid[i][j].gamma !== undefined) {
          gammaSum += grid[i][j].gamma;
          countGamma++;
        }
      }
    }
  }
  
  const avgIV = countIV > 0 ? ivSum / countIV : 0.3;
  const avgGamma = countGamma > 0 ? gammaSum / countGamma : 0.01;
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (!grid[i][j]) {
        grid[i][j] = {
          iv: avgIV,
          gamma: avgGamma,
          count: 1
        };
      } else {
        if (grid[i][j].iv === undefined) {
          grid[i][j].iv = avgIV;
        }
        if (grid[i][j].gamma === undefined) {
          grid[i][j].gamma = avgGamma;
        }
      }
    }
  }
}

// Create volatility surface visualization (Bloomberg style)
function createVolatilitySurface(data) {
  if (!data || data.length === 0) {
    updateStatus("No valid data to visualize.");
    return;
  }
  
  // Extract data ranges using transformed strikes if normalization is enabled
  let minStrike = Infinity;
  let maxStrike = -Infinity;
  let minDays = Infinity;
  let maxDays = -Infinity;
  let minIV = Infinity;
  let maxIV = -Infinity;
  let minGamma = Infinity;
  let maxGamma = -Infinity;
  
  // Group data by expiration date for better organization
  const expiryGroups = {};
  const strikePrices = new Set();
  
  data.forEach(item => {
    // Transform strike if needed
    const strikeVal = transformStrike(item.strike);
    minStrike = Math.min(minStrike, strikeVal);
    maxStrike = Math.max(maxStrike, strikeVal);
    minDays = Math.min(minDays, item.daysToExpiry);
    maxDays = Math.max(maxDays, item.daysToExpiry);
    minIV = Math.min(minIV, item.iv);
    maxIV = Math.max(maxIV, item.iv);
    if (item.gamma !== undefined) {
      minGamma = Math.min(minGamma, item.gamma);
      maxGamma = Math.max(maxGamma, item.gamma);
    }
    
    // Track unique strike prices (transformed)
    strikePrices.add(strikeVal);
    
    // Group by expiration
    const daysKey = Math.round(item.daysToExpiry);
    if (!expiryGroups[daysKey]) {
      expiryGroups[daysKey] = [];
    }
    expiryGroups[daysKey].push(item);
  });
  
  console.log("Data ranges:", {
    strike: [minStrike, maxStrike],
    days: [minDays, maxDays],
    iv: [minIV, maxIV],
    gamma: [minGamma, maxGamma],
    uniqueStrikes: strikePrices.size,
    expiryDates: Object.keys(expiryGroups).length
  });
  
  // Round ranges for cleaner axes
  const strikeRange = maxStrike - minStrike;
  const daysRange = maxDays - minDays;
  
  minStrike = Math.floor(minStrike - strikeRange * 0.05);
  maxStrike = Math.ceil(maxStrike + strikeRange * 0.05);
  minDays = Math.max(0, Math.floor(minDays - daysRange * 0.05));
  maxDays = Math.ceil(maxDays + daysRange * 0.05);
  
  // Create Bloomberg-style grid and axes
  // Clear previous axes
  scene.remove(axisLines);
  axisLines = new THREE.Group();
  scene.add(axisLines);
  
  // Create X (strike) axis with ticks
  const xAxisStart = new THREE.Vector3(minStrike, 0, minDays);
  const xAxisEnd = new THREE.Vector3(maxStrike, 0, minDays);
  
  // Generate tick marks for strike axis - use actual strikes instead of regular intervals
  const strikeTicks = [];
  const sortedStrikes = Array.from(strikePrices).sort((a, b) => a - b);
  
  // If too many strikes, use a subset
  const maxTicks = 20; // Maximum number of ticks to display
  let strikesToShow;
  
  if (sortedStrikes.length <= maxTicks) {
    strikesToShow = sortedStrikes;
  } else {
    // Select a representative subset
    const step = Math.ceil(sortedStrikes.length / maxTicks);
    strikesToShow = [];
    for (let i = 0; i < sortedStrikes.length; i += step) {
      strikesToShow.push(sortedStrikes[i]);
    }
    // Always include min and max
    if (!strikesToShow.includes(sortedStrikes[0])) {
      strikesToShow.unshift(sortedStrikes[0]);
    }
    if (!strikesToShow.includes(sortedStrikes[sortedStrikes.length - 1])) {
      strikesToShow.push(sortedStrikes[sortedStrikes.length - 1]);
    }
    strikesToShow.sort((a, b) => a - b);
  }
  
  strikesToShow.forEach(strike => {
    strikeTicks.push({
      value: strike,
      label: strike.toFixed(1)
    });
  });
  
  createAxis(xAxisStart, xAxisEnd, strikeTicks, 'x', 0xFFFFFF);
  
  // Create Z (days to expiry) axis with ticks
  const zAxisStart = new THREE.Vector3(minStrike, 0, minDays);
  const zAxisEnd = new THREE.Vector3(minStrike, 0, maxDays);
  
  // Generate tick marks for days axis - use actual expiration dates
  const daysTicks = [];
  const sortedDays = Object.keys(expiryGroups).map(Number).sort((a, b) => a - b);
  
  sortedDays.forEach(days => {
    daysTicks.push({
      value: days,
      label: days.toString()
    });
  });
  
  createAxis(zAxisStart, zAxisEnd, daysTicks, 'z', 0xFFFFFF);
  
  // Create Y (IV) axis with ticks
  const ivAxisStart = new THREE.Vector3(minStrike, 0, minDays);
  const ivAxisEnd = new THREE.Vector3(minStrike, state.desiredVolHeight, minDays);
  
  // Generate tick marks for IV axis
  const ivTicks = [];
  const ivStep = calculateAxisStep(minIV, maxIV);
  
  for (let tick = Math.ceil(minIV / ivStep) * ivStep; tick <= maxIV; tick += ivStep) {
    ivTicks.push({
      value: tick * (state.desiredVolHeight / maxIV),
      label: (tick * 100).toFixed(1) + '%'
    });
  }
  
  createAxis(ivAxisStart, ivAxisEnd, ivTicks, 'y', 0xFFFFFF);
  
  // Add vertical IV guidelines (horizontal planes at specific IV levels)
  const ivLevels = [0.2, 0.3, 0.4, 0.5]; // 20%, 30%, 40%, 50% IV levels
  
  ivLevels.forEach(ivLevel => {
    if (ivLevel >= minIV && ivLevel <= maxIV) {
      const yPosition = ivLevel * (state.desiredVolHeight / maxIV);
      
      // Create a horizontal grid at this IV level
      const gridGeometry = new THREE.PlaneGeometry(
        maxStrike - minStrike,
        maxDays - minDays
      );
      
      // Position the grid at the IV level
      gridGeometry.rotateX(-Math.PI / 2);
      gridGeometry.translate(
        (minStrike + maxStrike) / 2,
        yPosition, // IV level
        (minDays + maxDays) / 2
      );
      
      const gridMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
        wireframe: true
      });
      
      const gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
      axisLines.add(gridMesh);
      
      // Add label for this IV level
      const ivLevelLabel = createTextLabel(
        `${(ivLevel * 100).toFixed(0)}% IV`,
        new THREE.Vector3(minStrike - 10, yPosition, minDays),
        0xFFFFFF,
        0.6,
        true
      );
      labelGroup.add(ivLevelLabel);
    }
  });
  
  // Prepare grid data for surface
  const strikeGridSize = 50;
  const daysGridSize = 20;
  
  const strikeGridStep = (maxStrike - minStrike) / (strikeGridSize - 1);
  const daysGridStep = (maxDays - minDays) / (daysGridSize - 1);
  
  // Create a regular grid of points
  const gridData = Array(strikeGridSize).fill().map(() => Array(daysGridSize).fill(null));
  const gammaGridData = Array(strikeGridSize).fill().map(() => Array(daysGridSize).fill(null));
  
  // Organize data by strike and days using transformed strikes
  data.forEach(item => {
    const transformedStrike = transformStrike(item.strike);
    const strikeIndex = Math.min(strikeGridSize - 1, Math.max(0, Math.floor((transformedStrike - minStrike) / strikeGridStep)));
    const daysIndex = Math.min(daysGridSize - 1, Math.max(0, Math.floor((item.daysToExpiry - minDays) / daysGridStep)));
    
    if (!gridData[strikeIndex][daysIndex]) {
      gridData[strikeIndex][daysIndex] = {
        iv: item.iv,
        count: 1
      };
      
      if (item.gamma !== undefined) {
        gammaGridData[strikeIndex][daysIndex] = {
          gamma: item.gamma,
          count: 1
        };
      }
    } else {
      gridData[strikeIndex][daysIndex].iv = (gridData[strikeIndex][daysIndex].iv * gridData[strikeIndex][daysIndex].count + item.iv) / (gridData[strikeIndex][daysIndex].count + 1);
      gridData[strikeIndex][daysIndex].count++;
      
      if (item.gamma !== undefined && gammaGridData[strikeIndex][daysIndex]) {
        gammaGridData[strikeIndex][daysIndex].gamma = (gammaGridData[strikeIndex][daysIndex].gamma * gammaGridData[strikeIndex][daysIndex].count + item.gamma) / (gammaGridData[strikeIndex][daysIndex].count + 1);
        gammaGridData[strikeIndex][daysIndex].count++;
      }
    }
  });
  
  // Fill in missing data using local interpolation
  interpolateGrid(gridData, strikeGridSize, daysGridSize);
  interpolateGrid(gammaGridData, strikeGridSize, daysGridSize);
  
  // Create surface geometry
  const geometry = new THREE.PlaneGeometry(
    maxStrike - minStrike,
    maxDays - minDays,
    strikeGridSize - 1,
    daysGridSize - 1
  );
  
  // Adjust the position and rotation
  geometry.rotateX(-Math.PI / 2); // Rotate to horizontal
  geometry.translate(
    (minStrike + maxStrike) / 2,
    0,
    (minDays + maxDays) / 2
  );
  
  // Calculate scaling factor for IV so that maxIV maps to state.desiredVolHeight
  const volScale = state.desiredVolHeight / maxIV;
  
  // Update vertices to match IV values
  const positions = geometry.attributes.position.array;
  const colors = [];
  
  for (let i = 0; i < positions.length / 3; i++) {
    const xi = i % strikeGridSize;
    const zi = Math.floor(i / strikeGridSize);
    
    if (xi < strikeGridSize && zi < daysGridSize) {
      const strike = minStrike + xi * strikeGridStep;
      const days = minDays + zi * daysGridStep;
      
      const strikeIndex = Math.min(strikeGridSize - 1, Math.max(0, xi));
      const daysIndex = Math.min(daysGridSize - 1, Math.max(0, zi));
      
      let iv = 0;
      if (gridData[strikeIndex][daysIndex]) {
        iv = gridData[strikeIndex][daysIndex].iv;
      }
      
      // Update height (y coordinate) to match normalized IV
      const scaledIV = iv * volScale;
      positions[i * 3 + 1] = scaledIV;
      
      // Add color based on IV
      const normalizedIV = (iv - minIV) / (maxIV - minIV || 1);
      const color = getColorForValue(normalizedIV);
      
      colors.push(color.r, color.g, color.b);
    } else {
      colors.push(0, 0, 0); // Default black
    }
  }
  
  // Update geometry
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  
  // Add colors to the surface
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  // Create material for surface
  let surfaceMaterial;
  
  if (state.surfaceType === 'wireframe') {
    surfaceMaterial = new THREE.MeshBasicMaterial({
      wireframe: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
  } else {
    surfaceMaterial = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 70,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      wireframe: false
    });
  }
  
  // Create surface mesh
  surfaceMesh = new THREE.Mesh(geometry, surfaceMaterial);
  scene.add(surfaceMesh);
  
  // Create point cloud for raw data
  const pointGeometry = new THREE.BufferGeometry();
  const pointPositions = [];
  const pointColors = [];
  
  data.forEach(item => {
    const x = transformStrike(item.strike);
    const y = item.iv * volScale; // Use normalized scaling
    const z = item.daysToExpiry;
    
    pointPositions.push(x, y, z);
    
    // Color based on IV
    const normalizedIV = (item.iv - minIV) / (maxIV - minIV || 1);
    const color = getColorForValue(normalizedIV);
    
    pointColors.push(color.r, color.g, color.b);
  });
  
  pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
  pointGeometry.setAttribute('color', new THREE.Float32BufferAttribute(pointColors, 3));
  
  const pointMaterial = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    sizeAttenuation: true
  });
  
  volatilityMesh = new THREE.Points(pointGeometry, pointMaterial);
  scene.add(volatilityMesh);
  
  // Create gamma visualization if enabled
  if (state.showGamma) {
    createGammaVisualization(data, gammaGridData, minGamma, maxGamma, minStrike, maxStrike, minDays, maxDays, strikeGridStep, daysGridStep, strikeGridSize, daysGridSize);
  }
  
  // Set visibility based on display type
  updateVisualizationType();
  
  // Add important labels
  if (state.showLabels) {
    // Title label with ticker symbol
    const titleLabel = createTextLabel(`${state.currentSymbol} IV Surface`, 
        new THREE.Vector3((minStrike + maxStrike) / 2, state.desiredVolHeight + 20, maxDays + 20));
    labelGroup.add(titleLabel);
    
    // Add key metrics
    const metricsLabel = createTextLabel(
      `Min IV: ${(minIV * 100).toFixed(1)}%\nMax IV: ${(maxIV * 100).toFixed(1)}%\nStrikes: ${minStrike.toFixed(0)}-${maxStrike.toFixed(0)}`,
      new THREE.Vector3(minStrike, state.desiredVolHeight + 20, minDays)
    );
    labelGroup.add(metricsLabel);
    
    // Add a label for the current date
    const dateLabel = createTextLabel(
      `Data as of: ${new Date().toLocaleDateString()}`,
      new THREE.Vector3(maxStrike, 0, minDays)
    );
    labelGroup.add(dateLabel);
    
    // Add strike price labels for each expiration group
    const expiryKeys = Object.keys(expiryGroups).map(Number).sort((a, b) => a - b);
    const strideStep = Math.ceil(expiryKeys.length / 4); // Only show labels for every n-th expiry to avoid clutter
    
    for (let i = 0; i < expiryKeys.length; i += strideStep) {
      const daysToExpiry = expiryKeys[i];
      
      // Sort contracts by strike for this expiration
      const contracts = expiryGroups[daysToExpiry].sort((a, b) => a.strike - b.strike);
      
      // To avoid too many labels, use stride for strikes as well
      const strikeStride = Math.max(1, Math.ceil(contracts.length / 8));
      
      for (let j = 0; j < contracts.length; j += strikeStride) {
        const contract = contracts[j];
        const strike = transformStrike(contract.strike);
        const iv = contract.iv;
        
        // Create short label with strike price and IV
        const contractLabel = createTextLabel(
          `${strike.toFixed(1)}\n${(iv * 100).toFixed(1)}%`,
          new THREE.Vector3(strike, iv * volScale + 10, daysToExpiry),
          0xFFFFFF,
          0.5,
          true // compact
        );
        labelGroup.add(contractLabel);
      }
    }
    
    // Add strike labels to the strike axis
    sortedStrikes.forEach(strike => {
      // Create small labels at the bottom
      const strikeAxisLabel = createTextLabel(
        strike.toFixed(1),
        new THREE.Vector3(strike, -10, minDays - 5),
        0xFFFFFF,
        0.4,
        true // compact
      );
      labelGroup.add(strikeAxisLabel);
    });
    
    // Add vertical grid lines for key strikes
    const strikeInterval = Math.ceil(sortedStrikes.length / 10);
    for (let i = 0; i < sortedStrikes.length; i += strikeInterval) {
      const strike = sortedStrikes[i];
      
      // Create vertical line
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(strike, 0, minDays),
        new THREE.Vector3(strike, state.desiredVolHeight, minDays),
        new THREE.Vector3(strike, state.desiredVolHeight, maxDays),
        new THREE.Vector3(strike, 0, maxDays)
      ]);
      
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x444444,
        transparent: true,
        opacity: 0.3
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      axisLines.add(line);
    }
  }
  
  // Position camera to view the surface optimally
  positionCameraForOptimalView(minStrike, maxStrike, minDays, maxDays, state.desiredVolHeight);
  
  updateStatus(`Volatility surface for ${state.currentSymbol} created successfully.`);
}

// Create gamma visualization based on selected display mode
function createGammaVisualization(data, gammaGridData, minGamma, maxGamma, minStrike, maxStrike, minDays, maxDays, strikeGridStep, daysGridStep, strikeGridSize, daysGridSize) {
  if (state.gammaDisplayMode === 'plane') {
    // Create a semi-transparent plane for gamma
    const gammaGeometry = new THREE.PlaneGeometry(
      maxStrike - minStrike,
      maxDays - minDays,
      strikeGridSize - 1,
      daysGridSize - 1
    );
    
    // Position the gamma plane
    gammaGeometry.rotateX(-Math.PI / 2);
    gammaGeometry.translate(
      (minStrike + maxStrike) / 2,
      0,
      (minDays + maxDays) / 2
    );
    
    // Update vertices and colors for gamma visualization
    const gammaPositions = gammaGeometry.attributes.position.array;
    const gammaColors = [];
    
    for (let i = 0; i < gammaPositions.length / 3; i++) {
      const xi = i % strikeGridSize;
      const zi = Math.floor(i / strikeGridSize);
      
      if (xi < strikeGridSize && zi < daysGridSize) {
        const strikeIndex = Math.min(strikeGridSize - 1, Math.max(0, xi));
        const daysIndex = Math.min(daysGridSize - 1, Math.max(0, zi));
        
        let gamma = 0;
        if (gammaGridData[strikeIndex][daysIndex]) {
          gamma = gammaGridData[strikeIndex][daysIndex].gamma;
        }
        
        // Keep original x,z coordinates but set y to a baseline below the surface
        gammaPositions[i * 3 + 1] = -10; // Position below the surface
        
        // Color based on gamma
        const normalizedGamma = (gamma - minGamma) / (maxGamma - minGamma || 1);
        
        // Use a different color scheme for gamma
        const gammaColor = new THREE.Color();
        gammaColor.setHSL(0.3 - normalizedGamma * 0.3, 1.0, 0.5); // Green to red
        
        gammaColors.push(gammaColor.r, gammaColor.g, gammaColor.b);
      } else {
        gammaColors.push(0, 0, 0); // Default black
      }
    }
    
    // Update gamma geometry
    gammaGeometry.attributes.position.needsUpdate = true;
    gammaGeometry.computeVertexNormals();
    
    // Add colors to gamma plane
    gammaGeometry.setAttribute('color', new THREE.Float32BufferAttribute(gammaColors, 3));
    
    // Create material for gamma plane
    const gammaMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    
    // Create gamma mesh
    gammaOverlayMesh = new THREE.Mesh(gammaGeometry, gammaMaterial);
    scene.add(gammaOverlayMesh);
    
    // Add a label for gamma
    if (state.showLabels) {
      const gammaLabel = createTextLabel('Gamma Overlay', 
          new THREE.Vector3((minStrike + maxStrike) / 2, -20, (minDays + maxDays) / 2));
      labelGroup.add(gammaLabel);
    }
  } else if (state.gammaDisplayMode === 'points') {
    // Create points for gamma visualization
    const gammaPointsGeometry = new THREE.BufferGeometry();
    const gammaPointsPositions = [];
    const gammaPointsColors = [];
    
    // Scale factor for gamma visualization
    const gammaScaleFactor = 10;
    
    data.forEach(item => {
      if (item.gamma === undefined) return;
      
      const x = transformStrike(item.strike);
      const y = -5; // Position below the surface
      const z = item.daysToExpiry;
      
      gammaPointsPositions.push(x, y, z);
      
      // Size points based on gamma
      const normalizedGamma = (item.gamma - minGamma) / (maxGamma - minGamma || 1);
      
      // Use a different color scheme for gamma
      const gammaColor = new THREE.Color();
      gammaColor.setHSL(0.3 - normalizedGamma * 0.3, 1.0, 0.5); // Green to red
      
      gammaPointsColors.push(gammaColor.r, gammaColor.g, gammaColor.b);
    });
    
    gammaPointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gammaPointsPositions, 3));
    gammaPointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(gammaPointsColors, 3));
    
    const gammaPointsMaterial = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      sizeAttenuation: true
    });
    
    gammaOverlayMesh = new THREE.Points(gammaPointsGeometry, gammaPointsMaterial);
    scene.add(gammaOverlayMesh);
    
    // Add a label for gamma
    if (state.showLabels) {
      const gammaLabel = createTextLabel('Gamma (point size)', 
          new THREE.Vector3(minStrike, -20, minDays));
      labelGroup.add(gammaLabel);
    }
  } else if (state.gammaDisplayMode === 'lines') {
    // Create vertical lines for gamma
    const gammaLinesGeometry = new THREE.BufferGeometry();
    const gammaLinesPositions = [];
    const gammaLinesColors = [];
    
    data.forEach(item => {
      if (item.gamma === undefined) return;
      
      const x = transformStrike(item.strike);
      const z = item.daysToExpiry;
      const gammaHeight = (item.gamma / maxGamma) * 50; // Scale gamma for visibility
      
      // Create a vertical line
      gammaLinesPositions.push(x, 0, z); // Base
      gammaLinesPositions.push(x, gammaHeight, z); // Top
      
      // Color based on gamma
      const normalizedGamma = item.gamma / maxGamma;
      const gammaColor = new THREE.Color();
      gammaColor.setHSL(0.3 - normalizedGamma * 0.3, 1.0, 0.5); // Green to red
      
      gammaLinesColors.push(0, 1, 0); // Base color (green)
      gammaLinesColors.push(gammaColor.r, gammaColor.g, gammaColor.b); // Top color
    });
    
    gammaLinesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gammaLinesPositions, 3));
    gammaLinesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(gammaLinesColors, 3));
    
    const gammaLinesMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 1
    });
    
    gammaOverlayMesh = new THREE.LineSegments(gammaLinesGeometry, gammaLinesMaterial);
    scene.add(gammaOverlayMesh);
    
    // Add a label for gamma
    if (state.showLabels) {
      const gammaLabel = createTextLabel('Gamma (line height)', 
          new THREE.Vector3(minStrike, 30, minDays));
      labelGroup.add(gammaLabel);
    }
  }
}

// Position camera for optimal view of the surface
function positionCameraForOptimalView(minStrike, maxStrike, minDays, maxDays, maxIVHeight) {
  const centerX = (minStrike + maxStrike) / 2;
  const centerY = maxIVHeight / 2;
  const centerZ = (minDays + maxDays) / 2;
  
  // Position camera at an angle
  const distance = Math.max(maxStrike - minStrike, maxDays - minDays) * 1.5;
  camera.position.set(
    centerX + distance * 0.7,
    distance * 0.7,
    centerZ + distance * 0.7
  );
  
  // Look at center of surface
  controls.target.set(centerX, centerY, centerZ);
  camera.lookAt(centerX, centerY, centerZ);
  controls.update();
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Initialize the application
function init() {
  // Set up resize handling
  window.addEventListener('resize', onWindowResize, false);
  
  // Create grid
  createGrid();
  
  // Create UI dashboard
  createDashboard();
  
  // Fetch initial data
  fetchAndDisplayData();
  
  // Start animation loop
  animate();
}

// Start the application
init();
