import { mkdirp } from 'mkdirp';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getComponents, exportImages, getFile } from './figma-client.mjs';

function sanitizeFileName(name, stripPrefix, prefix) {
  let fileName = name;
  if (stripPrefix && prefix) {
    fileName = fileName.replace(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
  }
  return fileName
    .toLowerCase()
    .replace(/[\/\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeMonochrome(svg) {
  return svg
    .replace(/<svg([^>]*)>/, (_, attrs) => {
      const clean = attrs.replace(/\s*fill="[^"]*"/g, '');
      return `<svg${clean} fill="currentColor">`;
    })
    .replace(/<(path|circle|rect|line|polygon|polyline)([^>]*?)\s+fill="[^"]*"/g, '<$1$2')
    .replace(/<(path|circle|rect|line|polygon|polyline)([^>]*?)\s+stroke="[^"]*"/g, '<$1$2');
}

export async function exportIcons(config, client) {
  const { fileKey, icons: iconConfig } = config;
  if (!iconConfig.enabled) {
    console.log('Icon export disabled in config. Skipping.');
    return;
  }

  console.log('Fetching components from Figma...');
  const components = await getComponents(fileKey);
  console.log(`Found ${components.length} total components`);

  let iconComponents;
  if (iconConfig.componentIds && iconConfig.componentIds.length > 0) {
    iconComponents = components.filter(c => iconConfig.componentIds.includes(c.node_id));
  } else if (iconConfig.namePrefix) {
    iconComponents = components.filter(c => c.name.startsWith(iconConfig.namePrefix));
  } else if (iconConfig.sourcePage) {
    const fileData = await getFile(fileKey, 1);
    const page = fileData.document.children.find(
      c => c.type === 'CANVAS' && c.name === iconConfig.sourcePage
    );
    if (!page) throw new Error(`Page "${iconConfig.sourcePage}" not found in Figma file`);
    const pageChildIds = new Set(page.children.map(c => c.id));
    iconComponents = components.filter(c => pageChildIds.has(c.node_id));
  } else {
    console.log('No icon filter configured (componentIds, namePrefix, or sourcePage). Skipping icon export.');
    return;
  }

  console.log(`Matched ${iconComponents.length} icon components`);

  if (iconComponents.length === 0) return;

  const nodeIds = iconComponents.map(c => c.node_id);
  const imageUrls = await exportImages(fileKey, nodeIds, iconConfig.format, iconConfig.scale);

  await mkdirp(iconConfig.outputDir);

  for (const comp of iconComponents) {
    const url = imageUrls[comp.node_id];
    if (!url) {
      console.warn(`  No export URL for ${comp.name}, skipping`);
      continue;
    }

    const fileName = sanitizeFileName(comp.name, iconConfig.stripPrefix, iconConfig.namePrefix);
    const svgContent = await fetch(url).then(r => r.text());

    const finalSvg = iconConfig.monochrome ? makeMonochrome(svgContent) : svgContent;

    const filePath = path.join(iconConfig.outputDir, `${fileName}.svg`);
    await writeFile(filePath, finalSvg, 'utf-8');
    console.log(`  Exported: ${fileName}.svg`);
  }

  console.log(`Exported ${iconComponents.length} icons to ${iconConfig.outputDir}`);
}
