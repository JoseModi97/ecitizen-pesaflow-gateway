#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Attempt to load from dist (production build) first
const distCli = path.join(__dirname, '../dist/cli/index.cjs');
const distCliJs = path.join(__dirname, '../dist/cli/index.js');

if (fs.existsSync(distCli)) {
  require(distCli).runCli();
} else if (fs.existsSync(distCliJs)) {
  require(distCliJs).runCli();
} else {
  // If not built yet, run through the build script or direct fallback
  console.log('\x1b[33mBuilding ecitizen-pesaflow-gateway...\x1b[0m');
  require('../scripts/build.js');
  require(distCli).runCli();
}
