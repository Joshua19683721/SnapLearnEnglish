/* 影像壓縮管線測試：用「近似 JPEG 檔案大小」的假 canvas 驗證 encodeWithinBudget 是否真的落在 100–200KB */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class El {
  constructor(id) {
    this.id = id; this.style = {}; this.className = ''; this._html = ''; this.textContent = '';
    this.value = ''; this.children = []; this.offsetWidth = 120; this.offsetHeight = 30;
    this.clientWidth = 800; this.clientHeight = 600; this.src = ''; this.naturalWidth = 0; this.naturalHeight = 0;
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    this.parentNode = { insertBefore() {}, removeChild() {} };
  }
  set innerHTML(v) { this._html = String(v); } get innerHTML() { return this._html; }
  addEventListener() {} appendChild(c) { this.children.push(c); return c; } remove() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  querySelectorAll() { return []; } querySelector() { return null; } insertBefore() {}
  decode() { return Promise.resolve(); }
}

class FakeBlob {
  constructor(parts, opts) {
    this.size = (parts || []).reduce((s, p) => s + ((p && (p.__size || p.size)) || 0), 0);
    this.type = (opts && opts.type) || '';
  }
}
class FakeFile extends FakeBlob {
  constructor(parts, name, opts) { super(parts, opts); this.name = name; this.lastModified = (opts && opts.lastModified) || 0; }
}

/* JPEG 大小模型：bytes ≈ 像素數 × 品質 × 每像素位元組係數 */
let BYTES_PER_PX_AT_Q1 = 0.26;

function makeCanvas() {
  const c = {
    width: 0, height: 0,
    getContext() {
      return { imageSmoothingEnabled: false, imageSmoothingQuality: 'low', drawImage() {} };
    },
    toBlob(cb, type, q) {
      const px = c.width * c.height;
      const size = Math.max(1024, Math.round(px * BYTES_PER_PX_AT_Q1 * (q || 1)));
      setTimeout(() => cb(new FakeBlob([{ __size: size }], { type })), 0);
    }
  };
  return c;
}

const els = new Map();
const document = {
  getElementById(id) { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); },
  createElement(t) { return t === 'canvas' ? makeCanvas() : new El(t); },
  querySelectorAll() { return []; }, querySelector() { return null; },
  addEventListener() {}, activeElement: { tagName: 'BODY' }, body: new El('body')
};

const sandbox = {
  document, console, Math, JSON, Date, Number, String, Object, Array, Set, Map, RegExp, isFinite, parseInt, parseFloat,
  alert() {}, confirm() { return true; }, setTimeout, clearTimeout, Uint8Array, atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  navigator: { mediaDevices: { getUserMedia: async () => { throw new Error('no cam'); } } },
  speechSynthesis: { cancel() {}, speak() {} }, SpeechSynthesisUtterance: function () {},
  fetch: undefined, AbortController, localStorage: undefined,
  Blob: FakeBlob, File: FakeFile, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  FileReader: function () { this.readAsDataURL = () => {}; },
  createImageBitmap: async (f) => ({ width: f.__w, height: f.__h, close() { f.__closed = true; } }),
  isSecureContext: true,
  Image: function () { this.onload = null; this.onerror = null; this.src = ''; this.naturalWidth = 0; this.naturalHeight = 0; this.decode = () => Promise.resolve(); },
  performance: { now: () => Date.now() }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code + '\n;globalThis.__api={prepareImage,resizeImageForVllm,encodeWithinBudget,applyImage,IMG_MAX_SIDE,IMG_TARGET_MIN,IMG_TARGET_MAX,VLM_TARGET_BYTES,buildVlmThumb,makeThumb,currentImage:()=>currentImage,img:img,setImg:(w,h)=>{img.naturalWidth=w;img.naturalHeight=h;}};', sandbox, { filename: 'x' });
const api = sandbox.__api;

function mkFile(w, h, bytes) {
  const f = new FakeFile([{ __size: bytes }], `photo_${w}x${h}.jpg`, { type: 'image/jpeg' });
  f.__w = w; f.__h = h; f.size = bytes; f.type = 'image/jpeg';
  return f;
}

const cases = [
  { name: 'iPhone 12MP 4:3 後置鏡頭', w: 4032, h: 3024, bytes: 4_200_000, bpp: 0.26 },
  { name: 'Android 108MP 4:3', w: 12000, h: 9000, bytes: 9_800_000, bpp: 0.26 },
  { name: '已壓縮小圖 800×600', w: 800, h: 600, bytes: 90_000, bpp: 0.26 },
  { name: '超細雜訊照（難壓）', w: 4032, h: 3024, bytes: 6_000_000, bpp: 0.55 },
  { name: '直式 9:16 12MP', w: 3024, h: 4032, bytes: 4_500_000, bpp: 0.26 },
  { name: '超寬全景', w: 8000, h: 2000, bytes: 3_000_000, bpp: 0.26 }
];

(async () => {
  let pass = 0, fail = 0;
  for (const c of cases) {
    BYTES_PER_PX_AT_Q1 = c.bpp;
    const file = mkFile(c.w, c.h, c.bytes);
    const t0 = Date.now();
    const out = await api.prepareImage(file, { maxSide: api.IMG_MAX_SIDE });
    const kb = out.bytes / 1024;
    const longSide = Math.max(out.width, out.height);
    const okSize = out.bytes <= api.IMG_TARGET_MAX;
    const okDim = longSide <= api.IMG_MAX_SIDE;
    const okRange = out.bytes >= api.IMG_TARGET_MIN;
    const ok = okSize && okDim;
    if (ok) pass++; else fail++;
    console.log(`${ok ? '✓' : '✗'} ${c.name}`);
    console.log(`   ${out.width}×${out.height}・${kb.toFixed(0)}KB・q${Math.round(out.quality * 100)}・${Date.now() - t0}ms`
      + `  ${okRange ? '(在 100–200KB 甜蜜區)' : '(低於 100KB，屬可接受)'}`
      + `  ${okSize ? '' : '← 超過 200KB！'}${okDim ? '' : ' ← 尺寸超標！'}`);
  }
  console.log(`\n尺寸/大小門檻：${pass}/${cases.length} 通過`);

  // 驗證 blob 被包成 File 且型別正確
  BYTES_PER_PX_AT_Q1 = 0.26;
  const f = await api.resizeImageForVllm(mkFile(4032, 3024, 4_000_000), 1280, 0.85);
  const okFile = f instanceof FakeFile && f.type === 'image/jpeg' && /\.jpg$/.test(f.name);
  console.log(`${okFile ? '✓' : '✗'} resizeImageForVllm 回傳 File：${f.name} ${f.type} ${Math.round(f.size / 1024)}KB`);

  // applyImage → imgMeta 文字 + currentImage 狀態
  const out = await api.prepareImage(mkFile(4032, 3024, 4_000_000), { maxSide: 1280 });
  api.setImg(out.width, out.height);
  api.applyImage(out);
  api.img.onload();                       // 模擬瀏覽器載入完成
  const meta = document.getElementById('imgMeta').innerHTML;
  const st = document.getElementById('status').textContent;
  const okMeta = /1280×960/.test(meta) && /KB/.test(meta) && /省 \d+%/.test(meta);
  console.log(`${okMeta ? '✓' : '✗'} 載入後資訊：${meta.replace(/<[^>]+>/g, '')}`);
  console.log(`${/720p 已壓縮/.test(st) ? '✓' : '✗'} 狀態列：${st}`);

  process.exit(fail === 0 && okFile && okMeta ? 0 : 1);
})();
