/**
 * TeachWise Notification Center
 * Fetches notifications, renders dropdown, tracks read state via localStorage.
 */
(function () {
  const STORAGE_KEY = 'tw_notif_last_read';
  const bell = document.getElementById('notifBell');
  const dropdown = document.getElementById('notifDropdown');
  const badge = document.getElementById('notifBadge');
  const listEl = document.getElementById('notifList');
  const markReadBtn = document.getElementById('notifMarkRead');

  if (!bell || !dropdown) return;

  let notifications = [];

  // ── Fetch notifications ─────────────────────────────────
  function fetchNotifications() {
    fetch('/api/notifications')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        notifications = data;
        render();
      })
      .catch(function () {
        listEl.innerHTML = '<div class="px-4 py-3 text-sm text-gray-400">Unable to load notifications</div>';
      });
  }

  // ── Render ──────────────────────────────────────────────
  function render() {
    var lastRead = localStorage.getItem(STORAGE_KEY) || '1970-01-01T00:00:00';
    var unread = 0;

    if (notifications.length === 0) {
      listEl.innerHTML = '<div class="px-4 py-6 text-sm text-gray-400 text-center">No notifications</div>';
      badge.classList.add('hidden');
      markReadBtn.classList.add('hidden');
      return;
    }

    var html = '';
    for (var i = 0; i < notifications.length; i++) {
      var n = notifications[i];
      var isUnread = n.timestamp > lastRead;
      if (isUnread) unread++;
      html += notificationItem(n, isUnread);
    }
    listEl.innerHTML = html;

    // Badge
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Mark read button
    if (unread > 0) {
      markReadBtn.classList.remove('hidden');
    } else {
      markReadBtn.classList.add('hidden');
    }
  }

  function notificationItem(n, isUnread) {
    var colorMap = {
      blue: 'text-blue-500 bg-blue-50',
      green: 'text-green-500 bg-green-50',
      orange: 'text-orange-500 bg-orange-50',
      red: 'text-red-500 bg-red-50',
      yellow: 'text-yellow-500 bg-yellow-50'
    };
    var colorClass = colorMap[n.color] || 'text-gray-500 bg-gray-50';
    var bgClass = isUnread ? 'bg-blue-50 bg-opacity-40' : '';

    return '<a href="' + n.url + '" class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 ' + bgClass + '">' +
      '<div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ' + colorClass + '">' +
        '<i class="fas ' + n.icon + ' text-sm"></i>' +
      '</div>' +
      '<div class="flex-1 min-w-0">' +
        '<p class="text-sm font-medium text-gray-800' + (isUnread ? ' font-semibold' : '') + '">' + escapeHtml(n.title) + '</p>' +
        '<p class="text-xs text-gray-500 mt-0.5 truncate">' + escapeHtml(n.message) + '</p>' +
        '<p class="text-xs text-gray-400 mt-1">' + relativeTime(n.timestamp) + '</p>' +
      '</div>' +
      (isUnread ? '<span class="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></span>' : '') +
    '</a>';
  }

  // ── Relative time ───────────────────────────────────────
  function relativeTime(isoStr) {
    var then = new Date(isoStr);
    var now = new Date();
    var diffMs = now - then;
    var diffSec = Math.floor(diffMs / 1000);
    var diffMin = Math.floor(diffSec / 60);
    var diffHr = Math.floor(diffMin / 60);
    var diffDay = Math.floor(diffHr / 24);

    if (diffMs < 0) {
      // Future event
      var fMin = Math.floor(-diffMs / 60000);
      var fHr = Math.floor(fMin / 60);
      if (fHr >= 24) return 'in ' + Math.floor(fHr / 24) + 'd';
      if (fHr >= 1) return 'in ' + fHr + 'h';
      return 'in ' + Math.max(1, fMin) + 'm';
    }

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffHr < 24) return diffHr + 'h ago';
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return diffDay + 'd ago';
    return then.toLocaleDateString();
  }

  // ── Escape HTML ─────────────────────────────────────────
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Toggle dropdown ─────────────────────────────────────
  bell.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  // Close on click outside
  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // ── Mark all read ───────────────────────────────────────
  markReadBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    render();
  });

  // ── Init ────────────────────────────────────────────────
  fetchNotifications();
})();
