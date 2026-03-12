(function () {
  var CSS_URL = "/api/chatbot/static/chatbot.css";

  var QUICK_ACTIONS = [
    "Help with my booking",
    "I want a refund",
    "Find a tutor",
    "Trouble signing up",
    "Talk to a human",
  ];

  var state = {
    isOpen: sessionStorage.getItem("tw-chatbot-open") === "true",
    conversationId: null,
    messages: [],
    isLoading: false,
    isEscalated: false,
    hasUnread: false,
  };

  var els = {};

  function loadCSS() {
    if (document.querySelector('link[href="' + CSS_URL + '"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : "";
  }

  function api(path, opts) {
    opts = opts || {};
    return fetch("/api/chatbot" + path, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken(),
      },
      method: opts.method || "GET",
      body: opts.body || undefined,
    }).then(function (res) {
      if (!res.ok) throw new Error("API " + res.status);
      return res.json();
    });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatMessage(text) {
    var safe = escapeHtml(text);
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\n/g, "<br>");
    return safe;
  }

  function timeStr(date) {
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function buildDOM() {
    var root = document.createElement("div");
    root.id = "tw-chatbot";
    root.innerHTML =
      // Bubble
      '<button id="tw-chatbot-bubble" aria-label="Open chat"' +
      ' style="position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;' +
      "background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;" +
      'box-shadow:0 4px 12px rgba(0,0,0,.15);border:none;cursor:pointer;z-index:9999;transition:all .2s">' +
      '<i class="fas fa-comment-dots" style="font-size:20px"></i>' +
      '<span id="tw-chatbot-unread" style="display:none;position:absolute;top:-4px;right:-4px;' +
      "width:20px;height:20px;background:#ef4444;border-radius:50%;font-size:11px;font-weight:700;" +
      'color:#fff;align-items:center;justify-content:center">!</span>' +
      "</button>" +
      // Panel
      '<div id="tw-chatbot-panel" class="tw-chatbot-panel" style="position:fixed;bottom:96px;right:24px;' +
      "width:380px;height:560px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.12);" +
      'display:flex;flex-direction:column;overflow:hidden;z-index:9999" role="dialog" aria-label="Support Chat">' +
      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;' +
      'background:#2563eb;color:#fff;flex-shrink:0">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<i class="fas fa-robot"></i><span style="font-weight:600;font-size:14px">Support Chat</span></div>' +
      '<div style="display:flex;align-items:center;gap:2px">' +
      // New Chat button
      '<button id="tw-chatbot-newchat" aria-label="New chat" title="New chat" style="width:32px;height:32px;display:flex;' +
      'align-items:center;justify-content:center;border-radius:4px;border:none;background:transparent;' +
      'color:#fff;cursor:pointer;opacity:0.85" onmouseover="this.style.opacity=1;this.style.background=\'rgba(255,255,255,0.15)\'" ' +
      'onmouseout="this.style.opacity=0.85;this.style.background=\'transparent\'"><i class="fas fa-plus" style="font-size:13px"></i></button>' +
      // Minimize button
      '<button id="tw-chatbot-minimize" aria-label="Minimize" style="width:32px;height:32px;display:flex;' +
      'align-items:center;justify-content:center;border-radius:4px;border:none;background:transparent;' +
      'color:#fff;cursor:pointer;opacity:0.85" onmouseover="this.style.opacity=1;this.style.background=\'rgba(255,255,255,0.15)\'" ' +
      'onmouseout="this.style.opacity=0.85;this.style.background=\'transparent\'"><i class="fas fa-chevron-down" style="font-size:13px"></i></button>' +
      // Close button
      '<button id="tw-chatbot-close" aria-label="Close" style="width:32px;height:32px;display:flex;' +
      'align-items:center;justify-content:center;border-radius:4px;border:none;background:transparent;' +
      'color:#fff;cursor:pointer;opacity:0.85" onmouseover="this.style.opacity=1;this.style.background=\'rgba(255,255,255,0.15)\'" ' +
      'onmouseout="this.style.opacity=0.85;this.style.background=\'transparent\'"><i class="fas fa-times" style="font-size:13px"></i></button>' +
      "</div></div>" +
      // Escalation banner
      '<div id="tw-chatbot-escalation" style="display:none;padding:8px 16px;background:#fef3c7;' +
      'border-bottom:1px solid #fcd34d;color:#92400e;font-size:12px;flex-shrink:0">' +
      "This conversation has been escalated to our support team.</div>" +
      // Messages area
      '<div id="tw-chatbot-messages" class="tw-chatbot-messages" style="flex:1;overflow-y:auto;' +
      'padding:12px 16px" role="log" aria-live="polite"></div>' +
      // Quick actions
      '<div id="tw-chatbot-quick" style="padding:0 16px 8px;display:flex;flex-wrap:wrap;gap:8px"></div>' +
      // Input bar
      '<div style="display:flex;align-items:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e5e7eb;flex-shrink:0">' +
      '<textarea id="tw-chatbot-input" rows="1" placeholder="Type your message..."' +
      ' style="flex:1;resize:none;border-radius:8px;border:1px solid #d1d5db;padding:8px 12px;' +
      'font-size:14px;max-height:96px;overflow-y:auto;outline:none;font-family:inherit" aria-label="Chat message"></textarea>' +
      '<button id="tw-chatbot-send" aria-label="Send" style="width:36px;height:36px;display:flex;' +
      "align-items:center;justify-content:center;border-radius:8px;background:#2563eb;color:#fff;" +
      'border:none;cursor:pointer;flex-shrink:0"><i class="fas fa-paper-plane" style="font-size:13px"></i></button>' +
      "</div></div>";
    document.body.appendChild(root);

    els = {
      root: root,
      bubble: root.querySelector("#tw-chatbot-bubble"),
      unread: root.querySelector("#tw-chatbot-unread"),
      panel: root.querySelector("#tw-chatbot-panel"),
      newchat: root.querySelector("#tw-chatbot-newchat"),
      minimize: root.querySelector("#tw-chatbot-minimize"),
      close: root.querySelector("#tw-chatbot-close"),
      messages: root.querySelector("#tw-chatbot-messages"),
      quick: root.querySelector("#tw-chatbot-quick"),
      input: root.querySelector("#tw-chatbot-input"),
      send: root.querySelector("#tw-chatbot-send"),
      escalation: root.querySelector("#tw-chatbot-escalation"),
    };
  }

  function renderQuickActions() {
    if (state.messages.length > 0) {
      els.quick.style.display = "none";
      return;
    }
    els.quick.style.display = "flex";
    els.quick.innerHTML = QUICK_ACTIONS.map(function (text) {
      return (
        '<button class="tw-chatbot-chip" style="padding:6px 12px;font-size:12px;border-radius:9999px;' +
        'border:1px solid #93c5fd;color:#2563eb;background:#eff6ff;cursor:pointer">' +
        escapeHtml(text) +
        "</button>"
      );
    }).join("");
    els.quick.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        sendMessage(btn.textContent);
      });
    });
  }

  function addMessageEl(msg) {
    var isUser = msg.role === "user";
    var div = document.createElement("div");
    div.className = "tw-chatbot-message";
    div.style.cssText =
      "display:flex;" +
      (isUser ? "justify-content:flex-end" : "justify-content:flex-start") +
      ";margin-bottom:12px";
    div.innerHTML =
      '<div style="max-width:80%">' +
      '<div style="' +
      (isUser
        ? "background:#2563eb;color:#fff;border-radius:16px 16px 4px 16px"
        : "background:#f3f4f6;color:#1f2937;border-radius:16px 16px 16px 4px") +
      ';padding:8px 14px;font-size:14px;line-height:1.5">' +
      formatMessage(msg.content) +
      "</div>" +
      '<div style="font-size:10px;color:#9ca3af;margin-top:4px;' +
      (isUser ? "text-align:right" : "text-align:left") +
      ';padding:0 4px">' +
      timeStr(msg.created_at) +
      "</div></div>";
    els.messages.appendChild(div);
  }

  function renderMessages() {
    els.messages.innerHTML = "";
    state.messages.forEach(addMessageEl);
    scrollBottom();
  }

  function showTyping() {
    var div = document.createElement("div");
    div.id = "tw-chatbot-typing";
    div.className = "tw-chatbot-message";
    div.style.cssText = "display:flex;justify-content:flex-start;margin-bottom:12px";
    div.innerHTML =
      '<div style="background:#f3f4f6;border-radius:16px 16px 16px 4px;padding:12px 16px">' +
      '<div class="tw-chatbot-typing" style="display:flex;gap:4px">' +
      "<span></span><span></span><span></span></div></div>";
    els.messages.appendChild(div);
    scrollBottom();
  }

  function hideTyping() {
    var t = document.getElementById("tw-chatbot-typing");
    if (t) t.remove();
  }

  function scrollBottom() {
    requestAnimationFrame(function () {
      els.messages.scrollTop = els.messages.scrollHeight;
    });
  }

  function setLoading(val) {
    state.isLoading = val;
    els.input.disabled = val;
    els.send.disabled = val;
    els.send.style.opacity = val ? "0.5" : "1";
    if (val) showTyping();
    else hideTyping();
  }

  function togglePanel(open) {
    state.isOpen = open;
    sessionStorage.setItem("tw-chatbot-open", open);
    if (open) {
      els.panel.classList.add("open");
      state.hasUnread = false;
      els.unread.style.display = "none";
      requestAnimationFrame(function () {
        els.input.focus();
      });
    } else {
      els.panel.classList.remove("open");
    }
  }

  function updateEscalation() {
    els.escalation.style.display = state.isEscalated ? "block" : "none";
  }

  function notifyUnread() {
    if (!state.isOpen) {
      state.hasUnread = true;
      els.unread.style.display = "flex";
    }
  }

  function newChat() {
    // Resolve the current conversation if one exists
    if (state.conversationId) {
      api("/conversations/" + state.conversationId + "/resolve", {
        method: "PATCH",
        body: JSON.stringify({}),
      }).catch(function () {});
    }
    // Reset state
    state.conversationId = null;
    state.messages = [];
    state.isEscalated = false;
    updateEscalation();
    renderMessages();
    renderQuickActions();
    els.input.value = "";
    els.input.focus();
  }

  function loadConversation() {
    api("/conversations/active")
      .then(function (data) {
        if (data && data.id) {
          state.conversationId = data.id;
          state.messages = data.messages || [];
          state.isEscalated = data.status === "escalated";
          updateEscalation();
          renderMessages();
          renderQuickActions();
        }
      })
      .catch(function () {});
  }

  function startConversation() {
    return api("/conversations", {
      method: "POST",
      body: JSON.stringify({}),
    }).then(function (data) {
      state.conversationId = data.id;
      return data;
    });
  }

  function sendMessage(text) {
    if (!text.trim() || state.isLoading) return;

    var p = state.conversationId ? Promise.resolve() : startConversation();

    p.then(function () {
      var userMsg = {
        role: "user",
        content: text.trim(),
        created_at: new Date().toISOString(),
      };
      state.messages.push(userMsg);
      addMessageEl(userMsg);
      renderQuickActions();
      scrollBottom();
      els.input.value = "";
      autoResize();

      setLoading(true);
      return api("/conversations/" + state.conversationId + "/messages", {
        method: "POST",
        body: JSON.stringify({ content: text.trim() }),
      });
    })
      .then(function (data) {
        if (data && data.reply) {
          var botMsg = {
            role: "assistant",
            content: data.reply.content || data.reply,
            created_at: data.reply.created_at || new Date().toISOString(),
          };
          state.messages.push(botMsg);
          addMessageEl(botMsg);
          notifyUnread();
          scrollBottom();
        }
        if (data && data.status === "escalated") {
          state.isEscalated = true;
          updateEscalation();
        }
      })
      .catch(function () {
        var errMsg = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        };
        state.messages.push(errMsg);
        addMessageEl(errMsg);
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function autoResize() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 96) + "px";
  }

  function applyMobileStyles() {
    if (window.innerWidth < 768) {
      els.panel.style.bottom = "0";
      els.panel.style.right = "0";
      els.panel.style.width = "100%";
      els.panel.style.height = "100%";
      els.panel.style.borderRadius = "0";
      if (state.isOpen) els.bubble.style.display = "none";
    } else {
      els.panel.style.bottom = "96px";
      els.panel.style.right = "24px";
      els.panel.style.width = "380px";
      els.panel.style.height = "560px";
      els.panel.style.borderRadius = "12px";
      els.bubble.style.display = "flex";
    }
  }

  function bindEvents() {
    els.bubble.addEventListener("click", function () {
      togglePanel(!state.isOpen);
      applyMobileStyles();
    });
    els.newchat.addEventListener("click", newChat);
    els.minimize.addEventListener("click", function () {
      togglePanel(false);
      els.bubble.style.display = "flex";
    });
    els.close.addEventListener("click", function () {
      togglePanel(false);
      els.bubble.style.display = "flex";
    });
    els.send.addEventListener("click", function () {
      sendMessage(els.input.value);
    });
    els.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(els.input.value);
      }
    });
    els.input.addEventListener("input", autoResize);
    window.addEventListener("resize", applyMobileStyles);
  }

  function init() {
    loadCSS();
    buildDOM();
    bindEvents();
    renderQuickActions();
    applyMobileStyles();
    if (state.isOpen) togglePanel(true);
    loadConversation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
