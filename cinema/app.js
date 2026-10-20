/* ============================================================
   幕光影院 · 前台脚本
   ============================================================ */
const CFG = {
  // 线路表：/api/ 是主源，/api2/ /api3/ 是备源（.api-proxy 写第2、3行才有）。
  // 主源拿不到数据时自动往后切；只配了一个源的站，后两条会 404，跳过即可。
  apis: ['https://web-production-a7e0b.up.railway.app/vod-api/', 'https://web-production-a7e0b.up.railway.app/vod-api2/', 'https://web-production-a7e0b.up.railway.app/vod-api3/'],
  pageSize: 24,              // 每页数量
  hotCats: 12,               // 分类条最多展示几个

  // 题材站必填：留空 = 通用站（展示源站全量）。本站为综合影视站，留空。
  topic: '',
  topicCats: [],
};

/* ── 工具 ───────────────────────────── */
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(params, allowFailover = true) {
  const u = new URL(CFG.apis[S.line], location.origin);
  Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
  try {
    const r = await fetch(u, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    // 当前线路拿不到数据 → 顺次试下一条，全试完才真报错
    if (allowFailover) {
      for (let i = S.line + 1; i < CFG.apis.length; i++) {
        if (S.dead.has(i)) continue;
        try {
          const u2 = new URL(CFG.apis[i], location.origin);
          Object.entries(params).forEach(([k, v]) => v != null && u2.searchParams.set(k, v));
          const r2 = await fetch(u2, { headers: { Accept: 'application/json' } });
          if (!r2.ok) { S.dead.add(i); continue; }
          S.line = i;                       // 切过去，后续都走这条
          return await r2.json();
        } catch (_) { S.dead.add(i); }
      }
    }
    throw e;
  }
}

/* ── 状态 ───────────────────────────── */
const S = { cat: '', kw: '', page: 1, pages: 1, total: 0, list: [], cats: [], loading: false,
            line: 0, dead: new Set() };

/* ── 骨架屏 ─────────────────────────── */
const skeleton = (n = 18) =>
  `<div class="grid">${'<div class="sk"></div>'.repeat(n)}</div>`;

/* ── 卡片 ───────────────────────────── */
function card(v) {
  const tag = v.vod_remarks || '';
  const cat = v.type_name || '';
  const yr = (v.vod_time || '').slice(0, 4);
  const code = (v.vod_name || '').match(/^[A-Z]{2,5}[-\s]?\d{2,5}/i);
  return `<article class="card" data-id="${v.vod_id}" tabindex="0">
    <div class="thumb">
      ${code ? `<span class="badge badge-tag">${esc(code[0])}</span>` : ''}
      ${tag ? `<span class="badge badge-hd">${esc(tag)}</span>` : ''}
      <img data-src="${esc(v.vod_pic || '')}" alt="${esc(v.vod_name)}" loading="lazy">
      <span class="play-hint"><span>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </span></span>
    </div>
    <div class="c-name">${esc(v.vod_name)}</div>
    <div class="c-sub">
      ${cat ? `<span class="c-cat">${esc(cat)}</span>` : ''}
      ${yr ? `<span>${yr}</span>` : ''}
    </div>
  </article>`;
}

/* ── 懒加载 ─────────────────────────── */
const io = new IntersectionObserver(es => {
  es.forEach(e => {
    if (!e.isIntersecting) return;
    const img = e.target;
    io.unobserve(img);
    const src = img.dataset.src;
    if (!src) return;
    img.src = src;
    img.onload = () => img.classList.add('in');
    img.onerror = () => { img.style.display = 'none'; };
  });
}, { rootMargin: '260px' });

const bindLazy = root => $$('img[data-src]', root).forEach(i => io.observe(i));

/* ── 分类 ───────────────────────────── */
// 苹果CMS 只有 ac=list 会返回 class 分类表，videolist 不带，所以单独拉一次
async function loadCats() {
  try {
    if (CFG.topic && CFG.topicCats.length) {
      S.cats = CFG.topicCats.map(w => ({ type_id: 'kw:' + w, type_name: w }));
      renderCats();
      return;
    }
    const d = await api({ ac: 'list' });
    if (d.class?.length) { S.cats = leafCats(d.class); renderCats(); }
  } catch (e) { /* 分类拉不到不影响列表 */ }
}

// 苹果CMS 的父分类本身挂 0 部片，片子全在子分类里；只展示叶子分类。
function leafCats(all) {
  const parents = new Set(all.map(c => String(c.type_pid)));
  const leaves = all.filter(c => !parents.has(String(c.type_id)));
  return leaves.length ? leaves : all;
}

function renderCats() {
  const box = $('#catsIn');
  const items = [{ type_id: '', type_name: '全部' }, ...S.cats.slice(0, CFG.hotCats)];
  box.innerHTML = items.map(c =>
    `<button class="cat${String(c.type_id) === String(S.cat) ? ' on' : ''}" data-id="${c.type_id}">${esc(c.type_name)}</button>`
  ).join('');
}

/* ── 完全开放：无账号、无会员、无试看限制 ── */
function trialBar() { return ''; }

/* ── 列表 ───────────────────────────── */
async function load(reset = false) {
  if (S.loading) return;
  S.loading = true;
  const app = $('#app');
  if (reset) { S.page = 1; S.list = []; app.innerHTML = skeleton(); }

  try {
    const wd = [CFG.topic, S.kw].filter(Boolean).join(' ') || null;
    const d = await api({ ac: 'videolist', pg: S.page, pagesize: CFG.pageSize,
                          t: (CFG.topic ? null : (S.cat || null)), wd });
    S.pages = d.pagecount || 1;
    S.total = d.total || 0;
    S.list.push(...(d.list || []));
    render();
  } catch (e) {
    app.innerHTML = state('load-fail', '内容加载失败', '请检查网络后重试');
  } finally {
    S.loading = false;
  }
}

function state(kind, title, sub) {
  const ico = kind === 'empty'
    ? '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
    : '<circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/>';
  return `<div class="state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${ico}</svg>
    <p>${esc(title)}</p><small>${esc(sub)}</small></div>`;
}

function render() {
  const app = $('#app');
  if (!S.list.length) {
    app.innerHTML = state('empty', S.kw ? `没有找到「${S.kw}」` : '这个分类暂时没有内容', '换个关键词或分类试试');
    return;
  }
  const title = S.kw ? `搜索：${S.kw}` : (S.cats.find(c => String(c.type_id) === String(S.cat))?.type_name || '最新上架');
  app.innerHTML = `
    ${trialBar()}
    <div class="sec-hd">
      <h2>${esc(title)}</h2>
      <span class="meta">共 ${S.total.toLocaleString()} 部 · 第 ${S.page}/${S.pages} 页</span>
    </div>
    <div class="grid">${S.list.map(card).join('')}</div>
    ${S.page < S.pages ? '<div class="more"><button id="moreBtn">加载更多</button></div>' : ''}`;
  bindLazy(app);
}

/* ── 播放 ───────────────────────────── */
let hls = null;
async function play(id) {
  const mask = $('#pmask');
  mask.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#pTitle').textContent = '加载中…';
  $('#eps').innerHTML = '';
  hideFallback();

  try {
    // 列表用 videolist 已带 vod_play_url，命中就不用再请求详情（快一倍）
    let v = S.list.find(x => String(x.vod_id) === String(id));
    if (!v?.vod_play_url) {
      const d = await api({ ac: 'detail', ids: id });
      v = d.list?.[0];
    }
    if (!v) throw new Error('no data');
    $('#pTitle').textContent = v.vod_name || '播放';

    const eps = (v.vod_play_url || '').split('#')
      .map(s => { const i = s.lastIndexOf('$'); return i < 0 ? null : { name: s.slice(0, i) || '播放', url: s.slice(i + 1) }; })
      .filter(e => e && e.url);
    if (!eps.length) throw new Error('no source');

    if (eps.length > 1) {
      $('#eps').innerHTML = eps.map((e, i) =>
        `<button class="ep${i === 0 ? ' on' : ''}" data-u="${esc(e.url)}">${esc(e.name)}</button>`).join('');
    }
    src(eps[0].url);
  } catch (e) {
    $('#pTitle').textContent = '播放';
    showFallback('', '这一部暂时没有可用的播放地址', '换一部试试，其它片子不受影响');
  }
}

// 播放失败兜底：绝不能留一个黑掉的空播放器
function showFallback(url, why, tip) {
  const box = $('#pfall');
  $('#pfWhy').textContent = why || '这条线路暂时打不开';
  $('#pfTip').textContent = tip || '片源服务器的问题，换一集或换一部试试';
  const a = $('#pfLink');
  if (url) { a.href = url; a.hidden = false; } else { a.hidden = true; }
  $('#pfSwitch').hidden = !hasOtherLine();
  box.hidden = false;
  $('#video').removeAttribute('controls');
}

const hasOtherLine = () =>
  CFG.apis.some((_, i) => i !== S.line && !S.dead.has(i));

async function switchLine() {
  const cur = S.line;
  for (let k = 1; k <= CFG.apis.length; k++) {
    const i = (cur + k) % CFG.apis.length;
    if (i === cur || S.dead.has(i)) continue;
    S.line = i;
    try {
      const d = await api({ ac: 'list' }, false);
      if (!d || !(d.class || d.list)) throw new Error('empty');
      closePlayer();
      S.cat = ''; S.kw = ''; S.cats = [];
      if ($('#q')) { $('#q').value = ''; $('#clr').hidden = true; }
      loadCats(); load(true);
      window.scrollTo({ top: 0 });
      return;
    } catch (_) {
      S.dead.add(i);
    }
  }
  S.line = cur;
  $('#pfWhy').textContent = '其它线路也连不上';
  $('#pfTip').textContent = '片源方可能在维护，过一会儿再试试';
  $('#pfSwitch').hidden = true;
}

const hideFallback = () => {
  clearTimeout(playTimer);
  $('#pfall').hidden = true;
  $('#video').setAttribute('controls', '');
};

let playTimer = null;

function src(url) {
  const video = $('#video');
  hideFallback();
  if (hls) { hls.destroy(); hls = null; }

  // 总超时兜底：到点还没播起来就给用户一个交代，绝不留黑屏。
  clearTimeout(playTimer);
  playTimer = setTimeout(() => {
    if (video.readyState < 2) {
      showFallback(url, '这条线路暂时打不开',
        '片源服务器连不上，可以换条线路或换一部试试');
    }
  }, 12000);
  video.oncanplay = () => clearTimeout(playTimer);

  // ⚠️ 顺序不能反：Chrome 对 m3u8 的 canPlayType 返回 "maybe"（其实播不好），
  // 先判它会导致 hls.js 永远用不上。只有 Safari/iOS 走原生。
  if (window.Hls?.isSupported()) {
    hls = new Hls({ maxBufferLength: 30 });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal) return;
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR && !hls._retried) {
        hls._retried = true; hls.startLoad(); return;
      }
      if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !hls._recovered) {
        hls._recovered = true; hls.recoverMediaError(); return;
      }
      showFallback(url, '这条线路暂时打不开',
        '片源服务器连不上，可以换一集或换一部试试；也可以复制地址用外部播放器看');
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.onerror = () => showFallback(url, '这条线路暂时打不开');
  } else {
    video.src = url;
    video.onerror = () => showFallback(url, '这条线路暂时打不开');
  }
  video.play().catch(() => {});
}

