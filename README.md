Options Volatility Surface
Overview
This project visualizes an options volatility surface in a 3D environment using Three.js. It fetches options contract data from the Polygon.io API and generates a dynamic, interactive visualization including the volatility surface, gamma overlays, and an options chain table. An interactive dashboard allows you to customize parameters such as the ticker symbol, expiration range, visualization type, and more.

Features
3D Visualization: Render a dynamic 3D options volatility surface.
Interactive Dashboard: Adjust ticker, expiration range, display type (surface, wireframe, or points), color scheme, and gamma display mode.
Gamma Overlay: Visualize gamma using different modes (plane, points, or lines).
Options Chain Table: View a detailed options chain for the selected symbol.
Responsive Design: Automatically adjusts to your browser window size.
Prerequisites
Node.js (version 18 or higher is recommended)
npm (included with Node.js)
Installation
Clone the repository:
bash
Copy
git clone <repository-url>
cd <repository-directory>
Install dependencies:
bash
Copy
npm install
Running the Application
This project uses Vite for development. To start the development server, run:

bash
Copy
npm run dev
This command will launch the Vite development server and automatically open the application in your default web browser.

Configuration
API Key:
The application fetches options data from Polygon.io. Update the API key in the main.js file by replacing the placeholder with your own API key:
javascript
Copy
const state = {
  currentSymbol: "AAPL",
  expiryRange: 90,
  apiKey: "YOUR_POLYGON_API_KEY", // Replace with your own API key
  // other settings...
};
Visualization Settings:
Customize visualization options (such as color scheme, display type, and gamma mode) via the dashboard embedded in the application.
Project Structure
index.html: The entry point of the web application.
main.js: Contains the Three.js code to create the 3D visualization and interactive dashboard.
package.json: Project metadata and scripts.
vite.config.js: Configuration for the Vite development server.
package-lock.json: Auto-generated file that locks dependency versions.
.gitignore: Specifies files and directories to be ignored by Git.
image.png: (Optional) Project asset.
License
This project is licensed under the ISC License. See the LICENSE file for more details.

Acknowledgments
Three.js
Polygon.io
Vite
