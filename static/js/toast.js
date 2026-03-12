// ============================================================
// TOAST NOTIFICATION SYSTEM
// Auto-dismissing toast notifications with success, error, warning, info variants.
// Usage: Toast.success('Message'), Toast.error('Message'), etc.
// ============================================================
const Toast = (function() {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText =
        'position:fixed; top:20px; right:20px; z-index:9999; ' +
        'display:flex; flex-direction:column; gap:10px; max-width:380px; width:100%;';
      document.body.appendChild(container);
    }
    return container;
  }

  const ICONS = {
    success: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    error:   '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:    '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  const COLORS = {
    success: { bg: '#ECFDF5', border: '#6EE7B7', text: '#065F46', icon: '#059669' },
    error:   { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', icon: '#DC2626' },
    warning: { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', icon: '#D97706' },
    info:    { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', icon: '#2563EB' },
  };

  function show(message, type, duration) {
    duration = duration || 4000;
    const c = COLORS[type] || COLORS.info;
    const el = document.createElement('div');
    el.style.cssText =
      `background:${c.bg}; border:1px solid ${c.border}; color:${c.text}; ` +
      'padding:12px 16px; border-radius:10px; display:flex; align-items:flex-start; gap:10px; ' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.08); font-size:14px; line-height:1.4; ' +
      'transform:translateX(120%); transition:transform 0.3s ease, opacity 0.3s ease; opacity:0;';

    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = `color:${c.icon}; flex-shrink:0; margin-top:1px;`;
    iconSpan.innerHTML = ICONS[type] || ICONS.info;

    const textSpan = document.createElement('span');
    textSpan.style.flex = '1';
    textSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText =
      `color:${c.text}; opacity:0.5; background:none; border:none; ` +
      'cursor:pointer; font-size:18px; line-height:1; padding:0; flex-shrink:0;';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function() { dismiss(el); };

    el.appendChild(iconSpan);
    el.appendChild(textSpan);
    el.appendChild(closeBtn);
    getContainer().appendChild(el);

    // Animate in
    requestAnimationFrame(function() {
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    });

    // Auto dismiss
    const timer = setTimeout(function() { dismiss(el); }, duration);
    el._timer = timer;
  }

  function dismiss(el) {
    if (el._dismissed) return;
    el._dismissed = true;
    clearTimeout(el._timer);
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(function() { el.remove(); }, 300);
  }

  return {
    success: function(msg, dur) { show(msg, 'success', dur); },
    error:   function(msg, dur) { show(msg, 'error', dur); },
    warning: function(msg, dur) { show(msg, 'warning', dur); },
    info:    function(msg, dur) { show(msg, 'info', dur); },
  };
})();

// ============================================================
// AUTO-CONVERT FLASK FLASH MESSAGES TO TOASTS
// Looks for #flash-messages data element injected by base.html
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  const flashEl = document.getElementById('flash-data');
  if (flashEl) {
    try {
      const messages = JSON.parse(flashEl.textContent);
      messages.forEach(function(m) {
        const type = ({ success:'success', danger:'error', error:'error',
                        warning:'warning', info:'info' })[m.category] || 'info';
        Toast[type](m.message, 5000);
      });
    } catch(e) {}
  }
});
