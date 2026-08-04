/**
 * Hollow Art - 树洞重绘 v0.4.0
 * 详情页双栏 + 动画过渡 + 无限滚动修复
 */
(function() {
  'use strict';

  const waitForAPI = () => new Promise(r => {
    if (window.TreeholeAPI) r();
    else setTimeout(() => waitForAPI().then(r), 100);
  });

  let currentPage = 1, isLoading = false;
  let viewMode = localStorage.getItem('ha-view') || 'masonry';

  async function init() {
    await waitForAPI();
    hideOriginalUI();
    injectStyles();
    createApp();
    loadPosts(1);
  }

  function hideOriginalUI() {
    const s = document.createElement('style');
    s.textContent = `.app-wrapper{display:none!important}`;
    document.head.appendChild(s);
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* 灯箱 */
      .ha-lightbox{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.92);z-index:9999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s}
      .ha-lightbox.ha-show{opacity:1}
      .ha-lightbox img{max-width:90vw;max-height:90vh;object-fit:contain;border-radius:4px}
      .ha-lightbox-close{position:absolute;top:16px;right:24px;color:#fff;font-size:28px;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.15)}
      .ha-lightbox-close:hover{background:rgba(255,255,255,.3)}

      /* 详情页 */
      .ha-detail-overlay{
        position:fixed;top:0;left:0;width:100vw;height:100vh;
        background:#f0f0f0;z-index:9999998;overflow-y:auto;
        opacity:0;pointer-events:none;transition:opacity .3s ease;
      }
      .ha-detail-overlay.ha-show{opacity:1;pointer-events:auto}
      .ha-detail-layout{
        display:flex;gap:0;max-width:1200px;margin:0 auto;
        min-height:100vh;
      }
      .ha-detail-left{flex:0 0 45%;max-width:45%;padding:24px;border-right:1px solid #e0e0e0;background:#fff}
      .ha-detail-right{flex:1;padding:24px;overflow-y:auto}
      .ha-detail-back{
        position:fixed;top:16px;left:16px;z-index:10;
        width:36px;height:36px;display:flex;align-items:center;justify-content:center;
        border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);
        cursor:pointer;font-size:18px;color:#333;transition:all .15s;
      }
      .ha-detail-back:hover{box-shadow:0 4px 12px rgba(0,0,0,.18)}

      /* 帖子内容 */
      .ha-detail-post-card{margin-bottom:20px}
      .ha-detail-post-content{
        font-size:15px;line-height:1.75;color:#333;white-space:pre-wrap;
        word-break:break-word;margin-bottom:16px;
      }
      .ha-detail-images{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
      .ha-detail-images img{max-width:220px;max-height:220px;border-radius:6px;cursor:pointer;object-fit:cover;transition:transform .15s}
      .ha-detail-images img:hover{transform:scale(1.02)}

      /* 帖子详情信息 */
      .ha-detail-meta{background:#fafafa;border-radius:8px;padding:14px 16px}
      .ha-detail-meta-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0}
      .ha-detail-meta-row:last-child{border-bottom:none}
      .ha-detail-meta-label{color:#999}
      .ha-detail-meta-value{font-weight:500;color:#333}

      /* 评论区标题 */
      .ha-detail-comments-header{
        font-size:15px;font-weight:600;color:#333;
        padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #eee;
      }

      /* 评论卡片 */
      .ha-comment{
        background:#fff;border-radius:8px;padding:12px 14px;
        margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.04);
        border-left:3px solid #e0e0e0;
      }
      .ha-comment.ha-comment-lz{border-left-color:#4CAF50}
      .ha-comment-meta{display:flex;align-items:center;gap:6px;margin-bottom:5px}
      .ha-comment-user{font-weight:500;color:#4CAF50;font-size:13px}
      .ha-comment-time{color:#999;font-size:11px}
      .ha-comment-content{font-size:13px;color:#444;line-height:1.5}
      .ha-comment-reply-to{
        font-size:11px;color:#999;margin-bottom:4px;
        padding:4px 8px;background:#f9f9f9;border-radius:4px;
      }
      .ha-comment-children{margin-left:20px;margin-top:8px}
      .ha-comments-loading{text-align:center;padding:20px;color:#999;font-size:13px}
      .ha-comments-more{text-align:center;padding:14px;color:#4CAF50;cursor:pointer;font-size:13px}
      .ha-comments-more:hover{text-decoration:underline}

      /* 瀑布流 */
      .ha-masonry{columns:3;column-gap:12px}
      .ha-masonry .ha-post{break-inside:avoid;margin-bottom:12px}
      .ha-single .ha-post{margin-bottom:12px}

      /* 帖子卡片 */
      .ha-post{
        background:#fff;border-radius:8px;padding:14px;
        box-shadow:0 1px 3px rgba(0,0,0,.05);cursor:pointer;
        transition:box-shadow .15s,transform .15s;
      }
      .ha-post:hover{box-shadow:0 3px 10px rgba(0,0,0,.1)}
      .ha-post-header{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap}
      .ha-pid{font-weight:600;color:#4CAF50;font-size:13px}
      .ha-time{color:#999;font-size:11px}
      .ha-tag{padding:1px 6px;background:#e8f5e9;color:#4CAF50;border-radius:6px;font-size:10px}
      .ha-tag.ha-top{background:#fff3e0;color:#ff9800}
      .ha-post-content{
        font-size:13px;line-height:1.55;color:#333;white-space:pre-wrap;
        word-break:break-word;display:-webkit-box;-webkit-line-clamp:5;
        -webkit-box-orient:vertical;overflow:hidden;
      }
      .ha-post-images{display:flex;gap:4px;margin-top:8px;flex-wrap:wrap}
      .ha-image{width:100px;height:100px;border-radius:4px;object-fit:cover;background:#f0f0f0;cursor:pointer}
      .ha-post-footer{display:flex;gap:14px;margin-top:8px;padding-top:8px;border-top:1px solid #f5f5f5}
      .ha-stat{color:#888;font-size:12px}

      /* 头部 */
      #hollow-art{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#f0f0f0;z-index:999999;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
      .ha-header{position:sticky;top:0;background:#fff;padding:10px 20px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:16px;z-index:10}
      .ha-header h1{font-size:17px;margin:0;color:#333;white-space:nowrap}
      .ha-nav{display:flex;gap:5px}
      .ha-btn{padding:4px 12px;border:1px solid #ddd;border-radius:14px;background:#fff;cursor:pointer;font-size:12px;transition:all .15s}
      .ha-btn:hover{border-color:#4CAF50;color:#4CAF50}
      .ha-btn.ha-active{background:#4CAF50;color:#fff;border-color:#4CAF50}
      .ha-view-toggle{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;font-size:18px;color:#666;transition:all .15s}
      .ha-view-toggle:hover{background:#f0f0f0;color:#333}
      .ha-search{margin-left:auto;display:flex;gap:5px}
      .ha-search input{padding:4px 10px;border:1px solid #ddd;border-radius:14px;width:150px;font-size:12px;outline:none}
      .ha-search input:focus{border-color:#4CAF50}
      .ha-search button{padding:4px 12px;background:#4CAF50;color:#fff;border:none;border-radius:14px;cursor:pointer;font-size:12px}
      .ha-content{max-width:1100px;margin:16px auto;padding:0 12px}
      .ha-single{max-width:700px}
      .ha-loading,.ha-error{text-align:center;padding:30px;color:#999;font-size:13px}
      .ha-error{color:#f44336}
      .ha-load-more{text-align:center;padding:12px;color:#4CAF50;cursor:pointer;font-size:13px}
      .ha-load-more:hover{text-decoration:underline}

      /* 响应式 */
      @media(max-width:900px){.ha-detail-layout{flex-direction:column}.ha-detail-left{flex:none;max-width:100%;border-right:none;border-bottom:1px solid #e0e0e0}.ha-masonry{columns:2}}
      @media(max-width:600px){.ha-masonry{columns:1}.ha-detail-left,.ha-detail-right{padding:16px}}
    `;
    document.head.appendChild(s);
  }

  function createApp() {
    const app = document.createElement('div');
    app.id = 'hollow-art';
    app.innerHTML = `
      <div class="ha-header">
        <h1>🌳 Hollow Art</h1>
        <div class="ha-nav">
          <button class="ha-btn ha-active" data-tab="latest">最新</button>
          <button class="ha-btn" data-tab="followed">关注</button>
          <button class="ha-btn" data-tab="bounty">悬赏</button>
        </div>
        <div class="ha-view-toggle" id="ha-view-toggle" title="切换视图">
          <span class="ha-vt-icon">${viewMode==='masonry'?'▦':'▤'}</span>
        </div>
        <div class="ha-search">
          <input type="text" placeholder="搜索..." id="ha-search-input">
          <button id="ha-search-btn">搜索</button>
        </div>
      </div>
      <div class="ha-content ${viewMode==='masonry'?'ha-masonry':'ha-single'}" id="ha-posts"></div>
    `;
    document.body.appendChild(app);

    // 视图切换
    document.getElementById('ha-view-toggle').addEventListener('click', () => {
      viewMode = viewMode==='masonry'?'single':'masonry';
      localStorage.setItem('ha-view', viewMode);
      document.getElementById('ha-posts').className = `ha-content ${viewMode==='masonry'?'ha-masonry':'ha-single'}`;
      document.querySelector('.ha-vt-icon').textContent = viewMode==='masonry'?'▦':'▤';
    });

    // Tab
    app.querySelectorAll('.ha-btn').forEach(b => b.addEventListener('click', () => {
      app.querySelectorAll('.ha-btn').forEach(x => x.classList.remove('ha-active'));
      b.classList.add('ha-active');
      currentPage = 1; loadPosts(1);
    }));

    // 搜索
    let t;
    document.getElementById('ha-search-input').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { if (e.target.value.trim()) searchPosts(e.target.value.trim()); }, 400);
    });
    document.getElementById('ha-search-btn').addEventListener('click', () => {
      const q = document.getElementById('ha-search-input').value.trim();
      if (q) searchPosts(q);
    });

    // 无限滚动 — 挂在 #hollow-art 上
    const scrollEl = document.getElementById('hollow-art');
    scrollEl.addEventListener('scroll', () => {
      if (isLoading) return;
      if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 400) loadMore();
    });
  }

  // ===== 帖子加载 =====
  async function loadPosts(page) {
    if (isLoading) return;
    isLoading = true;
    const c = document.getElementById('ha-posts');
    if (page === 1) c.innerHTML = '<div class="ha-loading">加载中...</div>';
    try {
      const { posts, hasMore } = await TreeholeAPI.getPosts(page, 15);
      if (page === 1) c.innerHTML = '';
      renderPosts(posts);
      currentPage = page;
      if (hasMore) c.insertAdjacentHTML('beforeend', '<div class="ha-load-more" id="ha-load-trigger"></div>');
    } catch(e) { c.innerHTML = `<div class="ha-error">${e.message}</div>`; }
    isLoading = false;
  }

  async function loadMore() {
    document.getElementById('ha-load-trigger')?.remove();
    await loadPosts(currentPage + 1);
  }

  async function searchPosts(q) {
    const c = document.getElementById('ha-posts');
    c.innerHTML = '<div class="ha-loading">搜索中...</div>';
    try {
      const { posts } = await TreeholeAPI.search(q, 1, 30);
      c.innerHTML = '';
      posts.length ? renderPosts(posts) : (c.innerHTML = '<div class="ha-loading">无结果</div>');
    } catch(e) { c.innerHTML = `<div class="ha-error">${e.message}</div>`; }
  }

  // ===== 渲染帖子 =====
  function renderPosts(posts) {
    const c = document.getElementById('ha-posts');
    const frag = document.createDocumentFragment();
    posts.forEach(post => {
      const el = document.createElement('div');
      el.className = 'ha-post';
      el.dataset.pid = post.pid;
      const imgs = post.images.length > 0
        ? `<div class="ha-post-images" data-ids='${JSON.stringify(post.images.map(i=>i.id))}'></div>` : '';
      el.innerHTML = `
        <div class="ha-post-header">
          <span class="ha-pid">#${post.pid}</span><span class="ha-time">${post.time}</span>
          ${post.is_top?'<span class="ha-tag ha-top">置顶</span>':''}
          ${post.tags.map(t=>`<span class="ha-tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="ha-post-content">${esc(post.content)}</div>
        ${imgs}
        <div class="ha-post-footer">
          <span class="ha-stat">💬 ${post.comment_num}</span>
          <span class="ha-stat">⭐ ${post.like_num}</span>
          <span class="ha-stat">🔄 ${post.share_num}</span>
        </div>`;
      el.addEventListener('click', e => { if (!e.target.closest('.ha-image')) openDetail(post, el); });
      frag.appendChild(el);
    });
    c.appendChild(frag);
    loadAllImages();
  }

  async function loadAllImages() {
    const phs = document.querySelectorAll('.ha-post-images:not([data-done])');
    await Promise.all(Array.from(phs).map(async el => {
      el.dataset.done = '1';
      try {
        const ids = JSON.parse(el.dataset.ids);
        const urls = await Promise.all(ids.slice(0,3).map(id => TreeholeAPI.getImage(id)));
        urls.forEach(url => {
          const img = document.createElement('img');
          img.src = url; img.className = 'ha-image'; img.loading = 'lazy';
          img.addEventListener('click', e => { e.stopPropagation(); openLightbox(url); });
          el.appendChild(img);
        });
      } catch(e) {}
    }));
  }

  // ===== 灯箱 =====
  function openLightbox(url) {
    const lb = document.createElement('div');
    lb.className = 'ha-lightbox';
    lb.innerHTML = `<div class="ha-lightbox-close">✕</div><img src="${url}">`;
    lb.addEventListener('click', () => { lb.classList.remove('ha-show'); setTimeout(()=>lb.remove(),250); });
    document.body.appendChild(lb);
    requestAnimationFrame(() => lb.classList.add('ha-show'));
  }

  // ===== 详情页（双栏布局 + 动画过渡）=====
  async function openDetail(post, sourceEl) {
    // 1. 获取原帖位置
    const rect = sourceEl.getBoundingClientRect();

    // 2. 创建飞入动画元素
    const flyer = sourceEl.cloneNode(true);
    flyer.style.cssText = `
      position:fixed;top:${rect.top}px;left:${rect.left}px;
      width:${rect.width}px;height:${rect.height}px;
      z-index:99999999;transition:all .35s cubic-bezier(.4,0,.2,1);
      pointer-events:none;border-radius:8px;
    `;
    document.body.appendChild(flyer);
    sourceEl.style.opacity = '0.3';

    // 3. 创建详情页
    const overlay = document.createElement('div');
    overlay.className = 'ha-detail-overlay';
    overlay.innerHTML = `
      <div class="ha-detail-back">←</div>
      <div class="ha-detail-layout">
        <div class="ha-detail-left">
          <div class="ha-detail-post-card">
            <div class="ha-post-header">
              <span class="ha-pid">#${post.pid}</span><span class="ha-time">${post.time}</span>
              ${post.tags.map(t=>`<span class="ha-tag">${esc(t)}</span>`).join('')}
            </div>
            <div class="ha-detail-post-content">${esc(post.content)}</div>
            <div class="ha-detail-images" id="ha-d-imgs"></div>
          </div>
          <div class="ha-detail-meta">
            <div class="ha-detail-meta-row"><span class="ha-detail-meta-label">发布时间</span><span class="ha-detail-meta-value">${post.timestamp ? new Date(post.timestamp).toLocaleString('zh-CN') : post.time}</span></div>
            <div class="ha-detail-meta-row"><span class="ha-detail-meta-label">💬 评论</span><span class="ha-detail-meta-value">${post.comment_num}</span></div>
            <div class="ha-detail-meta-row"><span class="ha-detail-meta-label">⭐ 收藏</span><span class="ha-detail-meta-value">${post.like_num}</span></div>
            <div class="ha-detail-meta-row"><span class="ha-detail-meta-label">🔄 转发</span><span class="ha-detail-meta-value">${post.share_num}</span></div>
            <div class="ha-detail-meta-row"><span class="ha-detail-meta-label">PID</span><span class="ha-detail-meta-value">${post.pid}</span></div>
          </div>
        </div>
        <div class="ha-detail-right">
          <div class="ha-detail-comments-header">💬 评论 (${post.comment_num})</div>
          <div id="ha-d-cmts"><div class="ha-comments-loading">加载中...</div></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.ha-detail-back').addEventListener('click', () => closeDetail(overlay, flyer, sourceEl));

    // 4. 动画：原帖飞到左上角 → 详情淡入
    requestAnimationFrame(() => {
      flyer.style.top = '0px';
      flyer.style.left = '0px';
      flyer.style.width = '100vw';
      flyer.style.height = '100vh';
      flyer.style.borderRadius = '0';
      flyer.style.opacity = '0';
      overlay.classList.add('ha-show');
    });

    flyer.addEventListener('transitionend', () => flyer.remove(), { once: true });

    // 加载详情图
    if (post.images?.length > 0) {
      const imgC = overlay.querySelector('#ha-d-imgs');
      const urls = await Promise.all(post.images.map(i => TreeholeAPI.getImage(i.id)));
      urls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.addEventListener('click', () => openLightbox(url));
        imgC.appendChild(img);
      });
    }

    // 评论分页 + 滚动自动加载
    let cmtPage = 1, cmtLoading = false, cmtHasMore = true;
    const cmtContainer = overlay.querySelector('#ha-d-cmts');
    
    async function loadCmts(page) {
      if (cmtLoading || !cmtHasMore) return;
      cmtLoading = true;
      try {
        const { comments, hasMore } = await TreeholeAPI.getComments(post.pid, page, 15);
        if (page === 1) cmtContainer.innerHTML = '';
        cmtHasMore = hasMore;
        comments.forEach(cm => {
          cmtContainer.insertAdjacentHTML('beforeend', `
            <div class="ha-comment ${cm.is_lz?'ha-comment-lz':''}">
              <div class="ha-comment-meta">
                <span class="ha-comment-user">${esc(cm.name_tag||'匿名')}</span>
                <span class="ha-comment-time">${cm.time}</span>
                ${cm.is_lz?'<span class="ha-tag" style="background:#e8f5e9;color:#4CAF50">楼主</span>':''}
              </div>
              ${cm.reply_to?`<div class="ha-comment-reply-to">↩ 回复 #${cm.reply_to}</div>`:''}
              <div class="ha-comment-content">${esc(cm.content)}</div>
            </div>`);
        });
        if (hasMore) {
          cmtContainer.insertAdjacentHTML('beforeend', '<div class="ha-comments-more" id="ha-cmt-more">加载更多</div>');
          overlay.querySelector('#ha-cmt-more')?.addEventListener('click', function() {
            this.remove(); cmtPage++; loadCmts(cmtPage);
          });
        }
      } catch(e) {
        if (page === 1) cmtContainer.innerHTML = '<div class="ha-comments-loading">评论加载失败</div>';
      }
      cmtLoading = false;
    }
    loadCmts(1);

    // 右侧滚动自动加载评论
    const rightPanel = overlay.querySelector('.ha-detail-right');
    rightPanel.addEventListener('scroll', () => {
      if (cmtLoading || !cmtHasMore) return;
      if (rightPanel.scrollTop + rightPanel.clientHeight >= rightPanel.scrollHeight - 200) {
        cmtPage++;
        loadCmts(cmtPage);
      }
    });
  }

  function closeDetail(overlay, flyer, sourceEl) {
    overlay.classList.remove('ha-show');
    sourceEl.style.opacity = '1';
    if (flyer) {
      flyer.remove();
    }
    setTimeout(() => overlay.remove(), 300);
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
