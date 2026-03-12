// ============================================================
// GLOBAL CSRF TOKEN FOR AJAX REQUESTS
// ============================================================
(function() {
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  if (csrfMeta) {
    const csrfToken = csrfMeta.getAttribute('content');

    // Patch fetch to include CSRF header on same-origin requests
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      options = options || {};
      // Only add CSRF for same-origin non-GET requests
      if (typeof url === 'string' && !url.startsWith('http')) {
        const method = (options.method || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD') {
          options.headers = options.headers || {};
          if (options.headers instanceof Headers) {
            if (!options.headers.has('X-CSRFToken')) {
              options.headers.set('X-CSRFToken', csrfToken);
            }
          } else {
            options.headers['X-CSRFToken'] = options.headers['X-CSRFToken'] || csrfToken;
          }
        }
      }
      return originalFetch.call(this, url, options);
    };

    // Patch XMLHttpRequest for legacy AJAX calls
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method) {
      this._csrfMethod = method;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      if (this._csrfMethod && this._csrfMethod.toUpperCase() !== 'GET'
          && this._csrfMethod.toUpperCase() !== 'HEAD') {
        this.setRequestHeader('X-CSRFToken', csrfToken);
      }
      return originalSend.apply(this, arguments);
    };
  }
})();

// ============================================================
// GUARDIAN FIELD TOGGLE
// If student date of birth makes them under 18, show guardian fields
// ============================================================
document.addEventListener('DOMContentLoaded', function() {

  const dobField = document.getElementById('dobField');
  const guardianSection = document.getElementById('guardianSection');
  const guardianName = document.getElementById('guardianName');
  const guardianEmail = document.getElementById('guardianEmail');

  if (dobField && guardianSection) {
    dobField.addEventListener('change', function() {
      const dob = new Date(this.value);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      if (age < 18) {
        guardianSection.classList.remove('hidden');
        guardianName.setAttribute('required', '');
        guardianEmail.setAttribute('required', '');
      } else {
        guardianSection.classList.add('hidden');
        guardianName.removeAttribute('required');
        guardianEmail.removeAttribute('required');
      }
    });
  }

  // ============================================================
  // MOBILE MENU TOGGLE
  // ============================================================
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', function() {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // ============================================================
  // SIGN UP DROPDOWN: Close when clicking outside
  // ============================================================
  document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('signupDropdown');
    const menu = document.getElementById('signupMenu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  // ============================================================
  // LOADING STATE ON FORM SUBMIT
  // ============================================================
  document.querySelectorAll('form').forEach(function(form) {
    form.addEventListener('submit', function() {
      var btn = form.querySelector('button[type="submit"]');
      if (!btn || btn.dataset.noLoading) return;
      btn.disabled = true;
      btn.dataset.origText = btn.innerHTML;
      btn.innerHTML =
        '<svg class="animate-spin inline-block w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">' +
        '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>' +
        '</svg>Processing...';
      setTimeout(function() {
        btn.disabled = false;
        if (btn.dataset.origText) btn.innerHTML = btn.dataset.origText;
      }, 8000);
    });
  });

  // ============================================================
  // CLIENT-SIDE PASSWORD & EMAIL VALIDATION
  // ============================================================
  var pwField = document.querySelector('input[name="password"]');
  var confirmField = document.querySelector('input[name="confirm_password"]');

  if (pwField && confirmField) {
    var feedback = document.createElement('div');
    feedback.style.cssText = 'font-size:12px; margin-top:4px; line-height:1.6;';
    pwField.parentNode.appendChild(feedback);

    function checkPw() {
      var pw = pwField.value;
      if (!pw) { feedback.innerHTML = ''; return; }
      var checks = [
        { ok: pw.length >= 12, label: '12+ characters' },
        { ok: /[A-Z]/.test(pw), label: 'Uppercase letter' },
        { ok: /[0-9]/.test(pw), label: 'Number' },
        { ok: /[!@#$%^&*()_\-+=\[\]{};:\'",.<>?/\\|`~]/.test(pw), label: 'Special character' },
      ];
      feedback.innerHTML = checks.map(function(c) {
        return '<span style="color:' + (c.ok ? '#059669' : '#DC2626') + ';">' +
               (c.ok ? '&#10003;' : '&#10007;') + ' ' + c.label + '</span>';
      }).join('&nbsp;&nbsp;');
    }
    pwField.addEventListener('input', checkPw);

    var matchEl = document.createElement('div');
    matchEl.style.cssText = 'font-size:12px; margin-top:4px;';
    confirmField.parentNode.appendChild(matchEl);
    confirmField.addEventListener('input', function() {
      if (!confirmField.value) { matchEl.innerHTML = ''; return; }
      matchEl.innerHTML = confirmField.value === pwField.value
        ? '<span style="color:#059669;">&#10003; Passwords match</span>'
        : '<span style="color:#DC2626;">&#10007; Passwords do not match</span>';
    });
  }

  var emailField = document.querySelector('input[name="email"]');
  if (emailField) {
    emailField.addEventListener('blur', function() {
      var v = emailField.value.trim();
      var existing = emailField.parentNode.querySelector('.email-err');
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        emailField.style.borderColor = '#DC2626';
        if (!existing) {
          var errEl = document.createElement('p');
          errEl.className = 'email-err';
          errEl.style.cssText = 'color:#DC2626; font-size:12px; margin-top:2px;';
          errEl.textContent = 'Please enter a valid email address.';
          emailField.parentNode.insertBefore(errEl, emailField.nextSibling);
        }
      } else {
        emailField.style.borderColor = '';
        if (existing) existing.remove();
      }
    });
  }
});
