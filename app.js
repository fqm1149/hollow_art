/**
 * Hollow Art v0.5.0
 * 平滑过渡 + 固定顶栏 + 评论瀑布流 + 搜索优化
 */
(function() {
  'use strict';

  const API = () => new Promise(r => {
    if (window.TreeholeAPI) r(); else setTimeout(() => API().then(r), 80);
  });

  let curPage = 1, loading = false;
  let view = localStorage.getItem('ha-v') || 'masonry';
  const VH = () => window.innerHeight;

  async function init() {
    await API();
    document.head.insertAdjacentHTML('beforeend',
      `<style>${CSS}</style>`);
    document.body.insertAdjacentHTML('beforeend', HTML());
    bindEvents();
    loadPosts(1);
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    // 视图切换
    $('#ha-view-btn').onclick = () => {
      view = view === 'masonry' ? 'single' : 'masonry';
      localStorage.setItem('ha-v', view);
      $('#ha-view-icon').textContent = view === 'masonry' ? '▦' : '▤';
      $('#ha-feed').className = view === 'masonry' ? 'ha-feed ha-col3' : 'ha-feed ha-col1';
    };

    // Tab
    $$('.ha-tab').forEach(b => b.onclick = () => {
      $$('.ha-tab').forEach(x => x.classList.remove('ha-on'));
      b.classList.add('ha-on');
      curPage = 1; loadPosts(1);
    });

    // 搜索：只响应回车和按钮
    const searchInput = $('#ha-search');
    const doSearch = () => {
      const q = searchInput.value.trim();
      if (!q) { goHome(); return; }
      searchPosts(q);
    };
    searchInput.onkeydown = e => { if (e.key === 'Enter') doSearch(); };
    $('#ha-search-btn').onclick = doSearch;

    // 无限滚动
    $('#ha-feed').addEventListener('scroll', () => {
      if (loading) return;
      const el = $('#ha-feed');
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) loadMore();
    });
  }

  function goHome() {
    document.querySelector('#ha-search').value = '';
    $$('.ha-tab').forEach(x => x.classList.remove('ha-on'));
    document.querySelector('.ha-tab').classList.add('ha-on');
    curPage = 1; loadPosts(1);
  }

  // ===== 帖子加载 =====
  async function loadPosts(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (page === 1) c.innerHTML = '<div class="ha-msg">加载中...</div>';
    try {
      const { posts, hasMore } = await TreeholeAPI.getPosts(page, 15);
      if (page === 1) c.innerHTML = '';
      renderFeed(posts);
      curPage = page;
      if (hasMore) c.insertAdjacentHTML('beforeend', '<div class="ha-more" id="ha-more">加载更多</div>');
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; }
    loading = false;
  }

  async function loadMore() {
    $('#ha-more')?.remove();
    await loadPosts(curPage + 1);
  }

  async function searchPosts(q) {
    const c = $('#ha-feed');
    c.innerHTML = '<div class="ha-msg">搜索中...</div>';
    try {
      const { posts } = await TreeholeAPI.search(q, 1, 30);
      c.innerHTML = '';
      posts.length ? renderFeed(posts) : (c.innerHTML = '<div class="ha-msg">无结果</div>');
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; }
  }

  // ===== 渲染首页帖子 =====
  function renderFeed(posts) {
    const c = $('#ha-feed');
    const frag = document.createDocumentFragment();
    posts.forEach(post => {
      const el = document.createElement('div');
      el.className = 'ha-card';
      el.dataset.pid = post.pid;
      const imgs = post.images.length > 0
        ? `<div class="ha-imgs" data-ids='${JSON.stringify(post.images.map(i=>i.id))}'></div>` : '';
      el.innerHTML = `
        <div class="ha-card-hd">
          <span class="ha-pid">#${post.pid}</span>
          <span class="ha-tm">${post.time}</span>
          ${post.is_top ? '<span class="ha-tag ha-top">置顶</span>' : ''}
          ${post.tags.map(t => `<span class="ha-tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="ha-card-bd">${esc(post.content)}</div>
        ${imgs}
        <div class="ha-card-ft">
          <span>💬 ${post.comment_num}</span>
          <span>⭐ ${post.like_num}</span>
          <span>🔄 ${post.share_num}</span>
        </div>`;
      el.onclick = e => { if (!e.target.closest('.ha-img')) openDetail(post, el); };
      frag.appendChild(el);
    });
    c.appendChild(frag);
    loadFeedImgs();
  }

  async function loadFeedImgs() {
    await Promise.all(Array.from(document.querySelectorAll('.ha-imgs:not([data-d])')).map(async el => {
      el.dataset.d = '1';
      try {
        const ids = JSON.parse(el.dataset.ids);
        const urls = await Promise.all(ids.slice(0, 3).map(id => TreeholeAPI.getImage(id)));
        urls.forEach(url => {
          const img = document.createElement('img');
          img.src = url; img.className = 'ha-img'; img.loading = 'lazy';
          img.onclick = e => { e.stopPropagation(); lightbox(url); };
          el.appendChild(img);
        });
      } catch (e) {}
    }));
  }

  // ===== 灯箱 =====
  function lightbox(url) {
    const lb = document.createElement('div');
    lb.className = 'ha-lb';
    lb.innerHTML = `<div class="ha-lb-x">✕</div><img src="${url}">`;
    lb.onclick = () => { lb.classList.remove('on'); setTimeout(() => lb.remove(), 200); };
    document.body.appendChild(lb);
    requestAnimationFrame(() => lb.classList.add('on'));
  }

  // ===== 详情页（平滑过渡）=====
  async function openDetail(post, sourceEl) {
    const rect = sourceEl.getBoundingClientRect();
    const feed = $('#ha-feed');
    const header = $('#ha-header');

    // 1. 飞入克隆体
    const flyer = sourceEl.cloneNode(true);
    flyer.style.cssText = `position:fixed;z-index:99999999;pointer-events:none;
      top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;
      transition:all .38s cubic-bezier(.22,1,.36,1);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.15);`;
    document.body.appendChild(flyer);
    sourceEl.style.opacity = '0.15';

    // 2. 创建详情页（隐藏）
    const detail = document.createElement('div');
    detail.id = 'ha-detail';
    detail.innerHTML = detailHTML(post);
    detail.style.opacity = '0';
    document.body.appendChild(detail);

    // 3. 动画：克隆体展开到全屏 → 详情页淡入
    requestAnimationFrame(() => {
      flyer.style.cssText += `top:0;left:0;width:100vw;height:100vh;border-radius:0;opacity:0;`;
      detail.style.opacity = '1';
      detail.style.transition = 'opacity .25s ease .15s';
    });

    flyer.ontransitionend = () => flyer.remove();

    // 4. 返回按钮
    detail.querySelector('.ha-back').onclick = () => closeDetail(detail, sourceEl);

    // 5. 加载详情图片
    if (post.images?.length > 0) {
      const ic = detail.querySelector('#ha-d-imgs');
      const urls = await Promise.all(post.images.map(i => TreeholeAPI.getImage(i.id)));
      urls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.onclick = () => lightbox(url);
        ic.appendChild(img);
      });
    }

    // 6. 内容区全屏按钮
    const contentBox = detail.querySelector('.ha-d-content-inner');
    const fsBtn = detail.querySelector('.ha-d-fs-btn');
    const contentWrap = detail.querySelector('.ha-d-content');
    fsBtn.onclick = () => {
      if (contentWrap.requestFullscreen) contentWrap.requestFullscreen();
      else if (contentWrap.webkitRequestFullscreen) contentWrap.webkitRequestFullscreen();
    };

    // 7. 评论瀑布流 + 滚动加载
    let cmtPage = 1, cmtLoading = false, cmtHasMore = true;
    const cmtGrid = detail.querySelector('#ha-d-cmts');
    const cmtScroll = detail.querySelector('.ha-d-right');

    async function loadCmts(page) {
      if (cmtLoading || !cmtHasMore) return;
      cmtLoading = true;
      const loadEl = detail.querySelector('.ha-cmt-loading');
      if (loadEl) loadEl.style.display = 'block';
      try {
        const { comments, hasMore } = await TreeholeAPI.getComments(post.pid, page, 12);
        cmtHasMore = hasMore;
        comments.forEach(cm => {
          const card = document.createElement('div');
          card.className = `ha-cmt${cm.is_lz ? ' ha-cmt-lz' : ''}`;
          card.innerHTML = `
            <div class="ha-cmt-hd">
              <span class="ha-cmt-id">#${cm.id}</span>
              <span class="ha-cmt-user">${esc(cm.name_tag || '匿名')}</span>
              <span class="ha-cmt-tm">${cm.time}</span>
              ${cm.is_lz ? '<span class="ha-tag" style="background:#e8f5e9;color:#4CAF50">楼主</span>' : ''}
            </div>
            ${cm.reply_to ? `<div class="ha-cmt-reply">↩ 回复 <a href="#cmt-${cm.reply_to}">#${cm.reply_to}</a></div>` : ''}
            <div class="ha-cmt-bd">${esc(cm.content)}</div>`;
          cmtGrid.appendChild(card);
        });
        if (!hasMore) { if (loadEl) loadEl.textContent = '没有更多了'; }
      } catch (e) {
        if (page === 1) cmtGrid.innerHTML = '<div class="ha-msg ha-err">评论加载失败</div>';
      }
      cmtLoading = false;
    }

    loadCmts(1);

    // 右侧滚动自动加载
    cmtScroll.addEventListener('scroll', () => {
      if (cmtLoading || !cmtHasMore) return;
      if (cmtScroll.scrollTop + cmtScroll.clientHeight >= cmtScroll.scrollHeight - 200) {
        cmtPage++; loadCmts(cmtPage);
      }
    });
  }

  function closeDetail(detail, sourceEl) {
    detail.style.opacity = '0';
    sourceEl.style.opacity = '1';
    setTimeout(() => detail.remove(), 300);
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ===== HTML 模板 =====
  function HTML() {
    return `
    <div id="ha-root">
      <header id="ha-header">
        <h1>🌳 Hollow Art</h1>
        <nav>
          <button class="ha-tab ha-on">最新</button>
          <button class="ha-tab">关注</button>
          <button class="ha-tab">悬赏</button>
        </nav>
        <button id="ha-view-btn" title="切换视图"><span id="ha-view-icon">${view === 'masonry' ? '▦' : '▤'}</span></button>
        <div class="ha-srch">
          <input id="ha-search" type="text" placeholder="搜索… (Enter)">
          <button id="ha-search-btn">搜索</button>
        </div>
      </header>
      <main id="ha-feed" class="ha-feed ${view === 'masonry' ? 'ha-col3' : 'ha-col1'}"></main>
    </div>`;
  }

  function detailHTML(post) {
    return `
    <div id="ha-detail">
      <header id="ha-header" style="position:sticky;top:0;z-index:100">
        <div class="ha-back">←</div>
        <h1>#${post.pid}</h1>
        <span style="color:#999;font-size:13px">${post.time}</span>
      </header>
      <div class="ha-d-layout">
        <div class="ha-d-left">
          <div class="ha-d-content">
            <button class="ha-d-fs-btn" title="全屏">⛶</button>
            <div class="ha-d-content-inner">
              <div class="ha-d-text">${esc(post.content)}</div>
              <div class="ha-d-imgs" id="ha-d-imgs"></div>
            </div>
          </div>
          <div class="ha-d-meta">
            <div class="ha-d-meta-row"><span>发布时间</span><span>${post.timestamp ? new Date(post.timestamp).toLocaleString('zh-CN') : post.time}</span></div>
            <div class="ha-d-meta-row"><span>💬 评论</span><span>${post.comment_num}</span></div>
            <div class="ha-d-meta-row"><span>⭐ 收藏</span><span>${post.like_num}</span></div>
            <div class="ha-d-meta-row"><span>🔄 转发</span><span>${post.share_num}</span></div>
            <div class="ha-d-meta-row"><span>PID</span><span>${post.pid}</span></div>
          </div>
        </div>
        <div class="ha-d-right">
          <div class="ha-d-r-hd">💬 评论 (${post.comment_num})</div>
          <div class="ha-cmt-grid" id="ha-d-cmts"></div>
          <div class="ha-cmt-loading">加载中...</div>
        </div>
      </div>
    </div>`;
  }

  // ===== CSS =====
  const CSS = `
    *{margin:0;padding:0;box-sizing:border-box}
    #ha-root{position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;flex-direction:column;background:#f0f0f0;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
    .app-wrapper{display:none!important}

    /* 顶栏 */
    #ha-header{flex-shrink:0;background:#fff;padding:8px 20px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:14px;z-index:100}
    #ha-header h1{font-size:16px;margin:0;color:#333;white-space:nowrap}
    nav{display:flex;gap:4px}
    .ha-tab{padding:4px 12px;border:1px solid #ddd;border-radius:12px;background:#fff;cursor:pointer;font-size:12px;transition:all .12s}
    .ha-tab:hover{border-color:#4CAF50;color:#4CAF50}
    .ha-tab.ha-on{background:#4CAF50;color:#fff;border-color:#4CAF50}
    #ha-view-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:16px;color:#666;background:#fff;transition:all .12s}
    #ha-view-btn:hover{background:#f5f5f5}
    .ha-srch{margin-left:auto;display:flex;gap:4px}
    .ha-srch input{padding:4px 10px;border:1px solid #ddd;border-radius:12px;width:160px;font-size:12px;outline:none}
    .ha-srch input:focus{border-color:#4CAF50}
    .ha-srch button{padding:4px 12px;background:#4CAF50;color:#fff;border:none;border-radius:12px;cursor:pointer;font-size:12px}

    /* 首页 feed */
    #ha-feed{flex:1;overflow-y:auto;padding:12px 16px}
    .ha-col3{max-width:1100px;margin:0 auto;columns:3;column-gap:10px}
    .ha-col1{max-width:700px;margin:0 auto}
    .ha-card{background:#fff;border-radius:8px;padding:12px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.05);cursor:pointer;transition:box-shadow .12s;break-inside:avoid}
    .ha-card:hover{box-shadow:0 3px 10px rgba(0,0,0,.1)}
    .ha-card-hd{display:flex;align-items:center;gap:5px;margin-bottom:6px;flex-wrap:wrap}
    .ha-pid{font-weight:600;color:#4CAF50;font-size:12px}
    .ha-tm{color:#999;font-size:10px}
    .ha-tag{padding:1px 5px;background:#e8f5e9;color:#4CAF50;border-radius:5px;font-size:10px}
    .ha-tag.ha-top{background:#fff3e0;color:#ff9800}
    .ha-card-bd{font-size:12px;line-height:1.5;color:#333;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
    .ha-imgs{display:flex;gap:3px;margin-top:6px;flex-wrap:wrap}
    .ha-img{width:90px;height:90px;border-radius:4px;object-fit:cover;background:#f0f0f0;cursor:pointer}
    .ha-card-ft{display:flex;gap:12px;margin-top:6px;padding-top:6px;border-top:1px solid #f5f5f5;color:#888;font-size:11px}
    .ha-msg{text-align:center;padding:30px;color:#999;font-size:13px}
    .ha-err{color:#f44336}
    .ha-more{text-align:center;padding:10px;color:#4CAF50;cursor:pointer;font-size:12px}
    .ha-more:hover{text-decoration:underline}

    /* 灯箱 */
    .ha-lb{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.92);z-index:99999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
    .ha-lb.on{opacity:1}
    .ha-lb img{max-width:92vw;max-height:92vh;object-fit:contain;border-radius:4px}
    .ha-lb-x{position:absolute;top:14px;right:20px;color:#fff;font-size:26px;cursor:pointer;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.15)}
    .ha-lb-x:hover{background:rgba(255,255,255,.3)}

    /* 详情页 */
    #ha-detail{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#f0f0f0;z-index:9999998;display:flex;flex-direction:column}
    .ha-back{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:18px;color:#333;transition:background .12s}
    .ha-back:hover{background:#f0f0f0}
    .ha-d-layout{flex:1;display:flex;overflow:hidden}
    .ha-d-left{flex:0 0 42%;max-width:42%;overflow-y:auto;padding:20px;border-right:1px solid #e0e0e0;background:#fff}
    .ha-d-right{flex:1;overflow-y:auto;padding:20px;background:#fafafa}

    /* 内容区 + 全屏 */
    .ha-d-content{position:relative;background:#fff;border-radius:8px;border:1px solid #eee;overflow:hidden}
    .ha-d-content-inner{max-height:calc(100vh - 300px);overflow-y:auto;padding:16px}
    .ha-d-fs-btn{position:absolute;top:6px;right:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;border-radius:4px;background:rgba(0,0,0,.06);cursor:pointer;font-size:14px;z-index:2;transition:background .12s}
    .ha-d-fs-btn:hover{background:rgba(0,0,0,.12)}
    .ha-d-text{font-size:14px;line-height:1.7;color:#333;white-space:pre-wrap;word-break:break-word}
    .ha-d-imgs{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .ha-d-imgs img{max-width:200px;max-height:200px;border-radius:6px;cursor:pointer;object-fit:cover;transition:transform .12s}
    .ha-d-imgs img:hover{transform:scale(1.02)}

    /* 元数据 */
    .ha-d-meta{margin-top:14px;background:#fafafa;border-radius:8px;padding:12px 14px}
    .ha-d-meta-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #f0f0f0}
    .ha-d-meta-row:last-child{border-bottom:none}

    /* 评论瀑布流 */
    .ha-d-r-hd{font-size:14px;font-weight:600;color:#333;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid #eee}
    .ha-cmt-grid{columns:2;column-gap:10px}
    .ha-cmt{background:#fff;border-radius:8px;padding:10px 12px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.04);break-inside:avoid;border-left:3px solid #e0e0e0}
    .ha-cmt-lz{border-left-color:#4CAF50}
    .ha-cmt-hd{display:flex;align-items:center;gap:5px;margin-bottom:4px;flex-wrap:wrap}
    .ha-cmt-id{font-weight:600;color:#999;font-size:10px;font-family:monospace}
    .ha-cmt-user{font-weight:500;color:#4CAF50;font-size:12px}
    .ha-cmt-tm{color:#999;font-size:10px}
    .ha-cmt-reply{font-size:10px;color:#999;margin-bottom:3px}
    .ha-cmt-reply a{color:#4CAF50;text-decoration:none}
    .ha-cmt-reply a:hover{text-decoration:underline}
    .ha-cmt-bd{font-size:12px;color:#444;line-height:1.45}
    .ha-cmt-loading{text-align:center;padding:16px;color:#999;font-size:12px}

    @media(max-width:900px){.ha-d-layout{flex-direction:column}.ha-d-left{flex:none;max-width:100%;border-right:none;border-bottom:1px solid #e0e0e0;max-height:50vh}.ha-cmt-grid{columns:1}}
    @media(max-width:600px){.ha-col3{columns:1}.ha-d-left,.ha-d-right{padding:14px}}
  `;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
