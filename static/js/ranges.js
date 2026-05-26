import { suggestRanges } from './api.js';
import { showPreview } from './preview.js';
import { showToast } from './toast.js';

let pageCount = 0;
let originalName = '';
let fileId = '';
let ranges = [];
let onRangesChange = null;

export function initRanges({ onUpdate }) {
  onRangesChange = onUpdate;
}

export function setFileInfo(info) {
  pageCount = info.page_count;
  originalName = info.original_name;
  fileId = info.file_id;
  ranges = [{ start: 1, end: pageCount, filename: makeFilename(1) }];
  renderTable();
  return ranges;
}

export function getRanges() {
  return ranges;
}

function makeFilename(index) {
  const base = originalName.replace(/\.pdf$/i, '');
  return `${base}_part${index}.pdf`;
}

function readRow(index) {
  const startEl = document.querySelector(`.range-start[data-index="${index}"]`);
  const endEl = document.querySelector(`.range-end[data-index="${index}"]`);
  const nameEl = document.querySelector(`.range-filename[data-index="${index}"]`);
  if (!startEl || !endEl || !nameEl) return null;
  return {
    start: parseInt(startEl.value, 10) || 1,
    end: parseInt(endEl.value, 10) || 1,
    filename: nameEl.value.trim() || makeFilename(index + 1),
  };
}

function collectRanges() {
  const result = [];
  for (let i = 0; i < ranges.length; i++) {
    const row = readRow(i);
    if (row) result.push(row);
  }
  return result;
}

function validateRanges() {
  const data = collectRanges();
  for (let i = 0; i < data.length; i++) {
    const { start, end } = data[i];
    if (start < 1 || end < 1) return `区间 ${i + 1}: 页码必须大于 0`;
    if (start > end) return `区间 ${i + 1}: 起始页不能大于结束页`;
    if (start > pageCount || end > pageCount) return `区间 ${i + 1}: 页码超出范围 (1-${pageCount})`;
    if (i > 0 && start <= data[i - 1].end) return `区间 ${i + 1}: 与上一个区间重叠`;
  }
  return null;
}

export function renderTable() {
  const tbody = document.getElementById('rangeTableBody');
  let html = '';
  ranges.forEach((r, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td><input type="number" class="range-start" data-index="${i}" value="${r.start}" min="1" max="${pageCount}"></td>
      <td><input type="number" class="range-end" data-index="${i}" value="${r.end}" min="1" max="${pageCount}"></td>
      <td><input type="text" class="range-filename" data-index="${i}" value="${escapeHtml(r.filename)}"></td>
      <td>
        <button class="btn btn-outline btn-sm btn-preview" data-index="${i}" title="预览">预览</button>
        <button class="btn-danger btn-sm btn-delete" data-index="${i}" title="删除" ${ranges.length <= 1 ? 'disabled' : ''}>删除</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;

  // Bind events
  tbody.querySelectorAll('.range-start, .range-end').forEach(el => {
    el.addEventListener('input', () => {
      const data = collectRanges();
      data.forEach((r, i) => { ranges[i] = r; });
      clearRangeError();
      onRangesChange?.();
    });
  });
  tbody.querySelectorAll('.range-filename').forEach(el => {
    el.addEventListener('input', () => {
      const data = collectRanges();
      data.forEach((r, i) => { ranges[i] = r; });
    });
  });
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      ranges.splice(idx, 1);
      renderTable();
      onRangesChange?.();
    });
  });
  tbody.querySelectorAll('.btn-preview').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      const r = readRow(idx);
      if (r) showPreview(fileId, r.start, r.end);
    });
  });
}

export function addRange() {
  const last = ranges[ranges.length - 1];
  const start = last ? last.end + 1 : 1;
  const end = Math.min(start, pageCount);
  ranges.push({ start, end, filename: makeFilename(ranges.length + 1) });
  renderTable();
  onRangesChange?.();
}

export async function generateEqual(parts) {
  if (parts < 2) {
    showToast('份数至少为 2', 'error');
    return;
  }
  if (parts > pageCount) {
    showToast(`份数不能超过总页数 (${pageCount})`, 'error');
    return;
  }
  try {
    const data = await suggestRanges(fileId, parts);
    ranges = data.ranges.map((r, i) => ({
      ...r,
      filename: makeFilename(i + 1),
    }));
    renderTable();
    onRangesChange?.();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export function validateAndCollect() {
  const err = validateRanges();
  if (err) {
    showRangeError(err);
    return null;
  }
  return collectRanges();
}

function showRangeError(msg) {
  const el = document.getElementById('rangeError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearRangeError() {
  const el = document.getElementById('rangeError');
  el.classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
