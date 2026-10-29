const { createClient } = require('@supabase/supabase-js');
function env(name) { return process.env[name] || ''; }
function supabaseUrl() { return env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL') || ''; }
function anonKey() { return env('SUPABASE_ANON_KEY') || env('NEXT_PUBLIC_SUPABASE_ANON_KEY') || ''; }
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
function translateError(msg) {
  const m = String(msg || '');
  if (m.includes('User already registered') || m.includes('already registered')) return '该邮箱已注册';
  if (m.includes('Password should be at least')) return '密码至少需要 6 位';
  if (m.includes('Invalid email') || m.includes('invalid email')) return '邮箱格式不对';
  if (m.includes('Email rate limit')) return '请求太频繁，请稍后再试';
  return '注册失败，请重试';
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { json(res, 405, { error: '方法不允许' }); return; }
  const url = supabaseUrl(); const key = anonKey();
  if (!url || !key) { json(res, 500, { error: '服务端未配置 Supabase，请联系管理员' }); return; }
  const body = await parseBody(req);
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  if (!email || email.indexOf('@') < 0) { json(res, 400, { error: '邮箱格式不对' }); return; }
  if (!password || password.length < 6) { json(res, 400, { error: '密码至少需要 6 位' }); return; }
  const supabase = createClient(url, key);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) { json(res, 400, { error: translateError(error.message) }); return; }
  const needsConfirmation = !!(data.user && !data.session);
  json(res, 200, { user: data.user ? { id: data.user.id, email: data.user.email } : null, needsConfirmation });
};
