/**
 * 树洞数据解析器 v6.0 - 正确处理两种 API 格式
 * 
 * API 格式：
 *   list_comments → { list: [hole, hole, ...], total }
 *     每个 hole 是扁平对象 { pid, text, comment_total, comment_list:[] ... }
 *     
 *   hole/one → { hole: {...}, list: [comment, comment, ...] }
 *     hole 是帖子详情，list 是评论列表
 */
(function() {
  'use strict';

  const BASE = '/chapi/api/v3';
  
  function getAuthHeaders() {
    const token = localStorage.getItem('token') || '';
    const xsrf = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] || '';
    let uuid = localStorage.getItem('pku-uuid');
    if (!uuid) {
      uuid = 'Web_PKUHOLE_2.0.0_WEB_UUID_' + crypto.randomUUID();
      localStorage.setItem('pku-uuid', uuid);
    }
    return {
      'Authorization': `Bearer ${token}`,
      'X-XSRF-TOKEN': xsrf,
      'uuid': uuid,
      'userAgent': 'pku_web',
      'Accept': 'application/json, text/plain, */*'
    };
  }

  async function request(endpoint, params = {}) {
    const url = new URL(endpoint, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    const resp = await fetch(url.toString(), {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.success === false) throw new Error(data.message || `code ${data.code}`);
    return data.data;
  }

  // ===== getPosts: list_comments 返回扁平 hole =====
  async function getPosts(page = 1, limit = 10) {
    const data = await request(`${BASE}/hole/list_comments`, {
      page, limit, comment_limit: 0, comment_stream: 1
    });
    const items = data.list || [];
    const posts = items.map(h => wrapHole(h));
    return { posts, total: data.total || 0, page, hasMore: posts.length === limit };
  }

  // ===== getFollowed: 获取关注的帖子 =====
  async function getFollowed(page = 1, limit = 10) {
    const data = await request(`${BASE}/hole/list_comments`, {
      page, limit, comment_limit: 0, is_follow: 1, comment_stream: 1
    });
    const items = data.list || [];
    const posts = items.map(h => wrapHole(h));
    return { posts, total: data.total || 0, page, hasMore: posts.length === limit };
  }

  // ===== getBounty: 获取悬赏帖子 =====
  async function getBounty(page = 1, limit = 10) {
    const data = await request(`${BASE}/hole/list_comments`, {
      page, limit, comment_limit: 0, reward: 1, comment_stream: 1
    });
    const items = data.list || [];
    const posts = items.map(h => wrapHole(h));
    return { posts, total: data.total || 0, page, hasMore: posts.length === limit };
  }

  // ===== getPost: hole/one 返回 {hole, list} =====
  async function getPost(pid) {
    const data = await request(`${BASE}/hole/one`, { pid, comment_stream: 1 });
    const post = wrapHole(data.hole);
    post.preview_comments = (data.list || []).map(c => wrapComment(c));
    return post;
  }

  // ===== getComments: 用 comment/list 获取评论 =====
  async function getComments(pid, page = 1, limit = 50) {
    const data = await request(`${BASE}/comment/list`, { pid, page, limit });
    // data = { list: [comment, ...], total }
    const comments = (data.list || []).map(c => wrapComment(c));
    return { comments, total: data.total || 0, hasMore: comments.length === limit };
  }

  // ===== search =====
  async function search(keyword, page = 1, limit = 20) {
    const data = await request(`${BASE}/hole/list_comments`, {
      keyword, page, limit, comment_limit: 0, comment_stream: 1
    });
    const items = data.list || [];
    return { posts: items.map(h => wrapHole(h)), total: data.total || 0, keyword, hasMore: items.length === limit };
  }

  // ===== 元数据 =====
  async function getTags() { return await request(`${BASE}/tags/tree`); }
  async function getNavigation() { return await request(`${BASE}/navigation-items/list`, { page: 1, limit: 1000 }); }
  async function getUserConfig(type = 2) { return await request(`${BASE}/user_config/get`, { type }); }
  async function getUnreadMessages(type = 'int_msg') { return await request(`${BASE}/message/un_read`, { message_type: type }); }
  async function getExclusiveIds() { return await request(`${BASE}/exclusive_id/list`); }
  async function getBlockingWords() { return await request(`${BASE}/person_blocking_words/index`); }
  async function getReminders(page = 1, limit = 1000) { return await request(`${BASE}/reminder/list`, { page, limit }); }
  async function getUserInfo() { return await request(`${BASE}/users/info`); }

  // ===== wrapHole: 扁平 hole 对象 → 标准 Post =====
  function wrapHole(h) {
    if (!h) return null;
    return {
      pid: h.pid,
      content: h.text || '',
      timestamp: h.timestamp ? new Date(h.timestamp * 1000).toISOString() : null,
      time: fmtTime(h.timestamp),
      type: h.type,
      like_num: h.likenum || 0,
      tread_num: h.tread_num || 0,
      comment_num: h.reply || h.comment_total || 0,
      share_num: h.extra || 0,
      tags: parseTags(h.tags_info, h.tags_ids),
      images: parseMediaIds(h.media_ids),
      anonymous: h.anonymous === 1,
      is_follow: h.is_follow === 1,
      is_top: h.is_top === 1,
      fold: h.fold || 0,
      preview_comments: Array.isArray(h.comment_list)
        ? h.comment_list.map(c => wrapComment(c))
        : [],
      _raw: h
    };
  }

  // ===== wrapComment =====
  function wrapComment(c) {
    if (!c) return null;
    return {
      id: c.cid,
      pid: c.pid,
      content: c.text || '',
      timestamp: c.timestamp ? new Date(c.timestamp * 1000).toISOString() : null,
      time: fmtTime(c.timestamp),
      name_tag: c.name_tag || null,
      is_lz: c.is_lz === 1,
      reply_to: c.comment_id || null,
      anonymous: c.anonymous === 1,
      images: parseMediaIds(c.media_ids),
      quote: Array.isArray(c.quote) ? c.quote.map(q => ({
        id: q.cid, content: q.text, name_tag: q.name_tag
      })) : [],
      _raw: c
    };
  }

  function parseTags(tagsInfo, tagsIds) {
    if (Array.isArray(tagsInfo) && tagsInfo.length > 0) {
      return tagsInfo.map(t => t.name || t);
    }
    if (tagsIds && typeof tagsIds === 'string' && tagsIds !== '') {
      return tagsIds.split(',').filter(Boolean);
    }
    return [];
  }

  function parseMediaIds(ids) {
    if (!ids || ids === '') return [];
    const idList = typeof ids === 'string' ? ids.split(',') : Array.isArray(ids) ? ids : [];
    return idList.filter(Boolean).map(id => ({
      id: parseInt(id),
      // 这些 URL 需要带认证 headers 才能访问
      // 前端应调用 TreeholeAPI.getImage(id) 获取 base64 或 blob URL
      api: `/chapi/api/v3/media/getImageBinary?id=${id}`,
      thumbnail_api: `/chapi/api/v3/media/getThumbnail?id=${id}`,
      watermark_api: `/chapi/api/v3/media/getImageBinaryWatermark?id=${id}`
    }));
  }

  // ===== getImage: 获取图片数据 =====
  async function getImage(mediaId, opts = {}) {
    const { watermark = false, asBase64 = false } = opts;
    const endpoint = watermark
      ? `${BASE}/media/getImageBinaryWatermark`
      : `${BASE}/media/getImageBinary`;
    const resp = await fetch(`${endpoint}?id=${mediaId}`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    if (asBase64) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    return URL.createObjectURL(blob);
  }

  // ===== getThumbnail: 获取缩略图 =====
  async function getThumbnail(mediaId, asBase64 = false) {
    const resp = await fetch(`${BASE}/media/getThumbnail?id=${mediaId}`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!resp.ok) throw new Error(`Thumbnail fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    if (asBase64) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    return URL.createObjectURL(blob);
  }

  // ===== getImages: 批量获取帖子的所有图片 =====
  async function getImages(mediaIds, opts = {}) {
    const ids = typeof mediaIds === 'string'
      ? mediaIds.split(',').filter(Boolean)
      : Array.isArray(mediaIds) ? mediaIds : [];
    const results = [];
    for (const id of ids) {
      try {
        const url = await getImage(id, opts);
        results.push({ id: parseInt(id), url, error: null });
      } catch(e) {
        results.push({ id: parseInt(id), url: null, error: e.message });
      }
    }
    return results;
  }

  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000), now = new Date(), diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff/60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff/86400000)}天前`;
    return `${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  window.TreeholeAPI = {
    getPosts, getPost, getComments, search, getFollowed, getBounty,
    getImage, getThumbnail, getImages,
    getTags, getNavigation, getUserConfig,
    getUnreadMessages, getExclusiveIds, getBlockingWords, getReminders, getUserInfo,
    version: '7.1.0'
  };
  console.log('[Treehole Parser v7.1] Loaded');
})();
