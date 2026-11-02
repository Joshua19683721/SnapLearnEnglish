/* 連續播放 / 翻卡 / 測驗流程的行為測試（Node + 假 DOM + 假語音引擎） */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class El {
  constructor(id) {
    this.id = id; this.style = {}; this.className = ''; this._html = ''; this.textContent = '';
    this.value = ''; this.children = []; this.src = ''; this.naturalWidth = 800; this.naturalHeight = 600;
    this._cls = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => this._cls.add(x)),
      remove: (...c) => c.forEach(x => this._cls.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !this._cls.has(c) : !!f; if (on) this._cls.add(c); else this._cls.delete(c); return on; },
      contains: c => this._cls.has(c)
    };
    this.parentNode = { insertBefore() {} };
  }
  set innerHTML(v) { this._html = String(v); } get innerHTML() { return this._html; }
  addEventListener() {} appendChild(c) { this.children.push(c); return c; }
  remove() {} getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  querySelectorAll() { return []; } insertBefore() {} decode() { return Promise.resolve(); }
  scrollIntoView() {}
}
const els = new Map();
const document = {
  getElementById(id) { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); },
  createElement(tag) { const e = new El(tag); e.tagName = tag.toUpperCase(); return e; },
  querySelectorAll() { return []; }, querySelector() { return null; }, addEventListener() {},
  body: new El('body'), activeElement: { tagName: 'BODY' }
};

const spoken = [];
let current = null;
const speechSynthesis = {
  cancel() { const u = current; current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
  speak(u) { spoken.push(u.text); current = u; setTimeout(() => { if (current === u) { current = null; if (u.onend) u.onend(); } }, 4); }
};
function Utter(text) { this.text = text; this.onend = null; this.onerror = null; this.lang = ''; this.rate = 1; }

const store = new Map();
const sandbox = {
  document, console, Math, JSON, Date, Number, String, Object, Array, Set, Map, RegExp, isFinite, parseInt, parseFloat,
  alert() {}, confirm() { return true; }, setTimeout, clearTimeout,
  navigator: {}, speechSynthesis, SpeechSynthesisUtterance: Utter,
  fetch: undefined, AbortController,
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code + `
;globalThis.__api = {
  setLabels: (arr) => { labels = arr; },
  getLabels: () => labels,
  playAllCards, stopPlayAll, updateFlashcard, renderCards,
  isPlaying: () => playRunning,
  setQuizMode, startQuiz, selectOption, confirmAnswer, nextQuestion,
  togglePanel, isPanelCollapsed: () => panelCollapsed,
  getQuiz: () => ({ mode: quizMode, qs: quizQuestions, idx: quizIndex, score: quizScore, sel: selectedOption, answered: quizAnswered }),
  DEMO_LABELS, buildExamplesForWords
};`, sandbox, { filename: 'x' });
const api = sandbox.__api;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
}

