import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as client from './utils/figma-client.mjs';
import { extractTokens } from './utils/token-extractor.mjs';
import { generateCSS } from './utils/css-generator.mjs';
import { exportIcons } from './utils/icon-exporter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const args = process.argv.slice(2);
  const tokensOnly = args.includes('--tokens-only');
  const iconsOnly = args.includes('--icons-only');

  const configPath = path.join(ROOT, 'figma.config.json');
  const config = JSON.parse(await readFile(configPath, 'utf-8'));

  if (!config.fileKey || config.fileKey === 'YOUR_FIGMA_FILE_KEY_HERE') {
    console.error('Error: Please set your Figma file key in figma.config.json');
    process.exit(1);
  }

  if (!process.env.FIGMA_ACCESS_TOKEN) {
    console.error('Error: FIGMA_ACCESS_TOKEN not set. Copy .env.example to .env and add your token.');
    process.exit(1);
  }

  if (!iconsOnly && config.tokens) {
    console.log('\n=== Extracting Design Tokens ===\n');
    const tokens = await extractTokens(config, client);
    const outputPath = path.join(ROOT, config.tokens.output);
    await generateCSS(tokens, outputPath, config);
  }

  if (!tokensOnly && config.icons) {
    console.log('\n=== Exporting Icons ===\n');
    await exportIcons(config, client);
  }

  console.log('\n=== Sync Complete ===\n');
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
