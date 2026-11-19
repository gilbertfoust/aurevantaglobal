/** Opens an existing, user-facing product destination from a 3D station. */
function reveal(element) {
  if (!element) return false;
  for (let section = element.closest('details'); section; section = section.parentElement?.closest('details')) section.open = true;
  const target = element.matches('a[href],button:enabled,input:enabled,select:enabled,textarea:enabled,[tabindex]')
    ? element : element.querySelector('h1,h2,h3,legend') || element;
  if (!target.matches('a[href],button,input,select,textarea,[tabindex]')) target.tabIndex = -1;
  target.focus?.({ preventScroll: true });
  element.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' });
  return true;
}
function activate(element) {
  if (!element || element.matches(':disabled,[aria-disabled="true"]')) return false;
  element.click();
  return true;
}
function findControl(doc, selector, matches) {
  return Array.from(doc.querySelectorAll(selector)).find(el =>
    matches.test(el.getAttribute('aria-label') || el.textContent || '')
  );
}
function path(doc, url) {
  const next = new URL(url, doc.location.href);
  if (next.origin !== doc.location.origin) return false;
  if (next.href === doc.location.href) return reveal(doc.querySelector('main h1, main h2, main'));
  const existing = Array.from(doc.querySelectorAll('a[href]')).find(a =>
    a.target !== '_blank' && new URL(a.href).href === next.href
  );
  if (existing) return activate(existing);
  doc.defaultView.location.assign(next.href);
  return true;
}
function afterNativeView(doc, open, arrive) {
  if (!open()) return false;
  if (arrive()) return true;
  // A navigation can commit on the next React render. Stop if the host routes away.
  const win = doc.defaultView;
  if (!win.MutationObserver) return true;
  const observer = new win.MutationObserver(() => { if (arrive()) finish(); });
  const timer = win.setTimeout(finish, 1600);
  function finish() {
    observer.disconnect();
    win.clearTimeout(timer);
    win.removeEventListener('pagehide', finish);
  }
  win.addEventListener('pagehide', finish, { once: true });
  observer.observe(doc.body, { childList: true, subtree: true });
  return true;
}
function echo(doc, id) {
  const find = selector => doc.querySelector(selector);
  if (id === 'case-files') {
    const campaign = () => reveal(find('.campaign-hub'));
    return campaign() || afterNativeView(doc, () => activate(find('.ward a[href="#/"]')), campaign);
  }
  if (id === 'evidence') {
    if (reveal(find('.evidence-desk, .evidence-board'))) return true;
    const tabs = findControl(doc, '.evidence-tabs [role="tab"]', /Investigations/);
    if (tabs) return afterNativeView(doc, () => activate(tabs), () => reveal(find('.evidence-desk')));
    if (reveal(find('.working-board, .patient-presence'))) return true;
  }
  if (id === 'diagnosis' && reveal(find('.reason-grid, .confirmed-diagnosis, .case-stage-summary'))) return true;
  // Starting a new case writes a progress record. Present the actual gate for the player.
  if (id === 'diagnosis' || id === 'evidence') {
    const entry = () => reveal(find('.campaign-opening .primary, .case-workspace .loading-panel, .case-stage-summary'));
    return entry() || afterNativeView(doc, () => activate(find('.ward a[href="#/"]')), entry);
  }
  return false;
}
function shadow(doc, id) {
  const find = selector => doc.querySelector(selector);
  const choose = () => {
    // The command shortcut in a debrief finalizes it. Leave that decision to the player.
    if (find('.sn-debrief')) return reveal(find('.sn-debrief'));
    if (id === 'briefing') {
      if (reveal(find('.sn-briefing, .sn-mission-grid'))) return true;
      return false;
    }
    if (id === 'districts') {
      if (reveal(find('.sn-hub-directory, .sn-world-map'))) return true;
      return activate(findControl(doc, '.sn-toolrail button', /2D Directory/));
    }
    if (id === 'signals') {
      if (find('.sn-toolrail')) return activate(findControl(doc, '.sn-toolrail button', /Evidence Notebook/));
      const operations = findControl(doc, '.sn-hub-directory button', /Operations Hub/i);
      return activate(operations);
    }
    return false;
  };
  if (!['briefing','districts','signals'].includes(id)) return false;
  if (choose()) return true;
  // Continue follows the game's saved campaign and respects its recovery panel.
  const onTitle = find('.sn-title .sn-primary');
  if (onTitle) return afterNativeView(doc, () => activate(onTitle), () => {
    if (find('[role="dialog"]')) return true;
    if (choose()) return true;
    if (find('.sn-title')) return false;
    const back = find('.sn-wordmark');
    if (back && !find('.sn-command')) return afterNativeView(doc, () => activate(back), choose);
    return false;
  });
  return afterNativeView(doc, () => activate(find('.sn-wordmark')), choose);
}
function pip(doc, id) {
  const find = selector => doc.querySelector(selector);
  if (id === 'field-guide') return activate(findControl(doc, '.top-actions button', /^How to play$/));
  const map = () => reveal(find('.map-title')) ||
    activate(findControl(doc, '.clearing-actions button, .game-overlay button', /^(Region map|Return to region map)$/i));
  if (id === 'waystone') return map() || reveal(find('#game'));
  if (id !== 'trailhead') return false;
  const takeTrail = () => activate(find('.clearing-resume:enabled, .map-launch .resume-button:enabled, .map-launch .primary-button:enabled'));
  if (takeTrail()) return true;
  if (find('.clearing-actions')) return afterNativeView(doc,
    () => activate(findControl(doc, '.clearing-actions button', /^Region map$/i)),
    () => takeTrail() || reveal(find('.map-selection'))
  );
  return reveal(find('.game-overlay, #game'));
}
function resonance(doc, id) {
  const find = selector => doc.querySelector(selector);
  const navigate = (name, arrive) => afterNativeView(doc,
    () => activate(findControl(doc, '.main-nav button', name)), arrive
  );
  if (id === 'listening-desk') {
    const practice = () => reveal(find('.listening-stage, .practice-heading'));
    return practice() || navigate(/Practice/, practice);
  }
  if (id === 'reference-monitors') {
    const replay = find('.play-orb:enabled');
    if (replay && !replay.classList.contains('is-playing')) return activate(replay);
    if (replay) return reveal(replay);
    const reference = () => reveal(find('.reference-list, .listening-stage'));
    return reference() || navigate(/Learn/, reference);
  }
  if (id === 'keyboard-lab') {
    const keyboard = () => reveal(find('.keyboard-tool'));
    return keyboard() || navigate(/Learn/, keyboard);
  }
  return false;
}
function between(doc, id) {
  if (id === 'conversation-seats') return path(doc, '/dialogue');
  if (id !== 'daily-checkin' && id !== 'reflection-journal') return false;
  const destination = () => {
    if (id === 'daily-checkin') return reveal(doc.querySelector('.daily-checkin'));
    // The home screen has two note fields. Choose the independent private journal.
    const entry = Array.from(doc.querySelectorAll('textarea[aria-label="Reflection note"]')).find(el => !el.closest('.daily-checkin'));
    return reveal(entry?.parentElement);
  };
  if (destination()) return true;
  if (doc.location.pathname === '/') return reveal(doc.querySelector('main h1, main h2'));
  const existingHome = doc.querySelector('a[href="/"]');
  return existingHome ? afterNativeView(doc, () => activate(existingHome), destination) : path(doc, '/');
}
function codex(doc, id) {
  let page = doc;
  const frame = doc.querySelector('iframe.codex-frame');
  if (frame) {
    try { page = frame.contentDocument; } catch { return false; }
  }
  if (!page) return false;
  const mode = { 'archive-desk':'library', 'celestial-atlas':'map', 'antiquity-gallery':'explore' }[id];
  if (!mode) return false;
  if (id === 'archive-desk' && activate(page.querySelector('[data-cx="dossier"]'))) return true;
  return activate(page.querySelector('[data-mc-mode="' + mode + '"]'));
}
function questcoins(doc, id) {
  if (!['expedition-map','task-ledger','savings-chest'].includes(id)) return false;
  const pathname = doc.location.pathname;
  if (pathname === '/choose') return reveal(doc.querySelector('main'));
  if (!pathname.startsWith('/parent') && !pathname.startsWith('/child')) return path(doc, '/choose');
  if (pathname.startsWith('/parent')) {
    if (id === 'task-ledger') return path(doc, '/parent/chores');
    if (id === 'savings-chest' && pathname === '/parent') {
      const section = findControl(doc, 'main h2,main h3,main h4', /Savings goals/i);
      if (reveal(section)) return true;
    }
    return pathname === '/parent' ? reveal(doc.querySelector('main')) : path(doc, '/parent');
  }
  return path(doc, { 'expedition-map':'/child','task-ledger':'/child/chores','savings-chest':'/child/goals' }[id]);
}
function samurai(doc, id) {
  if (id === 'reading-room') return path(doc, '#/wisdom');
  if (id === 'practice-yard') return path(doc, '#/practice');
  if (id !== 'district-gate') return false;
  if (reveal(doc.querySelector('#world-stage'))) return true;
  // Journeys is a linkable native directory even when the collection reader is already active.
  return path(doc, '#/journeys');
}
function polyglot(doc, id) {
  const routes = { 'universe-nav':'/heaven-universe','language-lab':'/training','flight-console':'/games' };
  return routes[id] ? path(doc,routes[id]) : false;
}
function periodic(doc, id) {
  const routes = { 'element-vault':'/atlas','orbital-model':'/studio','spectrum-bench':'/lab' };
  return routes[id] ? path(doc,routes[id]) : false;
}
const products = { echo, shadow, pip, resonance, between, codex, questcoins, samurai, polyglot, periodic };
export function performStationAction(worldId, stationId, ownerDocument = document) {
  if (!Object.hasOwn(products, worldId) || !ownerDocument?.defaultView) return false;
  // Storefronts keep their own account and purchase flow; only drive an actual open app.
  if (ownerDocument.querySelector('.collection-trail') || /^\/(auth|onboarding|sign-in|signin-with-chatgpt)(?:\/|$)/.test(ownerDocument.location.pathname)) return false;
  return products[worldId](ownerDocument, stationId);
}
