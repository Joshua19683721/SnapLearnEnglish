// 臨時測試載具：在 Node 裡用假 DOM 跑 index.html 的自我檢查
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('找不到 script'); process.exit(1); }
let code = m[1];

class El {
  constructor(id) {
    this.id = id; this.style = {}; this.className = ''; this._html = ''; this.textContent = '';
    this.value = ''; this.children = []; this.offsetWidth = 120; this.offsetHeight = 30;
    this.clientWidth = 800; this.clientHeight = 600; this.src = ''; this.naturalWidth = 800; this.naturalHeight = 600;
    this._cls = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => this._cls.add(x)),
      remove: (...c) => c.forEach(x => this._cls.delete(x)),
      toggle: (c, force) => { const on = force === undefined ? !this._cls.has(c) : !!force; if (on) this._cls.add(c); else this._cls.delete(c); return on; },
      contains: (c) => this._cls.has(c)
    };
    this.parentNode = { insertBefore() {} };
  }
  set innerHTML(v) { this._html = String(v); } get innerHTML() { return this._html; }
  addEventListener() {} appendChild(c) { this.children.push(c); return c; }
  remove() {} getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  querySelectorAll() { return []; } insertBefore() {} decode() { return Promise.resolve(); }
}
const els = new Map();
const document = {
  getElementById(id) { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); },
  createElement(tag) { const e = new El(tag); e.tagName = tag.toUpperCase(); return e; },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  addEventListener() {},
  body: new El('body'),
  activeElement: { tagName: 'BODY' }
};
const store = new Map();
const sandbox = {
  document, console, Math, JSON, Date, Number, String, Object, Array, Set, Map, RegExp, isFinite, parseInt, parseFloat,
  alert() {}, confirm() { return true; }, setTimeout, clearTimeout,
  navigator: {}, speechSynthesis: { cancel() {}, speak() {} }, SpeechSynthesisUtterance: function () {},
  fetch: undefined, AbortController,
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
try {
  vm.runInContext(code + '\n;globalThis.__api = { runSelfTest, labels: () => labels, CORE_NOUNS, P_BASIC, P_ADV, CHUNKS };', sandbox, { filename: 'index.html' });
} catch (e) {
  console.error('載入失敗:', e.stack);
  process.exit(1);
}

setTimeout(() => {
  try {
    sandbox.__api.runSelfTest();
    const out = document.getElementById('checkReport').innerHTML
      .replace(/<div class="report-row (ok|no)">/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
    console.log(out);
  } catch (e) { console.error('執行失敗:', e.stack); process.exit(1); }
}, 200);
