let timer = 0;

export function showToast(message, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast toast-${type}`;
  el.classList.remove('hidden');
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.classList.add('hidden');
  }, 2500);
}
