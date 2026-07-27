// Compiles src/app.jsx -> app.js (plain JS, no JSX) using Babel.
// Run with:  npm install  &&  npm run build
import { readFileSync, writeFileSync } from 'node:fs';
import { transform } from '@babel/standalone';

const srcUrl = new URL('./src/app.jsx', import.meta.url);
const outUrl = new URL('./app.js', import.meta.url);

const src = readFileSync(srcUrl, 'utf8');
const { code } = transform(src, { presets: ['react'], filename: 'app.jsx', compact: false });

const banner = '// Compiled from src/app.jsx by Babel (preset-react). Do not edit directly — edit src/app.jsx and run `npm run build`.\n';
writeFileSync(outUrl, banner + code, 'utf8');

console.log('Built app.js (' + (banner.length + code.length) + ' bytes)');
