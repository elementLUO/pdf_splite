const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    throw new Error(data.message || '请求失败');
  }
  return data.data;
}

export async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  return request(`${BASE}/upload`, { method: 'POST', body: form });
}

export async function suggestRanges(fileId, parts) {
  return request(`${BASE}/suggest-ranges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, parts }),
  });
}

export async function splitPDF(fileId, ranges) {
  return request(`${BASE}/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, ranges }),
  });
}

export function previewURL(fileId, page) {
  return `${BASE}/preview/${fileId}/${page}`;
}

export function downloadURL(fileId, index) {
  return `${BASE}/download/${fileId}/${index}`;
}

export function downloadZipURL(fileId) {
  return `${BASE}/download/${fileId}/zip`;
}
