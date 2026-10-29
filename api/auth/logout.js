function json(res, status, obj) { res.status(status).setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); }
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { json(res, 405, { error: '方法不允许' }); return; }
  // 会话凭证由前端清除；Supabase 会话令牌自然过期，不在服务端另存会话。
  json(res, 200, { ok: true });
};
