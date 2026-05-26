import { previewURL } from './api.js';

let currentFileId = '';
let currentStart = 0;
let currentEnd = 0;
let currentPage = 0;

const modal = document.getElementById('previewModal');
const image = document.getElementById('previewImage');
const label = document.getElementById('previewLabel');
const indicator = document.getElementById('previewIndicator');
const jumpInput = document.getElementById('previewJumpInput');

export function initPreview() {
  document.getElementById('btnClosePreview').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  document.getElementById('btnPrevPage').addEventListener('click', prevPage);
  document.getElementById('btnNextPage').addEventListener('click', nextPage);
  document.getElementById('btnJumpPage').addEventListener('click', jumpTo);

  jumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jumpTo();
  });

  document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prevPage();
    if (e.key === 'ArrowRight') nextPage();
  });
}

export function showPreview(fileId, start, end) {
  currentFileId = fileId;
  currentStart = start;
  currentEnd = end;
  currentPage = start;
  jumpInput.min = start;
  jumpInput.max = end;
  jumpInput.value = start;
  modal.classList.remove('hidden');
  label.textContent = `第 ${start}-${end} 页`;
  loadPage();
}

function close() {
  modal.classList.add('hidden');
  image.src = '';
}

function prevPage() {
  if (currentPage > currentStart) {
    currentPage--;
    loadPage();
  }
}

function nextPage() {
  if (currentPage < currentEnd) {
    currentPage++;
    loadPage();
  }
}

function jumpTo() {
  const target = parseInt(jumpInput.value, 10);
  if (isNaN(target) || target < currentStart || target > currentEnd) {
    jumpInput.value = currentPage;
    return;
  }
  currentPage = target;
  loadPage();
}

function loadPage() {
  indicator.textContent = `${currentPage} / ${currentStart}-${currentEnd}`;
  jumpInput.value = currentPage;
  image.src = previewURL(currentFileId, currentPage);
}
