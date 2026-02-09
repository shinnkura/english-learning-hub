/**
 * Icon generation script
 * Creates placeholder PNG icons for the Chrome extension
 *
 * Usage: node scripts/generate-icons.js
 * Note: Requires canvas package: npm install canvas
 */

const fs = require('fs');
const path = require('path');

// Create a simple SVG that can be converted to PNG
// For now, create placeholder files with instructions

const sizes = [16, 32, 48, 128];
const iconDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure directory exists
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Create SVG template
const createSvg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#3B82F6"/>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size * 0.5}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">E</text>
</svg>`;

// Write SVG files (can be used directly or converted to PNG)
sizes.forEach(size => {
  const svgPath = path.join(iconDir, `icon${size}.svg`);
  fs.writeFileSync(svgPath, createSvg(size));
  console.log(`Created ${svgPath}`);
});

// Create a README for the icons
const readme = `# Extension Icons

This directory contains the icons for the Chrome extension.

## Files needed:
- icon16.png (16x16)
- icon32.png (32x32)
- icon48.png (48x48)
- icon128.png (128x128)

## Generating PNG from SVG:
You can use tools like:
- ImageMagick: \`convert icon128.svg icon128.png\`
- Online converters
- Design tools like Figma or Sketch

The SVG files are provided as templates. Convert them to PNG
or create your own custom icons.
`;

fs.writeFileSync(path.join(iconDir, 'README.md'), readme);
console.log('Icon generation complete!');
console.log('Note: Convert SVG files to PNG for production use.');