(async () => {
  const demo = api.DEMO_LABELS.slice(0, 3);
  const gen = api.buildExamplesForWords(demo);
  const labels = demo.map(d => ({
    en: d.en, zh: d.zh, ipa: d.ipa, x: .5, y: .5, free: false,
    example: gen[d.en].basic, exampleZh: gen[d.en].basicZh,
    advanced: gen[d.en].advanced, advancedZh: gen[d.en].advancedZh
  }));
  api.setLabels(labels);
  api.renderCards();

  // 1. 翻卡正面音標
  api.updateFlashcard();
  const fcIpa = document.getElementById('fcIpaFront').textContent;
  check('翻卡正面顯示音標', fcIpa === labels[0].ipa, `${labels[0].en} ${fcIpa}`);

  // 2. 連續播放順序：單字 → 基礎例句 → 下一張
  spoken.length = 0;
  await api.playAllCards('basic');
  const expectBasic = [];
  labels.forEach(l => { expectBasic.push(l.en); if (l.example) expectBasic.push(l.example); });
  check('基礎例句連續播放順序', JSON.stringify(spoken) === JSON.stringify(expectBasic),
    spoken.length + ' 段：' + spoken.map(s => s.slice(0, 18)).join(' → '));

  // 3. 進階例句
  spoken.length = 0;
  await api.playAllCards('advanced');
  const expectAdv = [];
  labels.forEach(l => { expectAdv.push(l.en); if (l.advanced) expectAdv.push(l.advanced); });
  check('進階例句連續播放順序', JSON.stringify(spoken) === JSON.stringify(expectAdv),
    spoken.length + ' 段');

  // 4. 播放中可停止
  spoken.length = 0;
  const p = api.playAllCards('basic');
  await sleep(60);
  const playingNow = api.isPlaying();
  api.stopPlayAll(false);
  await sleep(300);
  check('播放中可停止', playingNow === true && api.isPlaying() === false && spoken.length <= 2,
    `停止前在播、停止後 spoken=${spoken.length} 段`);

  // 5. 播完不留高亮
  const hl = document.getElementById('cardsGrid').children.filter(c => c.classList && c.classList.contains('playing')).length;
  check('播完清除卡片高亮', hl === 0, `殘留 ${hl} 個`);

  // 6. 測驗：預設選擇題、可改選、送出後鎖定
  api.setQuizMode('choice');
  api.startQuiz();
  let q = api.getQuiz();
  const isChoice = q.mode === 'choice' && q.qs.every(x => x.mode === 'choice');
  api.selectOption(0); api.selectOption(2);
  const afterChange = api.getQuiz();
  const selMarks = document.getElementById('quizOptions').children.filter(b => b.classList && b.classList.contains('sel')).length;
  api.confirmAnswer();
  const afterConfirm = api.getQuiz();
  api.selectOption(1);
  const afterLock = api.getQuiz();
  check('選擇題：可改選、送出才鎖定',
    isChoice && afterChange.sel === 2 && afterConfirm.answered === true && afterLock.sel === 2 && selMarks === 1,
    `改選後 sel=${afterChange.sel}、sel 標記 ${selMarks} 個、送出後再點無效`);

  // 7. 下一題會重置狀態
  api.nextQuestion();
  const next = api.getQuiz();
  check('下一題重置作答狀態', next.idx === 1 && next.answered === false && next.sel === null, `idx=${next.idx}`);

  // 8. 輸入模式
  api.setQuizMode('type');
  api.startQuiz();
  const tq = api.getQuiz();
  const input = document.getElementById('quizTypeInput');
  input.value = '  ' + tq.qs[0].answer.toUpperCase() + ' ';
  api.confirmAnswer();
  const tAfter = api.getQuiz();
  check('輸入題：忽略大小寫與空白', tq.mode === 'type' && tAfter.answered === true && tAfter.score === Math.round(100 / tq.qs.length), `score=${tAfter.score}`);

  // 9. 版面：分頁順序與句子區塊位置
  const iVisual = html.indexOf('data-tab="visual"');
  const iSentence = html.indexOf('data-tab="sentence"');
  const iCards = html.indexOf('data-tab="cards"');
  const iViewSent = html.indexOf('id="view-sentence"');
  const iBox = html.indexOf('id="sentenceBox"');
  const iViewCards = html.indexOf('id="view-cards"');
  const orderOk = iVisual > 0 && iVisual < iSentence && iSentence < iCards;
  const boxOk = iViewSent > 0 && iBox > iViewSent && iBox < iViewCards;
  const panelHasSentence = /<div class="panel">[\s\S]*?id="sentenceBox"[\s\S]*?<\/div>\s*<\/div>\s*<!-- ============ View 2: Sentence/.test(html);
  check('分頁順序：實景熱點 → 圖片句子 → 單字圖卡', orderOk && boxOk && !panelHasSentence,
    `句子區塊在獨立分頁（不在辨識設定面板內）`);

  // 10. 側欄收合：結構 + 行為
  const hasPanel = html.indexOf('id="sidePanel"') > 0;
  const hasToggle = html.indexOf('onclick="togglePanel()"') > 0;
  const hasOpenBtn = html.indexOf('id="panelOpenBtn"') > 0;
  const collapsedBefore = sandbox.__api.isPanelCollapsed();
  sandbox.__api.togglePanel(true, true);
  const afterCollapse = sandbox.__api.isPanelCollapsed();
  const clsOk = document.getElementById('sidePanel').classList.contains('collapsed');
  sandbox.__api.togglePanel(false, true);
  const afterExpand = sandbox.__api.isPanelCollapsed();
  check('辨識設定可收合', hasPanel && hasToggle && hasOpenBtn && afterCollapse && clsOk && !afterExpand,
    `收合前 ${collapsedBefore} → 收合 ${afterCollapse}（面板隱藏 ${clsOk}）→ 展開 ${afterExpand}`);

  console.log(`\n${fail === 0 ? '全部通過' : '有失敗'}：${pass}/${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
