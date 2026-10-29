const { createClient } = require('@supabase/supabase-js');
function env(name) { return process.env[name] || ''; }
function supabaseUrl() { return env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL') || ''; }
function anonKey() { return env('SUPABASE_ANON_KEY') || env('NEXT_PUBLIC_SUPABASE_ANON_KEY') || ''; }
function serviceKey() { return env('SUPABASE_SERVICE_ROLE_KEY') || ''; }
function json(res, status, obj) { res.status(status).setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); }
async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try { return JSON.parse(text); } catch (e) { return {}; }
}
async function getUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const url = supabaseUrl(); const key = anonKey();
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
function dbClient() {
  const url = supabaseUrl();
  const key = serviceKey() || anonKey();
  return createClient(url, key);
}
function parseTags(input) {
  if (Array.isArray(input)) return input.map(function (t) { return String(t).trim(); }).filter(Boolean).slice(0, 5);
  if (!input || typeof input !== 'string') return [];
  const seen = {}; const out = [];
  input.split(',').forEach(function (part) { let t = part.trim(); if (!t) return; if (t.length > 8) t = t.slice(0, 8); if (seen[t]) return; seen[t] = 1; out.push(t); });
  return out.slice(0, 5);
}
function toApi(row) {
  return { id: row.id, content: row.content, done: !!row.done, priority: row.priority, deadline: row.deadline || null, tags: row.tags || [], repeat_rule: row.repeat_rule, created_at: row.created_at };
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const url = supabaseUrl();
  if (!url || (!anonKey() && !serviceKey())) { json(res, 500, { error: '服务端未配置 Supabase，请联系管理员' }); return; }
  const user = await getUser(req);
  if (!user) { json(res, 401, { error: '登录已过期，请重新登录' }); return; }
  const db = dbClient();
  if (req.method === 'GET') {
    const { data, error } = await db.from('todos').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    if (error) { json(res, 500, { error: '云端读取失败，请重试' }); return; }
    json(res, 200, { todos: (data || []).map(toApi) }); return;
  }
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const content = String(body.content || '').trim();
    if (!content) { json(res, 400, { error: '请输入待办内容' }); return; }
    const priority = (body.priority === '高' || body.priority === '低') ? body.priority : '中';
    const deadline = (body.deadline && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline)) ? body.deadline : null;
    const repeat_rule = (body.repeat_rule === '每天' || body.repeat_rule === '每周' || body.repeat_rule === '每月') ? body.repeat_rule : '不重复';
    const { data, error } = await db.from('todos').insert([{ user_id: user.id, content, done: false, priority, deadline, tags: parseTags(body.tags), repeat_rule }]).select().single();
    if (error) { json(res, 500, { error: '云端保存失败，请重试' }); return; }
    json(res, 200, { todo: toApi(data) }); return;
  }
  json(res, 405, { error: '方法不允许' });
};
