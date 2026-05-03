(function(w, d) {
  // Ultra-strong singleton guard
  if (w.__btchat_loaded) return;
  if (w.__btchat_initializing) return;
  w.__btchat_initializing = true;

  // Cleanup potential stale elements
  if (d.getElementById('btchat-widget-root')) {
    d.getElementById('btchat-widget-root').remove();
  }

  var script = d.currentScript || d.querySelector('script[data-site-id]');
  var siteId = script?.getAttribute('data-site-id');
  var mode = script?.getAttribute('data-mode') || 'floating'; 
  var theme = script?.getAttribute('data-theme') || 'blue-light';
  var primaryColor = script?.getAttribute('data-primary-color') || '#2563eb';
  
  if (!siteId) {
    console.warn('[bt-chat] Missing data-site-id. Widget will not load.');
    return;
  }

  var sessionId;
  try {
    sessionId = w.localStorage.getItem('bt-chat-sid') || (Math.random().toString(36).slice(2) + Date.now().toString(36));
    w.localStorage.setItem('bt-chat-sid', sessionId);
  } catch(e) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  var scriptSrc = script?.src;
  var _cdnHosts = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.'];
  var _isCdn = scriptSrc && _cdnHosts.some(function(h) { return scriptSrc.includes(h); });
  var BASE = (!scriptSrc || _isCdn) ? 'https://btchatai.vercel.app' : new URL(scriptSrc).origin;

  fetch(BASE + '/api/widget/site-info?apiKey=' + siteId)
    .then(r => r.json())
    .then(data => {
      // console.log('[bt-chat] Config synced:', data);
      if (data.agentName) w.__btchat_agent_name = data.agentName;
      if (data.agentAvatar) w.__btchat_agent_avatar = data.agentAvatar;
      if (typeof w.__btchat_apply_branding === 'function') w.__btchat_apply_branding();
      if (data.primaryColor || data.theme) {
        var themeColor = data.primaryColor;
        if (!themeColor && data.theme) {
          var presets = {
            'blue-light': '#2563eb', 'blue-dark': '#1e40af',
            'purple-light': '#9333ea', 'purple-dark': '#6b21a8',
            'green-light': '#16a34a', 'green-dark': '#15803d',
            'pink-light': '#ec4899', 'pink-dark': '#be185d'
          };
          themeColor = presets[data.theme];
        }
        if (themeColor) {
          w.__btchat_primary_color = themeColor;
          // Apply to button if exists
          var bubble = d.querySelector('#btchat-widget-root button');
          if (bubble) bubble.style.backgroundColor = themeColor;
        }
        if (data.theme) {
          w.__btchat_theme = data.theme;
          // NOTE: iframe is NOT reloaded here. Reloading f.src aborts in-flight
          // fetches inside the iframe (e.g. /api/chat/sync), causing TypeError:
          // Failed to fetch. The ChatWidget inside the iframe fetches site-info
          // independently and updates its own theme state.
        }
      }
    }).catch(function(err) { console.warn('[bt-chat] config fetch failed', err); });

  function _init() {
  var startTime = Date.now();


  // Create container (remove stale one if exists)
  var existing = d.getElementById('btchat-widget-root');
  if (existing) existing.remove();
  var container = d.createElement('div');
  container.id = 'btchat-widget-root';
  var positionStyle = mode === 'bottom'
    ? 'position: relative; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 10px 0;'
    : mode === 'fixed'
    ? 'position: fixed; bottom: 20px; left: 20px; width: auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 10; pointer-events: auto;'
    : 'position: fixed; bottom: 20px; right: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 10; pointer-events: auto;';
  container.style.cssText = positionStyle;
  
  if (mode === 'bottom' && script && script.parentNode && script.parentNode.tagName !== 'HEAD') {
    script.parentNode.insertBefore(container, script);
  } else {
    d.body.appendChild(container);
  }

  // Create icon button
  var btn = d.createElement('button');
  var initialColor = w.__btchat_primary_color || primaryColor;
  var btnStyle = 'width: 56px; height: 56px; border-radius: 50%; background: ' + initialColor + '; border: none; color: white; font-size: 28px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.3s; overflow: hidden; padding: 0; display: flex; align-items: center; justify-content: center;';
  btn.style.cssText = btnStyle;

  // Tooltip element (hover label)
  var tooltipEl = d.createElement('div');
  var tooltipAnchor = mode === 'fixed'
    ? 'left: 0; right: auto;'
    : mode === 'bottom'
    ? 'left: 50%; transform: translateX(-50%);'
    : 'right: 0; left: auto;';
  tooltipEl.style.cssText = 'position: absolute; bottom: 70px; ' + tooltipAnchor + ' background: #1f2937; color: white; padding: 8px 12px; border-radius: 8px; font-size: 13px; line-height: 1.3; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.2); opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 12;';
  tooltipEl.textContent = 'Pronto para ajudar';

  function renderBtnContent() {
    if (isOpen) {
      btn.innerHTML = '✕';
      return;
    }
    var avatar = w.__btchat_agent_avatar;
    if (avatar) {
      btn.innerHTML = '';
      var img = d.createElement('img');
      img.src = /^https?:\/\//i.test(avatar) ? avatar : BASE + (avatar.charAt(0) === '/' ? '' : '/') + avatar;
      img.alt = w.__btchat_agent_name || 'Chat';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
      img.onerror = function() { btn.innerHTML = '💬'; };
      btn.appendChild(img);
    } else {
      btn.innerHTML = '💬';
    }
  }

  function updateTooltip() {
    var name = w.__btchat_agent_name;
    tooltipEl.textContent = name
      ? name + ' está pronto para te ajudar'
      : 'Pronto para te ajudar';
  }

  w.__btchat_apply_branding = function() {
    if (!isOpen) renderBtnContent();
    updateTooltip();
  };

  btn.onmouseover = function() {
    this.style.opacity = '0.9';
    this.style.transform = 'scale(1.1)';
    if (!isOpen) {
      tooltipEl.style.opacity = '1';
    }
  };
  btn.onmouseout = function() {
    this.style.opacity = '1';
    this.style.transform = 'scale(1)';
    tooltipEl.style.opacity = '0';
  };

  // Create chat window
  var frame = d.createElement('iframe');
  frame.allow = 'microphone';
  var initialTheme = w.__btchat_theme || theme;
  frame.src = BASE + '/widget?siteApiKey=' + siteId + '&sessionId=' + sessionId + '&theme=' + initialTheme + '&inline=true';
  var frameStyle = mode === 'bottom'
    ? 'position: absolute; bottom: 76px; left: 50%; transform: translateX(-50%); width: 450px; height: 550px; border: none; border-radius: 12px; box-shadow: 0 5px 40px rgba(0,0,0,0.16); display: none; z-index: 1000; pointer-events: auto;'
    : mode === 'fixed'
    ? 'position: fixed; bottom: 90px; left: 20px; width: 400px; height: 500px; border: none; border-radius: 12px; box-shadow: 0 5px 40px rgba(0,0,0,0.16); display: none; z-index: 11; pointer-events: auto;'
    : 'position: fixed; bottom: 90px; right: 20px; width: 400px; height: 500px; border: none; border-radius: 12px; box-shadow: 0 5px 40px rgba(0,0,0,0.16); display: none; z-index: 11; pointer-events: auto;';
  frame.style.cssText = frameStyle;

  var isOpen = false;
  var chatOpenSent = false;
  renderBtnContent();
  updateTooltip();
  btn.onclick = function() {
    isOpen = !isOpen;
    frame.style.display = isOpen ? 'block' : 'none';
    renderBtnContent();
    if (isOpen) tooltipEl.style.opacity = '0';

    // Sincroniza estado com o iframe
    if (frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'bt-chat-set-open', isOpen: isOpen }, '*');
    }

    // Registra abertura do chat (só na primeira vez)
    if (isOpen && !chatOpenSent) {
      chatOpenSent = true;
      fetch(BASE + '/api/widget/chat-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: siteId,
          sessionId: sessionId,
          pageUrl: w.location.href
        })
      }).catch(function() {});
    }
  };

  container.appendChild(btn);
  container.appendChild(tooltipEl);
  container.appendChild(frame);

  // Re-sync after append just in case fetch resolved during creation
  if (w.__btchat_primary_color) btn.style.backgroundColor = w.__btchat_primary_color;
  if (w.__btchat_agent_avatar || w.__btchat_agent_name) w.__btchat_apply_branding();
  if (w.__btchat_theme && initialTheme !== w.__btchat_theme) {
    var url = new URL(frame.src);
    url.searchParams.set('theme', w.__btchat_theme);
    frame.src = url.toString();
  }

  // Listen for messages from iframe
  w.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'bt-chat-open') {
      if (!isOpen) {
        isOpen = true;
        frame.style.display = 'block';
        renderBtnContent();
        tooltipEl.style.opacity = '0';
      }
    }
    // Iframe reset session (operador encerrou) — atualiza localStorage
    if (event.data && event.data.type === 'bt-chat-reset-session' && event.data.sessionId) {
      try { w.localStorage.setItem('bt-chat-sid', event.data.sessionId); } catch(e) {}
    }
  });

  // Page view tracking (com retry)
  function trackPageView(retries) {
    fetch(BASE + '/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: siteId,
        sessionId: sessionId,
        url: w.location.href,
        title: d.title,
        referrer: d.referrer,
        userAgent: navigator.userAgent,
        screenWidth: w.screen.width,
        screenHeight: w.screen.height,
        language: navigator.language
      })
    }).then(function(r) {
      if (!r.ok) {
        console.warn('[bt-chat] track failed', r.status);
        if (retries > 0 && r.status >= 500) {
          setTimeout(function() { trackPageView(retries - 1); }, 1500);
        }
      }
    }).catch(function(err) {
      console.warn('[bt-chat] track network error', err);
      if (retries > 0) {
        setTimeout(function() { trackPageView(retries - 1); }, 1500);
      }
    });
  }
  trackPageView(2);

  // Exit event tracking
  w.addEventListener('visibilitychange', function() {
    if (d.visibilityState === 'hidden') {
      navigator.sendBeacon(BASE + '/api/track/exit', JSON.stringify({
        siteId: siteId,
        sessionId: sessionId,
        url: w.location.href,
        timeOnPage: Math.floor((Date.now() - startTime) / 1000)
      }));
    }
  });

  w.__btchat_loaded = true;
  delete w.__btchat_initializing;

  // FINAL LOG: only once
  console.log('BTChat widget initialized successfully - version: 1.0.6');
  } // end _init

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})(window, document);
