/**
 * Hollow Art v0.9.0
 * 评论拓扑视图 + 帖号引用检测器
 */
(function() {
  'use strict';

  const API = () => new Promise(r => {
    if (window.TreeholeAPI) r(); else setTimeout(() => API().then(r), 80);
  });

  let curPage = 1, loading = false;
  let curTab = 'latest';
  let searchMode = false, searchQuery = '';
  let view = localStorage.getItem('ha-v') || 'masonry';
  let cols = parseInt(localStorage.getItem('ha-cols') || '3');
  let accent = localStorage.getItem('ha-accent') || '#4CAF50';
  let dark = localStorage.getItem('ha-dark') === '1';

  // 帖子栈（用于引用跳转）
  let postStack = [];

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  let feedObserver = null;

  async function init() {
    await API();
    applyTheme();
    document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`);
    document.body.insertAdjacentHTML('beforeend', buildHTML());
    bindEvents();
    initFeedObserver();
    initRefHandlers();
    loadTabPosts(1);
  }

  function applyTheme() {
    document.documentElement.style.setProperty('--ha-accent', accent);
    document.documentElement.classList.toggle('ha-dark', dark);
  }

  function initFeedObserver() {
    feedObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading) loadMore();
    }, { rootMargin: '0px 0px 200px 0px' });

    document.addEventListener('wheel', e => {
      if (view !== 'masonry') return;
      if (document.getElementById('ha-detail')) return;
      const feed = $('#ha-feed');
      if (!feed || feed.scrollWidth <= feed.clientWidth) return;
      e.preventDefault();
      feed.scrollLeft += e.deltaY;
    }, { passive: false });
  }

  function observeSentinel() {
    feedObserver?.disconnect();
    const sentinel = $('#ha-sentinel');
    if (sentinel) feedObserver?.observe(sentinel);
  }

  function bindEvents() {
    document.addEventListener('click', e => {
      const tab = e.target.closest('.ha-tab');
      if (tab) {
        $$('.ha-tab').forEach(x => x.classList.remove('ha-on'));
        tab.classList.add('ha-on');
        curTab = tab.dataset.tab;
        searchMode = false;
        searchQuery = '';
        $('#ha-search').value = '';
        curPage = 1;
        loadTabPosts(1);
      }
    });

    $('#ha-view-btn').onclick = () => {
      view = view === 'masonry' ? 'single' : 'masonry';
      localStorage.setItem('ha-v', view);
      $('#ha-view-icon').textContent = view === 'masonry' ? '▦' : '▤';
      updateFeedClass();
    };

    $('#ha-cols').oninput = e => {
      cols = parseInt(e.target.value);
      localStorage.setItem('ha-cols', cols);
      $('#ha-cols-val').textContent = cols;
      updateFeedClass();
    };

    $('#ha-accent').oninput = e => {
      accent = e.target.value;
      localStorage.setItem('ha-accent', accent);
      applyTheme();
    };

    $('#ha-dark-btn').onclick = () => {
      dark = !dark;
      localStorage.setItem('ha-dark', dark ? '1' : '0');
      applyTheme();
      $('#ha-dark-btn').textContent = dark ? '☀' : '🌙';
    };

    const si = $('#ha-search');
    const doSearch = () => {
      const q = si.value.trim();
      if (!q) { goHome(); return; }
      searchPosts(q);
    };
    si.onkeydown = e => { if (e.key === 'Enter') doSearch(); };
    $('#ha-search-btn').onclick = doSearch;
  }

  async function searchPosts(q) {
    searchMode = true;
    searchQuery = q;
    curPage = 1;
    await loadSearchResults(1);
  }

  function updateFeedClass() {
    const feed = $('#ha-feed');
    if (!feed) return;
    feed.className = view === 'masonry' ? 'ha-feed ha-masonry' : 'ha-feed';
    feed.style.setProperty('--ha-cols', cols);
  }

  function goHome() {
    $('#ha-search').value = '';
    $$('.ha-tab').forEach(x => x.classList.remove('ha-on'));
    $('.ha-tab').classList.add('ha-on');
    curTab = 'latest';
    searchMode = false;
    searchQuery = '';
    curPage = 1;
    postStack = [];
    loadTabPosts(1);
  }

  async function loadTabPosts(page) {
    if (searchMode) return loadSearchResults(page);
    if (curTab === 'followed') return loadFollowed(page);
    if (curTab === 'bounty') return loadBounty(page);
    return loadPosts(page);
  }

  async function loadSearchResults(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) { c.style.opacity = '0'; c.innerHTML = skeleton(); }
    try {
      const { posts, hasMore } = await TreeholeAPI.search(searchQuery, page, 20);
      if (page === 1) c.innerHTML = '';
      if (posts.length === 0 && page === 1) {
        c.innerHTML = '<div class="ha-msg">无结果</div>';
      } else {
        renderFeed(posts);
        curPage = page;
        insertSentinel(c, hasMore);
      }
      c.style.opacity = '1';
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; c.style.opacity = '1'; }
    loading = false;
  }

  function skeleton(n = 6) {
    return Array(n).fill('<div class="ha-skeleton"><div class="sk-line"></div><div class="sk-line sk-short"></div><div class="sk-line sk-tiny"></div></div>').join('');
  }

  async function loadPosts(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) { c.style.opacity = '0'; c.innerHTML = skeleton(); }
    try {
      const { posts, hasMore } = await TreeholeAPI.getPosts(page, 15);
      if (page === 1) c.innerHTML = '';
      renderFeed(posts);
      curPage = page;
      insertSentinel(c, hasMore);
      c.style.opacity = '1';
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; c.style.opacity = '1'; }
    loading = false;
  }

  async function loadFollowed(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) { c.style.opacity = '0'; c.innerHTML = skeleton(); }
    try {
      const { posts, hasMore } = await TreeholeAPI.getFollowed(page, 15);
      if (page === 1) c.innerHTML = '';
      if (posts.length === 0 && page === 1) c.innerHTML = '<div class="ha-msg">还没有关注的帖子</div>';
      else { renderFeed(posts); curPage = page; insertSentinel(c, hasMore); }
      c.style.opacity = '1';
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; c.style.opacity = '1'; }
    loading = false;
  }

  async function loadBounty(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) { c.style.opacity = '0'; c.innerHTML = skeleton(); }
    try {
      const { posts, hasMore } = await TreeholeAPI.getBounty(page, 15);
      if (page === 1) c.innerHTML = '';
      if (posts.length === 0 && page === 1) c.innerHTML = '<div class="ha-msg">暂无悬赏帖子</div>';
      else { renderFeed(posts); curPage = page; insertSentinel(c, hasMore); }
      c.style.opacity = '1';
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; c.style.opacity = '1'; }
    loading = false;
  }

  function insertSentinel(container, hasMore) {
    container.querySelectorAll('#ha-sentinel').forEach(el => el.remove());
    if (hasMore) {
      container.insertAdjacentHTML('beforeend', '<div id="ha-sentinel"></div>');
      observeSentinel();
    }
  }

  async function loadMore() {
    $('#ha-sentinel')?.remove();
    await loadTabPosts(curPage + 1);
  }

  // ===== 图片懒加载 =====
  let imgObserver = null;
  function initImgObserver() {
    if (imgObserver) return;
    imgObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { loadSingleImg(entry.target); imgObserver.unobserve(entry.target); }
      });
    }, { rootMargin: '200px' });
  }

  async function loadSingleImg(el) {
    if (el.dataset.d) return;
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
  }

  function loadFeedImgs() {
    initImgObserver();
    document.querySelectorAll('.ha-imgs:not([data-d])').forEach(el => imgObserver.observe(el));
  }

  function renderFeed(posts) {
    const c = $('#ha-feed');
    const frag = document.createDocumentFragment();
    posts.forEach((post, i) => {
      const el = document.createElement('div');
      el.className = 'ha-card';
      el.dataset.pid = post.pid;
      el.style.animationDelay = `${i * 30}ms`;
      const imgs = post.images.length > 0
        ? `<div class="ha-imgs" data-ids='${JSON.stringify(post.images.map(im=>im.id))}'></div>` : '';
      el.innerHTML = `
        <div class="ha-card-hd">
          <span class="ha-pid">#${post.pid}</span>
          <span class="ha-tm">${post.time}</span>
          ${post.is_top ? '<span class="ha-tag ha-top">置顶</span>' : ''}
          ${post.tags.map(t => `<span class="ha-tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="ha-card-bd">${linkifyRefs(esc(post.content))}</div>
        ${imgs}
        <div class="ha-card-ft">
          <span>💬 ${post.comment_num}</span>
          <span>⭐ ${post.like_num}</span>
        </div>`;
      el.onclick = e => { if (!e.target.closest('.ha-img') && !e.target.closest('.ha-ref')) openDetail(post); };
      frag.appendChild(el);
    });
    c.appendChild(frag);
    loadFeedImgs();
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

  // ===== 智能定位预览浮窗 =====
  function positionPreview(preview, mouseX, mouseY) {
    const PW = 320, PH = 150; // 预估浮窗尺寸
    const VW = window.innerWidth, VH = window.innerHeight;
    let x = mouseX + 12, y = mouseY - PH - 8; // 默认在鼠标上方

    // 上方放不下 → 放下方
    if (y < 0) y = mouseY + 16;
    // 右边放不下 → 左移
    if (x + PW > VW) x = VW - PW - 12;
    // 左边放不下 → 右移
    if (x < 0) x = 12;
    // 下方放不下 → 上移
    if (y + PH > VH) y = VH - PH - 12;

    preview.style.position = 'fixed';
    preview.style.left = x + 'px';
    preview.style.top = y + 'px';
    preview.style.zIndex = '99999999';
  }

  // ===== 帖号引用检测器 =====
  function linkifyRefs(text) {
    return text.replace(/#(\d{7})/g, '<span class="ha-ref" data-pid="$1">#$1</span>');
  }

  // 事件委托：统一处理引用的悬停和点击
  function initRefHandlers() {
    let lastMouseX = 0, lastMouseY = 0;
    document.addEventListener('mousemove', e => {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    // 悬停预览
    document.addEventListener('mouseenter', e => {
      if (!(e.target instanceof Element)) return;
      const ref = e.target.closest('.ha-ref');
      if (!ref) return;
      const pid = ref.dataset.pid;
      ref._timer = setTimeout(async () => {
        try {
          const post = await TreeholeAPI.getPost(parseInt(pid));
          const preview = document.createElement('div');
          preview.className = 'ha-ref-preview';
          preview.innerHTML = `
            <div class="ha-ref-preview-hd">
              <span class="ha-pid">#${post.pid}</span>
              <span class="ha-tm">${post.time}</span>
            </div>
            <div class="ha-ref-preview-bd">${esc(post.content?.substring(0, 200))}</div>
            <div class="ha-ref-preview-cmt">💬 ${post.comment_num} ⭐ ${post.like_num}</div>`;
          document.body.appendChild(preview);
          ref._preview = preview;
          // 智能定位
          positionPreview(preview, lastMouseX, lastMouseY);
        } catch (e) {}
      }, 300);
    }, true);

    // 鼠标离开取消预览
    document.addEventListener('mouseleave', e => {
      if (!(e.target instanceof Element)) return;
      const ref = e.target.closest('.ha-ref');
      if (ref) {
        clearTimeout(ref._timer);
        ref._preview?.remove();
        ref._preview = null;
      }
    }, true);

    // 点击跳转
    document.addEventListener('click', e => {
      const ref = e.target.closest('.ha-ref');
      if (!ref) return;
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(ref._timer);
      ref._preview?.remove();
      const pid = parseInt(ref.dataset.pid);
      if (pid) {
        TreeholeAPI.getPost(pid).then(post => openDetail(post, true)).catch(() => {});
      }
    }, true);
  }

  // ===== 详情页 =====
  async function openDetail(post, fromRef = false) {
    // 移除旧 detail（防止残留）
    const oldDetail = $('#ha-detail');
    if (oldDetail) oldDetail.remove();

    if (fromRef) {
      // 从引用跳转，当前帖子入栈
      const currentPid = parseInt(oldDetail?.querySelector('h1')?.textContent?.replace('#', ''));
      if (currentPid) postStack.push(currentPid);
    } else {
      postStack = []; // 从首页进入，清空栈
    }

    const detail = document.createElement('div');
    detail.id = 'ha-detail';
    let localCmtCols = parseInt(localStorage.getItem('ha-cmt-cols') || '2');

    // 用户颜色映射
    const userColorMap = {};
    const palette = ['#4CAF50','#2196F3','#FF9800','#9C27B0','#E91E63','#00BCD4','#795548','#607D8B','#F44336','#3F51B5'];
    function userColor(name) {
      if (userColorMap[name]) return userColorMap[name];
      let h = 0;
      for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
      userColorMap[name] = palette[Math.abs(h) % palette.length];
      return userColorMap[name];
    }

    detail.innerHTML = detailHTML(post, localCmtCols);
    detail.style.opacity = '0';
    document.body.appendChild(detail);
    requestAnimationFrame(() => { detail.style.opacity = '1'; });

    // 返回按钮（栈式返回）
    detail.querySelector('.ha-back').onclick = () => {
      if (postStack.length > 0) {
        // 返回上一个帖子：先淡出旧detail，等新detail就绪后再移除
        const prevPid = postStack.pop();
        detail.style.transition = 'opacity .2s';
        detail.style.opacity = '0';
        TreeholeAPI.getPost(prevPid).then(p => {
          detail.remove();
          openDetail(p, false);
        });
      } else {
        // 返回首页：淡出
        detail.style.transition = 'opacity .2s';
        detail.style.opacity = '0';
        setTimeout(() => detail.remove(), 200);
      }
    };

    // 图片
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

    // 全屏
    detail.querySelector('.ha-d-fs-btn').onclick = () => {
      const box = detail.querySelector('.ha-d-content');
      if (box.requestFullscreen) box.requestFullscreen();
    };

    // 收藏按钮
    const starBtn = detail.querySelector('#ha-star-btn');
    if (starBtn) {
      starBtn.onclick = async () => {
        starBtn.disabled = true;
        try {
          await TreeholeAPI.attention(post.pid);
          post.is_follow = !post.is_follow;
          post.like_num += post.is_follow ? 1 : -1;
          starBtn.textContent = (post.is_follow ? '★ ' : '☆ ') + post.like_num;
          starBtn.title = post.is_follow ? '取消收藏' : '收藏';
        } catch (e) {
          console.error('收藏失败:', e);
        }
        starBtn.disabled = false;
      };
    }

    // 评论栏数
    const cmtColsSlider = detail.querySelector('#ha-cmt-cols');
    const cmtGrid = detail.querySelector('#ha-d-cmts');
    if (cmtColsSlider) {
      cmtColsSlider.value = localCmtCols;
      detail.querySelector('#ha-cmt-cols-val').textContent = localCmtCols;
      cmtGrid.style.setProperty('--ha-cmt-cols', localCmtCols);
      cmtColsSlider.oninput = e => {
        localCmtCols = parseInt(e.target.value);
        localStorage.setItem('ha-cmt-cols', localCmtCols);
        detail.querySelector('#ha-cmt-cols-val').textContent = localCmtCols;
        cmtGrid.style.setProperty('--ha-cmt-cols', localCmtCols);
      };
    }

    // ===== 评论加载（时间+拓扑双模式）=====
    let cmtPage = 1, cmtLoading = false, cmtHasMore = true;
    let cmtViewMode = 'time'; // 'time' | 'thread'
    let allComments = [];
    const cmtScroll = detail.querySelector('.ha-d-right');
    const cmtLoadEl = detail.querySelector('.ha-cmt-load');

    // 视图切换按钮
    const toggleBtn = detail.querySelector('#ha-cmt-toggle');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        cmtViewMode = cmtViewMode === 'time' ? 'thread' : 'time';
        toggleBtn.textContent = cmtViewMode === 'time' ? '🧵 拓扑' : '⏱ 时间';
        toggleBtn.title = cmtViewMode === 'time' ? '切换到拓扑视图' : '切换到时间视图';
        renderComments(cmtGrid, allComments, cmtViewMode, userColor);
      };
    }

    async function loadCmts(page) {
      if (cmtLoading || !cmtHasMore) return;
      cmtLoading = true;
      if (cmtLoadEl) cmtLoadEl.textContent = '加载中...';
      if (page === 1) cmtGrid.innerHTML = `<div class="ha-skeleton"><div class="sk-line"></div></div><div class="ha-skeleton"><div class="sk-line"></div></div>`;
      try {
        const { comments, hasMore } = await TreeholeAPI.getComments(post.pid, page, 20);
        cmtHasMore = hasMore;
        if (page === 1) allComments = [];
        allComments = allComments.concat(comments);
        renderComments(cmtGrid, allComments, cmtViewMode, userColor);
        if (cmtLoadEl) cmtLoadEl.textContent = hasMore ? '滚动加载更多' : '没有更多了';
      } catch (e) {
        if (page === 1) cmtGrid.innerHTML = '<div class="ha-msg ha-err">评论加载失败</div>';
        if (cmtLoadEl) cmtLoadEl.textContent = '加载失败';
      }
      cmtLoading = false;
    }

    loadCmts(1);

    cmtScroll.addEventListener('scroll', () => {
      if (cmtLoading || !cmtHasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = cmtScroll;
      if (scrollHeight - scrollTop - clientHeight < 10) {
        cmtPage++;
        loadCmts(cmtPage);
      }
    });
  }

  // ===== 渲染评论（支持时间/拓扑两种模式）=====
  function renderComments(container, comments, mode, userColor) {
    if (mode === 'thread') {
      renderThread(container, comments, userColor);
    } else {
      renderTimeOrder(container, comments, userColor);
    }
  }

  function renderTimeOrder(container, comments, userColor) {
    container.innerHTML = '';
    comments.forEach(cm => {
      container.insertAdjacentHTML('beforeend', commentCard(cm, userColor));
    });
  }

  // ===== 拓扑视图：主评论 + 扁平化回复串 =====
  function renderThread(container, comments, userColor) {
    container.innerHTML = '';
    const map = {};
    comments.forEach(cm => { map[cm.id] = { ...cm, children: [] }; });
    const roots = [];
    comments.forEach(cm => {
      if (cm.reply_to && map[cm.reply_to]) {
        map[cm.reply_to].children.push(map[cm.id]);
      } else {
        roots.push(map[cm.id]);
      }
    });
    // BFS 收集所有后代（扁平化，不递归嵌套）
    function collectAll(node) {
      const result = [];
      const queue = [...node.children];
      while (queue.length) {
        const child = queue.shift();
        result.push(child);
        queue.push(...child.children);
      }
      return result;
    }
    // 渲染：每个主评论+回复串包裹为一个 grid item
    roots.forEach(cm => {
      const threadWrap = document.createElement('div');
      threadWrap.className = 'ha-cmt-thread';
      threadWrap.insertAdjacentHTML('beforeend', commentCard(cm, userColor));
      const all = collectAll(cm);
      if (all.length > 0) {
        const replyWrap = document.createElement('div');
        replyWrap.className = 'ha-cmt-replies';
        all.forEach(child => {
          replyWrap.insertAdjacentHTML('beforeend', commentCard(child, userColor, true));
        });
        threadWrap.appendChild(replyWrap);
      }
      container.appendChild(threadWrap);
    });
  }

  function commentCard(cm, userColor, isReply = false) {
    const color = userColor(cm.name_tag || '匿名');
    return `
      <div class="ha-cmt${cm.is_lz ? ' ha-cmt-lz' : ''}${isReply ? ' ha-cmt-reply-card' : ''}">
        <div class="ha-cmt-hd">
          <span class="ha-cmt-id">#${cm.id}</span>
          <span class="ha-cmt-user" style="color:${color}">${esc(cm.name_tag || '匿名')}</span>
          <span class="ha-cmt-tm">${cm.time}</span>
          ${cm.is_lz ? '<span class="ha-tag">楼主</span>' : ''}
        </div>
        ${cm.reply_to ? `<div class="ha-cmt-reply-to">↩ 回复 <a class="ha-ref" data-comment-id="${cm.reply_to}">#${cm.reply_to}</a></div>` : ''}
        <div class="ha-cmt-bd">${linkifyRefs(esc(cm.content))}</div>
      </div>`;
  }

  function detailHTML(post, localCmtCols) {
    return `
    <header id="ha-header">
      <div class="ha-back">←</div>
      <h1>#${post.pid}</h1>
      <span class="ha-detail-tm">${post.time}</span>
    </header>
    <div class="ha-d-layout">
      <div class="ha-d-left">
        <div class="ha-d-top-bar">
          <button class="ha-d-fs-btn" title="全屏">⛶</button>
          <button class="ha-d-star-btn" id="ha-star-btn" title="${post.is_follow ? '取消收藏' : '收藏'}">${post.is_follow ? '★' : '☆'} ${post.like_num}</button>
          <div class="ha-tool" title="评论栏数"><input type="range" id="ha-cmt-cols" min="1" max="4" value="${localCmtCols}"><span id="ha-cmt-cols-val">${localCmtCols}</span></div>
        </div>
        <div class="ha-d-content">
          <div class="ha-d-text">${linkifyRefs(esc(post.content))}</div>
          <div class="ha-d-imgs" id="ha-d-imgs"></div>
        </div>
        <div class="ha-d-meta">
          <div class="ha-d-meta-row"><span>发布时间</span><span>${post.timestamp ? new Date(post.timestamp).toLocaleString('zh-CN') : post.time}</span></div>
          <div class="ha-d-meta-row"><span>💬 评论</span><span>${post.comment_num}</span></div>
          <div class="ha-d-meta-row"><span>${post.is_follow ? '★' : '⭐'} 收藏</span><span>${post.like_num}</span></div>
          <div class="ha-d-meta-row"><span>PID</span><span>${post.pid}</span></div>
        </div>
      </div>
      <div class="ha-d-right">
        <div class="ha-d-r-hd">
          <span>💬 评论 (${post.comment_num})</span>
          <button id="ha-cmt-toggle" class="ha-cmt-toggle" title="切换到拓扑视图">🧵 拓扑</button>
        </div>
        <div class="ha-cmt-grid" id="ha-d-cmts" style="--ha-cmt-cols:${localCmtCols}"></div>
        <div class="ha-cmt-load">加载中...</div>
      </div>
    </div>`;
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function buildHTML() {
    return `
    <div id="ha-root">
      <header id="ha-header">
        <h1>🌳 Hollow Art</h1>
        <nav>
          <button class="ha-tab ha-on" data-tab="latest">最新</button>
          <button class="ha-tab" data-tab="followed">关注</button>
          <button class="ha-tab" data-tab="bounty">悬赏</button>
        </nav>
        <button id="ha-view-btn" title="切换视图"><span id="ha-view-icon">${view === 'masonry' ? '▦' : '▤'}</span></button>
        <div class="ha-tool" title="栏数 (${cols})"><input type="range" id="ha-cols" min="1" max="5" value="${cols}"><span id="ha-cols-val">${cols}</span></div>
        <div class="ha-tool" title="主题色"><input type="color" id="ha-accent" value="${accent}"></div>
        <button id="ha-dark-btn" title="深色模式">${dark ? '☀' : '🌙'}</button>
        <div class="ha-srch">
          <input id="ha-search" type="text" placeholder="搜索… (Enter)">
          <button id="ha-search-btn">搜索</button>
        </div>
      </header>
      <main id="ha-feed" class="ha-feed ${view === 'masonry' ? 'ha-masonry' : ''}" style="--ha-cols:${cols};transition:opacity .2s"></main>
    </div>`;
  }

  const CSS = `
    :root{--ha-accent:#4CAF50;--ha-bg:#f5f5f5;--ha-card:#fff;--ha-text:#333;--ha-sub:#666;--ha-muted:#999;--ha-border:#e0e0e0;--ha-hover:0 4px 16px rgba(0,0,0,.1);--ha-cols:3}
    .ha-dark{--ha-bg:#1a1a2e;--ha-card:#16213e;--ha-text:#e0e0e0;--ha-sub:#aaa;--ha-muted:#777;--ha-border:#333;--ha-hover:0 4px 16px rgba(0,0,0,.3)}
    *{margin:0;padding:0;box-sizing:border-box}
    #ha-root{position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;flex-direction:column;background:var(--ha-bg);z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;-webkit-font-smoothing:antialiased;color:var(--ha-text)}
    .app-wrapper{display:none!important}

    #ha-header{flex-shrink:0;background:var(--ha-card);padding:10px 20px;border-bottom:1px solid var(--ha-border);display:flex;align-items:center;gap:12px;z-index:100}
    #ha-header h1{font-size:18px;margin:0;color:var(--ha-text);white-space:nowrap}
    nav{display:flex;gap:4px}
    .ha-tab{padding:5px 14px;border:1px solid var(--ha-border);border-radius:14px;background:var(--ha-card);cursor:pointer;font-size:13px;color:var(--ha-sub);transition:all .12s}
    .ha-tab:hover{border-color:var(--ha-accent);color:var(--ha-accent)}
    .ha-tab.ha-on{background:var(--ha-accent);color:#fff;border-color:var(--ha-accent)}
    #ha-view-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:6px;cursor:pointer;font-size:17px;color:var(--ha-sub);background:var(--ha-card)}
    .ha-tool{display:flex;align-items:center;gap:4px}
    .ha-tool input[type=range]{width:60px;accent-color:var(--ha-accent)}
    .ha-tool input[type=color]{width:24px;height:24px;border:none;border-radius:4px;cursor:pointer;padding:0}
    #ha-dark-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:6px;cursor:pointer;font-size:16px;background:var(--ha-card)}
    .ha-srch{margin-left:auto;display:flex;gap:5px}
    .ha-srch input{padding:5px 12px;border:1px solid var(--ha-border);border-radius:14px;width:170px;font-size:13px;outline:none;background:var(--ha-card);color:var(--ha-text)}
    .ha-srch input:focus{border-color:var(--ha-accent)}
    .ha-srch button{padding:5px 14px;background:var(--ha-accent);color:#fff;border:none;border-radius:14px;cursor:pointer;font-size:13px}

    .ha-feed{flex:1;overflow-y:auto;padding:16px 20px}
    .ha-masonry{columns:var(--ha-cols,3);column-gap:12px}
    .ha-masonry .ha-card{break-inside:avoid}

    @keyframes haFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .ha-card{background:var(--ha-card);border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.04);border:1px solid transparent;cursor:pointer;transition:transform .12s,box-shadow .2s,border-color .2s;animation:haFadeUp .25s ease-out forwards;opacity:0}
    .ha-card:hover{box-shadow:0 8px 25px rgba(0,0,0,.08);border-color:var(--ha-border)}
    .ha-card:active{transform:scale(0.98)}
    .ha-card-hd{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .ha-pid{font-weight:700;color:var(--ha-accent);font-size:14px}
    .ha-tm{color:var(--ha-muted);font-size:12px}
    .ha-tag{padding:2px 7px;background:color-mix(in srgb, var(--ha-accent) 12%, transparent);color:var(--ha-accent);border-radius:6px;font-size:11px}
    .ha-tag.ha-top{background:#fff3e0;color:#ff9800}
    .ha-card-bd{font-size:15px;line-height:1.65;color:var(--ha-text);white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
    .ha-imgs{display:flex;gap:5px;margin-top:10px;flex-wrap:wrap}
    .ha-img{width:110px;height:110px;border-radius:6px;object-fit:cover;background:var(--ha-bg);cursor:pointer}
    .ha-card-ft{display:flex;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--ha-border);color:var(--ha-sub);font-size:13px}
    .ha-msg{text-align:center;padding:40px;color:var(--ha-muted);font-size:14px}
    .ha-err{color:#f44336}
    .ha-skeleton{background:var(--ha-card);border-radius:10px;padding:16px;margin-bottom:12px;animation:sk-pulse 1.5s ease-in-out infinite}
    .sk-line{height:14px;background:var(--ha-border);border-radius:4px;margin-bottom:8px;width:100%}
    .sk-short{width:60%}.sk-tiny{width:30%}
    @keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:.4}}

    /* 帖号引用 */
    .ha-ref{color:var(--ha-accent);font-weight:600;cursor:pointer;position:relative;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
    .ha-ref:hover{color:var(--ha-accent);text-decoration-style:solid}
    .ha-ref-preview{position:fixed;width:320px;background:var(--ha-card);border:1px solid var(--ha-border);border-radius:8px;padding:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:99999999;pointer-events:none;animation:haFadeUp .15s ease-out}
    .ha-ref-preview-hd{display:flex;align-items:center;gap:6px;margin-bottom:6px}
    .ha-ref-preview-bd{font-size:13px;line-height:1.5;color:var(--ha-text);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
    .ha-ref-preview-cmt{font-size:11px;color:var(--ha-muted);margin-top:6px}

    .ha-lb{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.92);z-index:99999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
    .ha-lb.on{opacity:1}
    .ha-lb img{max-width:92vw;max-height:92vh;object-fit:contain;border-radius:4px}
    .ha-lb-x{position:absolute;top:16px;right:24px;color:#fff;font-size:28px;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.15)}

    #ha-detail{position:fixed;top:0;left:0;width:100vw;height:100vh;background:var(--ha-bg);z-index:9999998;display:flex;flex-direction:column;transition:opacity .25s}
    .ha-back{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:18px;color:var(--ha-sub)}
    .ha-back:hover{background:var(--ha-bg)}
    .ha-detail-tm{color:var(--ha-muted);font-size:13px;margin-left:auto}
    .ha-d-layout{flex:1;display:flex;overflow:hidden}
    .ha-d-left{flex:0 0 44%;max-width:44%;overflow-y:auto;padding:20px 24px;border-right:1px solid var(--ha-border);background:var(--ha-card)}
    .ha-d-right{flex:1;overflow-y:auto;padding:20px 24px;background:var(--ha-bg)}
    .ha-d-top-bar{display:flex;align-items:center;gap:10px;margin-bottom:14px}
    .ha-d-fs-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:6px;background:var(--ha-card);cursor:pointer;font-size:15px;color:var(--ha-sub)}
    .ha-d-fs-btn:hover{background:var(--ha-bg);color:var(--ha-text)}
    .ha-d-star-btn{padding:4px 10px;border:1px solid var(--ha-border);border-radius:6px;background:var(--ha-card);cursor:pointer;font-size:13px;color:var(--ha-sub);transition:all .15s}
    .ha-d-star-btn:hover{border-color:#f59e0b;color:#f59e0b}
    .ha-d-content{background:var(--ha-card);border-radius:10px;border:1px solid var(--ha-border);padding:20px}
    .ha-d-text{font-size:16px;line-height:1.8;color:var(--ha-text);white-space:pre-wrap;word-break:break-word}
    .ha-d-imgs{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .ha-d-imgs img{max-width:220px;max-height:220px;border-radius:8px;cursor:pointer;object-fit:cover}
    .ha-d-meta{margin-top:16px;background:var(--ha-bg);border-radius:8px;padding:14px 16px}
    .ha-d-meta-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;color:var(--ha-sub);border-bottom:1px solid var(--ha-border)}
    .ha-d-meta-row:last-child{border-bottom:none}

    /* 评论区 */
    .ha-d-r-hd{font-size:16px;font-weight:600;color:var(--ha-text);padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid var(--ha-border);display:flex;align-items:center;justify-content:space-between}
    .ha-cmt-toggle{padding:4px 10px;border:1px solid var(--ha-border);border-radius:12px;background:var(--ha-card);cursor:pointer;font-size:12px;color:var(--ha-sub);transition:all .12s}
    .ha-cmt-toggle:hover{border-color:var(--ha-accent);color:var(--ha-accent)}
    .ha-cmt-grid{display:grid;grid-template-columns:repeat(var(--ha-cmt-cols,2),1fr);gap:10px}
    .ha-cmt-thread{break-inside:avoid}
    .ha-cmt{background:var(--ha-card);border-radius:8px;padding:12px 14px;box-shadow:0 1px 3px rgba(0,0,0,.04);border-left:3px solid var(--ha-border)}
    .ha-cmt-lz{border-left-color:var(--ha-accent)}
    .ha-cmt-reply-card{margin-left:16px;border-left-color:var(--ha-muted);opacity:.9;font-size:13px}
    .ha-cmt-replies{margin-left:8px;padding-left:12px;border-left:2px solid var(--ha-border)}
    .ha-cmt-hd{display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap}
    .ha-cmt-id{font-weight:700;color:var(--ha-muted);font-size:11px;font-family:monospace}
    .ha-cmt-user{font-weight:600;font-size:13px}
    .ha-cmt-tm{color:var(--ha-muted);font-size:11px}
    .ha-cmt-reply-to{font-size:11px;color:var(--ha-muted);margin-bottom:4px}
    .ha-cmt-reply-to a{color:var(--ha-accent);text-decoration:none}
    .ha-cmt-bd{font-size:14px;color:var(--ha-text);line-height:1.55}
    .ha-cmt-load{text-align:center;padding:18px;color:var(--ha-muted);font-size:13px}

    @media(max-width:900px){.ha-d-layout{flex-direction:column}.ha-d-left{flex:none;max-width:100%;border-right:none;border-bottom:1px solid var(--ha-border)}.ha-cmt-grid{grid-template-columns:1fr!important}}
    @media(max-width:600px){.ha-masonry{columns:1!important}.ha-d-left,.ha-d-right{padding:16px}}
  `;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
