import { uploadFile } from './api.js';
import { showToast } from './toast.js';

const MAX_SIZE = 600 * 1024 * 1024; // 600 MB

export function initUpload({
  zone,
  input,
  browseBtn,
  onFileReady,
  onRemove,
}) {
  // Click to browse
  zone.addEventListener('click', () => input.click());
  if (browseBtn) {
    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      input.click();
    });
  }

  // File selected via input
  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      handleFile(input.files[0]);
    }
  });

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  async function handleFile(file) {
    // Validate
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('仅支持 PDF 格式文件', 'error');
      return;
    }
    if (file.size > MAX_SIZE) {
      showToast('文件大小超过 600MB 限制', 'error');
      return;
    }

    try {
      showToast('正在上传...', 'info');
      const data = await uploadFile(file);
      onFileReady(data);
      showToast(`上传成功，共 ${data.page_count} 页`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}