function closePlayer() {
  $('#pmask').hidden = true;
  hideFallback();
  document.body.style.overflow = '';
  const v = $('#video');
  v.pause(); v.removeAttribute('src'); v.load();
  if (hls) { hls.destroy(); hls = null; }
}

/* ── 事件 ───────────────────────────── */
document.addEventListener('click', e => {
  const cat = e.target.closest('.cat');
  if (cat) {
    const id = cat.dataset.id;
    if (id.startsWith('kw:')) { S.cat = id; S.kw = id.slice(3); }
    else { S.cat = id; S.kw = ''; }
    $('#q').value = ''; $('#clr').hidden = true;
    renderCats(); load(true); window.scrollTo({ top: 0 }); return;
  }


  const card = e.target.closest('.card');
  if (card) {
    const id = card.dataset.id;
    // 完全开放，点击即可播放
    play(id);
    return;
  }

  if (e.target.closest('#moreBtn')) { S.page++; load(); return; }

  const ep = e.target.closest('.ep');
  if (ep) { $$('.ep').forEach(x => x.classList.remove('on')); ep.classList.add('on'); src(ep.dataset.u); return; }

  if (e.target.closest('#pfSwitch')) { switchLine(); return; }

  if (e.target.closest('#pclose') || e.target === $('#pmask')) { closePlayer(); return; }

  if (e.target.closest('#clr')) { $('#q').value = ''; $('#clr').hidden = true; S.kw = ''; load(true); return; }

  if (e.target.closest('#menuBtn')) {
    const c = $('#cats');
    const open = c.classList.toggle('open');
    e.target.closest('#menuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#pmask').hidden) closePlayer(); });



let timer;
$('#q').addEventListener('input', e => {
  $('#clr').hidden = !e.target.value;
  clearTimeout(timer);
  timer = setTimeout(() => { S.kw = e.target.value.trim(); S.cat = ''; renderCats(); load(true); }, 420);
});
$('#searchForm').addEventListener('submit', e => e.preventDefault());

/* ── 启动 ───────────────────────────── */
$('#app').innerHTML = skeleton();
loadCats();
load(true);
