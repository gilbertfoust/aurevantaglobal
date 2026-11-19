/* Fixed product controls provide the short light and motion cues in each environment.
   Payloads stay in this document. No form values, personal records or text are collected. */
const controls = {
  echo: {
    inspect: '.clue-button, .conversation-topics button, .evidence-tabs [role="tab"]',
    choose: '.diagnosis-card, .chapter-map button',
    travel: '.campaign-case-grid button'
  },
  shadow: {
    inspect: '.sn-world-target, .sn-toolrail button, .sn-mission-card button',
    choose: '.sn-briefing button[aria-pressed], .sn-world-senses button[aria-pressed]',
    travel: '.sn-hub-directory button, .sn-district-entry button, .sn-world-map button'
  },
  pip: {
    travel: '.clearing-resume, .map-launch button, .board-strip button, .region-node',
    inspect: '.keeper-dialogue button, .camera-zoom button',
    practice: '.touch-actions button'
  },
  resonance: {
    listen: '.reference-actions .secondary, .feedback-actions .secondary, .keyboard button, .note-pads button',
    practice: '.mode-tabs button, .path-step, .game-card button[aria-label^="Play "], .rhythm-studio .primary',
    choose: '.answer-grid button'
  },
  periodic: {
    inspect: '.living-element-tile, .atlas-search-results button, .table-selection-preview button',
    practice: '[aria-label="Replay molecular event"], [aria-label="Molecular event phases"] button',
    choose: '.universe-mode button, [aria-label="Model controls"] button'
  },
  codex: {
    inspect: '[data-select], [data-follow], [data-cx="inspect"], [data-cx="sources"], [data-cx="dossier"]',
    travel: '[data-mc-mode], [data-cx="home"], [data-cx="mode"]',
    listen: '[data-cx="speak"]'
  },
  samurai: {
    travel: '.world-pin, .journey-teaser, .district-destinations button, .journey-library-grid button',
    inspect: '.inspect-district, .wisdom-filter-panel button, [aria-label="Journey stops"] button',
    practice: '.journey-lesson button'
  },
  between: {
    // The response is identical for every mood and never includes the option chosen.
    choose: '.mood-choices button',
    travel: '.feature-moment a[href="/studio"], .feature-moment a[href="/dialogue"]'
  },
  questcoins: {
    travel: 'nav a[href^="/child"], nav a[href^="/parent"], main a[aria-label][href^="/child/"]',
    inspect: 'main a[href="/child/lessons"], main a[href="/child/goals"]'
  },
  polyglot: {
    travel: '.nebula-flight-plan button, .hall-wayfinding__destination button',
    practice: '.training-map button, .training-produced-check button, .hall-passport__study-actions button',
    choose: '.language-card-grid button, .nebula-launch-deck button[aria-pressed]'
  },
  studio: {
    practice: '.demo-play',
    choose: '[data-filter], [data-clear]'
  },
  aurevanta: {
    choose: '.package-select, [data-package-option]',
    inspect: '#download-estimate, .business-paths a'
  }
};
const selectionChanges = {
  periodic: '.atlas-compact-picker select, .atlas-filters select, select[aria-label="Filter complete element library by family"]',
  codex: '#cx-culture, #mc-atlas-range',
  resonance: '.keyboard-tool select, .rhythm-studio select',
  polyglot: '.language-select select',
  studio: '[data-tools] select',
  aurevanta: 'input[name="growthCycle"], .addon-check'
};
const strength = { inspect:.42, choose:.34, practice:.64, travel:.56, listen:.88, complete:.95 };
function cueForControl(node, rules) {
  for (const [kind, selector] of Object.entries(rules)) {
    const control = node.closest(selector);
    if (!control) continue;
    let value;
    // An instrument's fixed key index can drive register-dependent animation.
    if (control.matches('.keyboard button')) {
      const keys = Array.from(control.parentElement.querySelectorAll('button'));
      value = keys.indexOf(control) / Math.max(1, keys.length - 1);
    }
    return { kind, value };
  }
}
export function installResponses(host, info, canvas, invalidate) {
  if (!host?.ownerDocument || !Object.hasOwn(controls, info?.id)) return () => {};
  const id = info.id;
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  const disposers = [];
  let lastKind = '', lastTime = -Infinity;
  function signal(kind, value) {
    const now = win.performance.now();
    if (doc.hidden || !host.isConnected || (kind === lastKind && now - lastTime < 65)) return;
    lastKind = kind;
    lastTime = now;
    const detail = { kind, strength: strength[kind] };
    if (Number.isFinite(value)) detail.value = Math.min(1, Math.max(0, value));
    host.dispatchEvent(new win.CustomEvent('world-feedback', { detail }));
    if (typeof invalidate === 'function') invalidate();
  }
  function outsideViewer(node) {
    return node?.nodeType === 1 && node !== canvas && !host.contains(node) &&
      !node.closest('textarea, [contenteditable="true"], [aria-disabled="true"], :disabled');
  }
  function bindDocument(view) {
    if (!view) return () => {};
    function onClick(event) {
      const target = event.target;
      if (!outsideViewer(target)) return;
      const cue = cueForControl(target, controls[id]);
      if (cue) signal(cue.kind, cue.value);
    }
    function onChange(event) {
      const target = event.target;
      if (outsideViewer(target) && selectionChanges[id] && target.matches(selectionChanges[id])) signal('choose');
    }
    view.addEventListener('click', onClick, true);
    view.addEventListener('change', onChange, true);
    let observer;
    const scope = { resonance:'.studio-shell', pip:'#game', echo:'.ward', questcoins:'#root' }[id];
    const area = scope && (view.querySelector(scope) || view.body);
    if (area && win.MutationObserver) {
      // Observe native outcomes as well as activations, including keyboard and gamepad play.
      // CSS style and transient 3D transform writes are deliberately excluded.
      const resultMarker = { pip:'.results-panel,.victory-overlay', questcoins:'[role="dialog"].shadow-glow' }[id];
      observer = new win.MutationObserver(records => {
        for (const change of records) {
          const target = change.target;
          if (target.nodeType !== 1 || host.contains(target)) continue;
          if (id === 'resonance' && target.matches('.listening-stage[data-phase="playing"]')) signal('listen');
          if (id === 'echo' && target.matches('.stage-track li[aria-current="step"]')) signal('complete');
          if (id === 'pip' && target.matches('.waystone-count i.lit')) signal('complete');
          if (resultMarker && change.type === 'childList') {
            for (const added of change.addedNodes) {
              if (added.nodeType === 1 && !host.contains(added) && (added.matches(resultMarker) || added.querySelector(resultMarker))) {
                signal('complete');
                break;
              }
            }
          }
        }
      });
      const options = id === 'resonance' ? { attributes:true, attributeFilter:['data-phase'] } :
        id === 'echo' ? { attributes:true, attributeFilter:['aria-current'] } :
        id === 'pip' ? { attributes:true, attributeFilter:['class'], childList:true } : { childList:true };
      observer.observe(area, { ...options, subtree: true });
    }
    return () => {
      view.removeEventListener('click', onClick, true);
      view.removeEventListener('change', onChange, true);
      observer?.disconnect();
    };
  }
  disposers.push(bindDocument(doc));
  if (id === 'codex') {
    // The public app's outer shell contains an authored, same-origin archive.
    const frame = doc.querySelector('iframe.codex-frame');
    if (frame) {
      let unbind = () => {};
      const bindFrame = () => {
        unbind();
        try { unbind = bindDocument(frame.contentDocument); } catch { unbind = () => {}; }
      };
      bindFrame();
      frame.addEventListener('load', bindFrame);
      disposers.push(() => { frame.removeEventListener('load', bindFrame); unbind(); });
    }
  }
  return () => { for (const dispose of disposers) dispose(); };
}
