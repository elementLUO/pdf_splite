import { showToast } from './toast.js';
import { initUpload } from './upload.js';
import { initRanges, setFileInfo, getRanges, addRange, generateEqual, validateAndCollect, renderTable } from './ranges.js';
import { initPreview } from './preview.js';
import { splitPDF, downloadURL, downloadZipURL } from './api.js';

// ── DOM refs ──────────────────────────────────────────
const stepUpload    = document.getElementById('stepUpload');
const uploadZone    = document.getElementById('uploadZone');
const fileInput     = document.getElementById('fileInput');
const fileBadge     = document.getElementById('fileBadge');
const stepConfig    = document.getElementById('stepConfig');
const actionBar     = document.getElementById('actionBar');
const stepResult    = document.getElementById('stepResult');
const resultList    = document.getElementById('resultList');
const panelCustom   = document.getElementById('panelCustom');
const panelEqual    = document.getElementById('panelEqual');
const equalParts    = document.getElementById('equalParts');
const equalNote     = document.getElementById('equalNote');
const splitBtn      = document.getElementById('splitBtn');

let currentFileId = '';
let currentPageCount = 0;

// ── Init ──────────────────────────────────────────────
initPreview();
initUpload({
  zone: uploadZone,
  input: fileInput,
  browseBtn: document.getElementById('btnBrowse'),
  onFileReady: handleFileReady,
});
initRanges({ onUpdate: () => {} });

// ── Upload success ────────────────────────────────────
function handleFileReady(data) {
  currentFileId = data.file_id;
  currentPageCount = data.page_count;

  // Show file badge in step 2 header
  fileBadge.textContent = `${data.original_name} · ${formatSize(data.file_size)} · ${data.page_count}页`;
  setFileInfo(data);

  // Transition: hide upload, show config & action bar
  stepUpload.style.display = 'none';
  stepConfig.style.display = '';
  actionBar.style.display = '';
}

// ── Mode tabs ─────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const mode = tab.dataset.mode;
    panelCustom.classList.toggle('hidden', mode !== 'custom');
    panelEqual.classList.toggle('hidden', mode !== 'equal');
    if (mode === 'custom') renderTable();
  });
});

// ── Add range ─────────────────────────────────────────
document.getElementById('btnAddRange').addEventListener('click', () => {
  if (!currentFileId) return;
  addRange();
});

// ── Equal generate ────────────────────────────────────
document.getElementById('btnGenerateEqual').addEventListener('click', async () => {
  if (!currentFileId) return;
  const parts = parseInt(equalParts.value, 10);
  await generateEqual(parts);
  equalNote.textContent = `已生成 ${getRanges().length} 个区间`;
  equalNote.classList.remove('hidden');
});

// ── Split ─────────────────────────────────────────────
splitBtn.addEventListener('click', async () => {
  if (!currentFileId) return;

  const ranges = validateAndCollect();
  if (!ranges) return;

  splitBtn.disabled = true;
  splitBtn.innerHTML = '<span class="spinner"></span> 分割中...';

  try {
    const data = await splitPDF(currentFileId, ranges);
    renderResults(data);
    showToast('分割完成', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    splitBtn.disabled = false;
    splitBtn.innerHTML = `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> 执行分割`;
  }
});

// ── Render results ────────────────────────────────────
function renderResults(data) {
  resultList.innerHTML = data.files.map((f) => {
    const err = f.error ? `<span style="color:var(--c-error);font-size:12px;">${esc(f.error)}</span>` : '';
    const meta = [f.pages ? `${f.pages} 页` : '', f.size ? formatSize(f.size) : ''].filter(Boolean).join(' · ');
    return `<div class="result-item">
      <div class="result-icon">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="result-meta">
        <div class="result-name">${esc(f.filename)} ${err}</div>
        <div class="result-size">${meta}</div>
      </div>
      ${f.error ? '' : `<a class="result-dl" href="${downloadURL(currentFileId, f.index)}" download>
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        下载
      </a>`}
    </div>`;
  }).join('');

  if (data.files.some(f => !f.error)) {
    resultList.insertAdjacentHTML('beforeend', `<div class="result-zip">
      <a class="btn btn-primary" href="${downloadZipURL(currentFileId)}" download>
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        打包下载全部
      </a>
    </div>`);
  }

  stepResult.style.display = '';
  stepResult.scrollIntoView({ behavior: 'smooth' });
}

// ── Reset ─────────────────────────────────────────────
document.getElementById('resetBtn').addEventListener('click', () => {
  currentFileId = '';
  currentPageCount = 0;
  fileInput.value = '';
  fileBadge.textContent = '';
  stepUpload.style.display = '';
  stepConfig.style.display = 'none';
  actionBar.style.display = 'none';
  stepResult.style.display = 'none';
  resultList.innerHTML = '';
  document.getElementById('rangeError').classList.add('hidden');
  panelCustom.classList.remove('hidden');
  panelEqual.classList.add('hidden');
  document.querySelector('.tab[data-mode="custom"]').classList.add('active');
  document.querySelector('.tab[data-mode="equal"]').classList.remove('active');
  equalNote.classList.add('hidden');
  splitBtn.disabled = false;
  splitBtn.innerHTML = `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> 执行分割`;
});

// ── Helpers ──────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
