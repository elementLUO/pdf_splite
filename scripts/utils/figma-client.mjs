const BASE_URL = 'https://api.figma.com/v1';

async function figmaRequest(path) {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error('FIGMA_ACCESS_TOKEN not set in .env');

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
    console.warn(`Rate limited. Waiting ${retryAfter}s...`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return figmaRequest(path);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Figma API ${res.status}: ${body.err || body.message || res.statusText}`);
  }

  return res.json();
}

export async function getStyles(fileKey) {
  return figmaRequest(`/files/${fileKey}/styles`);
}

export async function getComponents(fileKey) {
  const data = await figmaRequest(`/files/${fileKey}/components`);
  return data.meta.components;
}

export async function getFileNodes(fileKey, nodeIds) {
  const ids = nodeIds.join(',');
  return figmaRequest(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`);
}

export async function exportImages(fileKey, nodeIds, format = 'svg', scale = 1) {
  const ids = nodeIds.join(',');
  const data = await figmaRequest(
    `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`
  );
  return data.images;
}

export async function getFile(fileKey, depth) {
  const depthParam = depth ? `?depth=${depth}` : '';
  return figmaRequest(`/files/${fileKey}${depthParam}`);
}
