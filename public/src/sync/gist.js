/* GitHub Gist 同步：令牌与状态存 kv，合并规则见 core/merge.js。不碰 DOM。 */
import { mergeRecords, canon, syncPart } from '../core/merge.js';

export const FILE = 'control-daguan-progress.json', API = 'https://api.github.com';
export class SyncError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }
export class GistSync {
  /** opts: kv（保存令牌与状态的存储）；getLocal() → rec；applyMerged(rec)；onStatus(cfg, busy, pending)；fetch、isOnline（由 store 注入浏览器实现，测试可替换） */
  constructor(opts) { Object.assign(this, { fetch: (...a) => fetch(...a), isOnline: () => true }, opts); this.cfg = null; this.busy = null; this.timer = null; this.pending = false; }
  async init() { this.cfg = (await this.kv.get('gist')) || null; this.emit(); return this.cfg; }
  get connected() { return !!this.cfg?.token; }
  async saveCfg(p) { this.cfg = { ...(this.cfg || {}), ...p }; await this.kv.set('gist', this.cfg); this.emit(); }
  emit() { this.onStatus?.(this.cfg, this.busy != null, this.pending); }
  async api(path, init = {}) {
    let r;
    try {
      r = await this.fetch(API + path, { ...init, headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: `Bearer ${this.cfg.token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
    } catch { throw new SyncError('网络连接失败，稍后会自动重试。', 'offline'); }
    if (r.status === 401) throw new SyncError('令牌无效或已过期，请重新粘贴 gist 令牌。', 'auth');
    if (r.status === 403 || r.status === 429) {
      const left = r.headers.get('x-ratelimit-remaining');
      throw new SyncError(left === '0' ? 'GitHub API 调用次数已用完，请稍后再同步。' : '令牌没有 gist 权限（需要 gist 读写）。', left === '0' ? 'rate' : 'auth');
    }
    if (r.status === 404) throw new SyncError('找不到同步用的 Gist。', 'notfound');
    if (!r.ok) throw new SyncError(`GitHub 返回错误 ${r.status}，请稍后重试。`, 'http');
    const scopes = r.headers.get('x-oauth-scopes');
    if (scopes != null && this.cfg) this.cfg.scopes = scopes;
    return r.status === 204 ? null : r.json();
  }
  async findOrCreate() {
    for (let page = 1; page <= 10; page++) {
      const list = await this.api(`/gists?per_page=100&page=${page}`);
      const g = list.find(x => x.files && x.files[FILE]);
      if (g) return g.id;
      if (list.length < 100) break;
    }
    const g = await this.api('/gists', { method: 'POST', body: JSON.stringify({ description: '控制大观 学习进度同步（自动生成，请勿公开）', public: false, files: { [FILE]: { content: JSON.stringify(this.payload(this.getLocal()), null, 1) } } }) });
    return g.id;
  }
  payload(rec) { return { app: 'control-daguan', kind: 'progress', version: 3, savedAt: new Date().toISOString(), ...syncPart(rec) }; }
  async readRemote() {
    const g = await this.api(`/gists/${this.cfg.gistId}`);
    const f = g.files?.[FILE]; if (!f) throw new SyncError('Gist 中没有进度文件。', 'notfound');
    let text = f.content;
    if (f.truncated && f.raw_url) { const r = await this.fetch(f.raw_url); text = await r.text(); }
    try { const d = JSON.parse(text || '{}'); return d && d.app === 'control-daguan' ? d : {}; } catch { return {}; }
  }
  /** 连接：保存令牌 → 查找或创建私密 Gist → 立即同步 */
  async connect(token) {
    token = (token || '').trim();
    if (!/^(gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}$/.test(token)) throw new SyncError('这不像 GitHub 令牌（应以 ghp_ 或 github_pat_ 开头）。', 'input');
    await this.saveCfg({ token, gistId: null, lastSync: null, lastError: null });
    try { return await this.sync(); } catch (e) { if (e.kind === 'auth') await this.disconnect(); throw e; }
  }
  async disconnect() { clearTimeout(this.timer); this.cfg = null; this.pending = false; await this.kv.del('gist'); this.emit(); }
  schedule(ms = 3000) {
    if (!this.connected) return;
    this.pending = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.sync().catch(() => {}), ms); this.emit();
  }
  sync() {
    if (!this.connected) return Promise.resolve(null);
    if (this.busy) { this.again = true; return this.busy; }
    this.busy = this._sync().finally(() => { this.busy = null; this.emit(); if (this.again) { this.again = false; this.schedule(500); } });
    this.emit(); return this.busy;
  }
  async _sync() {
    clearTimeout(this.timer);
    if (!this.isOnline()) { this.pending = true; await this.saveCfg({ lastError: '当前离线，联网后自动同步。', errorKind: 'offline' }); throw new SyncError('当前离线，联网后自动同步。', 'offline'); }
    try {
      if (!this.cfg.gistId) await this.saveCfg({ gistId: await this.findOrCreate() });
      let remote;
      try { remote = await this.readRemote(); }
      catch (e) { if (e.kind !== 'notfound') throw e; await this.saveCfg({ gistId: await this.findOrCreate() }); remote = await this.readRemote(); }
      const local = this.getLocal(), merged = mergeRecords(local, remote);
      const localChanged = canon(syncPart(merged)) !== canon(syncPart(local));
      const remoteChanged = canon(syncPart(merged)) !== canon(syncPart(mergeRecords({}, remote)));
      if (localChanged) await this.applyMerged(merged);
      if (remoteChanged) await this.api(`/gists/${this.cfg.gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(this.payload(merged), null, 1) } } }) });
      this.pending = false;
      await this.saveCfg({ lastSync: Date.now(), lastError: null, errorKind: null, lastResult: { pulled: localChanged, pushed: remoteChanged } });
      return { pulled: localChanged, pushed: remoteChanged };
    } catch (e) {
      if (e.kind === 'offline') this.pending = true;
      await this.saveCfg({ lastError: e.message || String(e), errorKind: e.kind || 'unknown' });
      throw e;
    }
  }
}
