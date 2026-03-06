// Add k value to requests
document.body.addEventListener('htmx:configRequest', (event) => {
  const k = document.getElementById('k-value').value;
  event.detail.parameters.k = k;
});

// Auto-scroll conversation
const conversation = document.getElementById('conversation');
const observer = new MutationObserver(() => {
  conversation.scrollTop = conversation.scrollHeight;
});
observer.observe(conversation, { childList: true, subtree: true });

// Form disable/enable functions
function disableForm() {
  const input = document.getElementById('question-input');
  const button = document.getElementById('submit-btn');
  if (input) input.disabled = true;
  if (button) button.disabled = true;
}

function enableForm() {
  const input = document.getElementById('question-input');
  const button = document.getElementById('submit-btn');
  if (input) input.disabled = false;
  if (button) button.disabled = false;
  if (input) input.focus();
}

// Make functions global so HTMX can call them
window.disableForm = disableForm;
window.enableForm = enableForm;