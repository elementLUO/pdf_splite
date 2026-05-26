function figmaColorToCSS(color, opacity = 1) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = (color.a ?? 1) * opacity;
  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${(Math.round(a * 100) / 100).toFixed(2)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function figmaEffectToCSS(effect) {
  const color = effect.color ? figmaColorToCSS(effect.color) : 'rgba(0,0,0,0.25)';
  const x = effect.offset?.x ?? 0;
  const y = effect.offset?.y ?? 0;
  const radius = effect.radius ?? 0;
  const spread = effect.spread ?? 0;
  if (effect.type === 'DROP_SHADOW') {
    return `${x}px ${y}px ${radius}px ${spread}px ${color}`;
  }
  if (effect.type === 'INNER_SHADOW') {
    return `inset ${x}px ${y}px ${radius}px ${spread}px ${color}`;
  }
  if (effect.type === 'LAYER_BLUR') {
    return `blur(${radius}px)`;
  }
  if (effect.type === 'BACKGROUND_BLUR') {
    return `blur(${radius}px)`;
  }
  return null;
}

function figmaTextToCSSProperties(style) {
  const props = {};
  const ln = (style.lineHeightPxFontSize ?? style.lineHeightPercentFontSize);
  if (style.fontFamily) props.fontFamily = `"${style.fontFamily}", sans-serif`;
  if (style.fontWeight) props.fontWeight = style.fontWeight;
  if (style.fontSize) props.fontSize = `${style.fontSize}px`;
  if (typeof style.lineHeightPx === 'number') {
    props.lineHeight = `${style.lineHeightPx}px`;
  } else if (typeof style.lineHeightPercent === 'number') {
    props.lineHeight = `${style.lineHeightPercent}%`;
  } else if (typeof ln === 'number') {
    props.lineHeight = `${ln}px`;
  } else if (typeof style.lineHeightPercent === 'number') {
    props.lineHeight = `${style.lineHeightPercent}%`;
  }
  if (style.letterSpacing && style.letterSpacing !== 0) {
    props.letterSpacing = `${style.letterSpacing}px`;
  }
  if (style.textDecoration && style.textDecoration !== 'NONE') {
    props.textDecoration = style.textDecoration.toLowerCase();
  }
  if (style.textCase === 'UPPER') props.textTransform = 'uppercase';
  if (style.textCase === 'LOWER') props.textTransform = 'lowercase';
  return props;
}

function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/[\/\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchNodesBatch(client, fileKey, styles) {
  const nodeIds = styles.map(s => s.node_id);
  const BATCH_SIZE = 200;
  const nodesMap = {};

  for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
    const batch = nodeIds.slice(i, i + BATCH_SIZE);
    console.log(`  Fetching node details batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(nodeIds.length / BATCH_SIZE)}...`);
    const data = await client.getFileNodes(fileKey, batch);
    if (data.nodes) {
      Object.assign(nodesMap, data.nodes);
    }
  }
  return nodesMap;
}

async function extractFillTokens(styles, client, fileKey, config) {
  const tokens = [];
  const nodesMap = await fetchNodesBatch(client, fileKey, styles);

  for (const style of styles) {
    const node = nodesMap[style.node_id];
    if (!node || !node.document) continue;

    const sanitizedName = sanitizeName(style.name);

    // Check style property overrides on node
    const styleOverrides = node.document.styleOverrideTable || {};
    const styleIdKey = Object.keys(styleOverrides).find(k => styleOverrides[k].fillPaints);

    // Get fills from the node
    const fills =
      (styleIdKey && styleOverrides[styleIdKey]?.fillPaints) ||
      node.document.fills;

    if (fills && Array.isArray(fills) && fills.length > 0) {
      const fill = fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        const opacity = fill.opacity ?? 1;
        const value = figmaColorToCSS(fill.color, opacity);
        tokens.push({
          category: 'color',
          name: sanitizedName,
          fullName: style.name,
          cssVar: `--${config.tokens.prefix}-color-${sanitizedName}`,
          value,
        });
      } else if (fill.type && fill.type.startsWith('GRADIENT')) {
        console.warn(`  Skipping gradient fill for "${style.name}"`);
      }
    }
  }
  return tokens;
}

async function extractTextTokens(styles, client, fileKey, config) {
  const tokens = [];
  const nodesMap = await fetchNodesBatch(client, fileKey, styles);

  for (const style of styles) {
    const node = nodesMap[style.node_id];
    if (!node || !node.document) continue;

    const textStyle = node.document.style;
    if (!textStyle) continue;

    const sanitizedName = sanitizeName(style.name);
    const properties = figmaTextToCSSProperties(textStyle);

    if (Object.keys(properties).length > 0) {
      tokens.push({
        category: 'typography',
        name: sanitizedName,
        fullName: style.name,
        cssVarPrefix: `--${config.tokens.prefix}-typography-${sanitizedName}`,
        properties,
      });
    }
  }
  return tokens;
}

async function extractEffectTokens(styles, client, fileKey, config) {
  const tokens = [];
  const nodesMap = await fetchNodesBatch(client, fileKey, styles);

  for (const style of styles) {
    const node = nodesMap[style.node_id];
    if (!node || !node.document) continue;

    const effects = node.document.effects;
    if (!effects || !Array.isArray(effects) || effects.length === 0) continue;

    const sanitizedName = sanitizeName(style.name);
    for (const effect of effects) {
      if (!effect.visible && effect.visible !== undefined) continue;
      const cssValue = figmaEffectToCSS(effect);
      if (cssValue) {
        tokens.push({
          category: 'effect',
          name: sanitizedName,
          fullName: style.name,
          cssVar: `--${config.tokens.prefix}-effect-${sanitizedName}`,
          value: cssValue,
        });
        break; // One token per effect style
      }
    }
  }
  return tokens;
}

export async function extractTokens(config, client) {
  const { fileKey, tokens: tokensConfig } = config;
  const tokens = [];

  console.log('Fetching styles from Figma...');
  const stylesData = await client.getStyles(fileKey);
  const styles = stylesData.meta.styles;
  console.log(`Found ${styles.length} styles`);

  const byType = { FILL: [], TEXT: [], EFFECT: [] };
  for (const style of styles) {
    if (byType[style.style_type]) {
      byType[style.style_type].push(style);
    }
  }

  if (tokensConfig.extract.colors && byType.FILL.length > 0) {
    console.log(`\nExtracting ${byType.FILL.length} fill/color styles...`);
    const fillTokens = await extractFillTokens(byType.FILL, client, fileKey, config);
    tokens.push(...fillTokens);
    console.log(`  Extracted ${fillTokens.length} color tokens`);
  }

  if (tokensConfig.extract.typography && byType.TEXT.length > 0) {
    console.log(`\nExtracting ${byType.TEXT.length} text/typography styles...`);
    const textTokens = await extractTextTokens(byType.TEXT, client, fileKey, config);
    tokens.push(...textTokens);
    console.log(`  Extracted ${textTokens.length} typography tokens`);
  }

  if (tokensConfig.extract.effects && byType.EFFECT.length > 0) {
    console.log(`\nExtracting ${byType.EFFECT.length} effect styles...`);
    const effectTokens = await extractEffectTokens(byType.EFFECT, client, fileKey, config);
    tokens.push(...effectTokens);
    console.log(`  Extracted ${effectTokens.length} effect tokens`);
  }

  return tokens;
}
