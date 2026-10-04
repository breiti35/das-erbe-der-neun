/*
 * Das Erbe der Neun – Download-Seite.
 * Holt Version, Datum, Dateigröße und Release-Notizen des neuesten Release von der GitHub-API.
 * Ohne JavaScript oder bei einem Fehler bleiben die Ersatztexte aus dem HTML stehen.
 * Inhalte aus der API werden nur per textContent/createElement eingesetzt – nie per innerHTML.
 */
(function () {
  'use strict';

  var API_URL = 'https://api.github.com/repos/breiti35/das-erbe-der-neun/releases/latest';
  var SETUP_ASSET = 'ErbeDerNeun-win-Setup.exe';
  var MAX_NOTES_LENGTH = 20000;

  if (!window.fetch) {
    return;
  }

  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 10000) : null;

  fetch(API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: controller ? controller.signal : undefined,
    credentials: 'omit',
    referrerPolicy: 'no-referrer'
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    })
    .then(showRelease)
    .catch(function () {
      // Ersatztexte aus dem HTML bleiben stehen.
    })
    .then(function () {
      if (timer) {
        clearTimeout(timer);
      }
    });

  function showRelease(release) {
    if (!release || typeof release !== 'object') {
      return;
    }

    var version = cleanVersion(release.tag_name || release.name);
    var date = formatDate(release.published_at);

    var info = document.getElementById('release-info');
    if (info && version) {
      info.textContent = 'Version ' + version + (date ? ' vom ' + date : '');
    }

    var size = setupSize(release.assets);
    var sizeElement = document.getElementById('release-size');
    if (sizeElement && size) {
      sizeElement.textContent = String(size);
    }

    showNotes(version, date, typeof release.body === 'string' ? release.body : '');
  }

  function cleanVersion(value) {
    if (typeof value !== 'string') {
      return '';
    }
    var match = /(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?)/.exec(value);
    return match ? match[1] : '';
  }

  function formatDate(value) {
    if (typeof value !== 'string') {
      return '';
    }
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }
    try {
      return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  /** Größe der Setup-Datei in MB (wie im Windows-Explorer: 1 MB = 1024 × 1024 Byte). */
  function setupSize(assets) {
    if (!Array.isArray(assets)) {
      return 0;
    }
    for (var i = 0; i < assets.length; i++) {
      var asset = assets[i];
      if (asset && asset.name === SETUP_ASSET && typeof asset.size === 'number' && asset.size > 0) {
        return Math.round(asset.size / (1024 * 1024));
      }
    }
    return 0;
  }

  function showNotes(version, date, body) {
    var container = document.getElementById('release-notes');
    if (!container) {
      return;
    }

    var text = body.trim().slice(0, MAX_NOTES_LENGTH);
    var fragment = document.createDocumentFragment();

    if (version) {
      var title = document.createElement('h3');
      title.className = 'notes-version';
      title.textContent = 'Version ' + version;
      fragment.appendChild(title);
    }
    if (date) {
      var when = document.createElement('p');
      when.className = 'notes-date';
      when.textContent = 'Veröffentlicht am ' + date;
      fragment.appendChild(when);
    }

    var notes = document.createElement('div');
    notes.className = 'notes-body';
    if (text) {
      renderMarkdown(text, notes);
    } else {
      var empty = document.createElement('p');
      empty.textContent = 'Für diese Version gibt es keine weiteren Notizen.';
      notes.appendChild(empty);
    }
    fragment.appendChild(notes);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(fragment);
  }

  /**
   * Sehr kleiner, sicherer Markdown-Leser: Überschriften (#), Listen (-, *, +, 1.), Absätze und im Text
   * **fett**, *kursiv*, `Code` und [Links](https://…). Alles andere bleibt einfacher Text.
   */
  function renderMarkdown(markdown, target) {
    var lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    var paragraph = [];
    var list = null;
    var lastItem = null;

    function flushParagraph() {
      if (paragraph.length) {
        var p = document.createElement('p');
        appendInline(p, paragraph.join(' '));
        target.appendChild(p);
        paragraph = [];
      }
    }

    function closeList() {
      list = null;
      lastItem = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw.trim();
      var match;

      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      if ((match = /^#{1,6}\s+(.*)$/.exec(line))) {
        flushParagraph();
        closeList();
        var heading = document.createElement('h4');
        appendInline(heading, match[1].replace(/\s*#+\s*$/, ''));
        target.appendChild(heading);
        continue;
      }

      var bullet = /^[-*+]\s+(.*)$/.exec(line);
      var numbered = bullet ? null : /^\d+[.)]\s+(.*)$/.exec(line);
      if (bullet || numbered) {
        flushParagraph();
        var type = bullet ? 'UL' : 'OL';
        if (!list || list.nodeName !== type) {
          list = document.createElement(type);
          target.appendChild(list);
        }
        lastItem = document.createElement('li');
        appendInline(lastItem, (bullet || numbered)[1]);
        list.appendChild(lastItem);
        continue;
      }

      if (/^[-*_]{3,}$/.test(line)) {
        flushParagraph();
        closeList();
        continue;
      }

      // Eingerückte Folgezeile eines Listenpunkts
      if (lastItem && /^\s+/.test(raw)) {
        appendInline(lastItem, ' ' + line);
        continue;
      }

      closeList();
      paragraph.push(line);
    }

    flushParagraph();
  }

  function appendInline(parent, text) {
    var pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*)/g;
    var last = 0;
    var match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) {
        parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      }

      var node;
      if (match[2] || match[3]) {
        node = document.createElement('strong');
        node.textContent = match[2] || match[3];
      } else if (match[4]) {
        node = document.createElement('code');
        node.textContent = match[4];
      } else if (match[5]) {
        if (/^https:\/\//i.test(match[6])) {
          node = document.createElement('a');
          node.href = match[6];
          node.rel = 'noopener noreferrer';
          node.textContent = match[5];
        } else {
          node = document.createTextNode(match[5]);
        }
      } else {
        node = document.createElement('em');
        node.textContent = match[7];
      }

      parent.appendChild(node);
      last = pattern.lastIndex;
    }

    if (last < text.length) {
      parent.appendChild(document.createTextNode(text.slice(last)));
    }
  }
})();
