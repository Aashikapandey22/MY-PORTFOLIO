import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createAuthMiddleware } from './middleware/auth.js';
import { createSupabaseClients, isSupabaseConfigured } from './lib/supabase.js';
import { PROJECT_FIELDS, publicProject, validateMessage, validateProject } from './lib/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4173);
const clients = createSupabaseClients();
const adminIds = new Set((process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));
const publicOrigin = process.env.PUBLIC_ORIGIN || `http://localhost:${port}`;

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: publicOrigin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '32kb' }));
app.use((request, _response, next) => {
  request.cookies = Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
  next();
});

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false });
const messageLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many messages. Please try again later.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again later.' } });
const requireAdmin = createAuthMiddleware({ clients, adminIds });
const databaseRequired = (_request, response, next) => {
  if (!clients) return response.status(503).json({ error: 'The database is not configured.' });
  next();
};
const respondError = (response, error, status = 400, expose = false) => response.status(status).json({ error: expose && error instanceof Error ? error.message : 'Request could not be completed.' });
const cookieOptions = (maxAge) => `Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}${maxAge === undefined ? '' : `; Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}`}`;

app.get('/api/health', (_request, response) => response.json({ ok: true, databaseConfigured: isSupabaseConfigured() }));

app.post('/api/auth/login', loginLimiter, databaseRequired, async (request, response) => {
  try {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (!email || !password) return response.status(400).json({ error: 'Email and password are required.' });
    const { data, error } = await clients.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user || !adminIds.has(data.user.id)) return response.status(401).json({ error: 'Invalid administrator credentials.' });
    response.setHeader('Set-Cookie', `portfolio_session=${encodeURIComponent(data.session.access_token)}; ${cookieOptions((data.session.expires_in || 3600) * 1000)}`);
    response.json({ user: { id: data.user.id, email: data.user.email } });
  } catch { response.status(401).json({ error: 'Unable to sign in.' }); }
});

app.post('/api/auth/logout', (_request, response) => {
  response.setHeader('Set-Cookie', `portfolio_session=; ${cookieOptions(0)}`);
  response.status(204).end();
});
app.get('/api/auth/me', requireAdmin, (request, response) => response.json({ user: { id: request.user.id, email: request.user.email } }));

const projectSelect = 'id,title,slug,description,technologies,image_url,live_url,github_url,category,featured,published,sort_order,created_at,updated_at';
app.get('/api/projects', publicLimiter, databaseRequired, async (request, response) => {
  const page = Math.max(1, Number.parseInt(request.query.page || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(request.query.limit || '20', 10) || 20));
  const from = (page - 1) * limit;
  const { data, error, count } = await clients.admin.from('projects').select(projectSelect, { count: 'exact' }).eq('published', true).order('featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false }).range(from, from + limit - 1);
  if (error) return respondError(response, error, 502);
  response.json({ data: (data || []).map(publicProject), page, limit, total: count || 0 });
});

app.get('/api/projects/:slugOrId', publicLimiter, databaseRequired, async (request, response) => {
  const key = request.params.slugOrId;
  const query = /^[0-9a-f-]{36}$/i.test(key) ? clients.admin.from('projects').select(projectSelect).eq('id', key) : clients.admin.from('projects').select(projectSelect).eq('slug', key);
  const { data, error } = await query.eq('published', true).maybeSingle();
  if (error) return respondError(response, error, 502);
  if (!data) return response.status(404).json({ error: 'Project not found.' });
  response.json({ data: publicProject(data) });
});

app.get('/api/admin/projects', requireAdmin, async (_request, response) => {
  const { data, error } = await clients.admin.from('projects').select(projectSelect).order('sort_order').order('created_at', { ascending: false });
  if (error) return respondError(response, error, 502);
  response.json({ data: data || [] });
});

app.post('/api/admin/projects', requireAdmin, async (request, response) => {
  try {
    const project = validateProject(request.body);
    const { data, error } = await clients.admin.from('projects').insert(project).select(projectSelect).single();
    if (error) return respondError(response, error, error.code === '23505' ? 409 : 400);
    response.status(201).json({ data });
  } catch (error) { respondError(response, error, 400, true); }
});

app.put('/api/admin/projects/:id', requireAdmin, async (request, response) => {
  try {
    const body = Object.fromEntries(Object.entries(request.body || {}).filter(([field]) => PROJECT_FIELDS.includes(field)));
    const project = validateProject(body, true);
    const { data, error } = await clients.admin.from('projects').update(project).eq('id', request.params.id).select(projectSelect).maybeSingle();
    if (error) return respondError(response, error, error.code === '23505' ? 409 : 400);
    if (!data) return response.status(404).json({ error: 'Project not found.' });
    response.json({ data });
  } catch (error) { respondError(response, error, 400, true); }
});

app.patch('/api/admin/projects/:id/publish', requireAdmin, async (request, response) => {
  if (typeof request.body?.published !== 'boolean') return response.status(400).json({ error: 'published must be boolean.' });
  const { data, error } = await clients.admin.from('projects').update({ published: request.body.published }).eq('id', request.params.id).select(projectSelect).maybeSingle();
  if (error) return respondError(response, error, 400);
  if (!data) return response.status(404).json({ error: 'Project not found.' });
  response.json({ data });
});

app.delete('/api/admin/projects/:id', requireAdmin, async (request, response) => {
  const { error } = await clients.admin.from('projects').delete().eq('id', request.params.id);
  if (error) return respondError(response, error, 400);
  response.status(204).end();
});

async function sendNotification(message) {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_NOTIFICATION_TO || !process.env.CONTACT_NOTIFICATION_FROM) return 'not_configured';
  const result = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.CONTACT_NOTIFICATION_FROM, to: [process.env.CONTACT_NOTIFICATION_TO], subject: `Portfolio message${message.subject ? `: ${message.subject}` : ''}`, text: `From: ${message.name} <${message.email}>\n\n${message.message}` }) });
  if (!result.ok) throw new Error('notification provider rejected the request');
  return 'sent';
}

app.post('/api/messages', messageLimiter, databaseRequired, async (request, response) => {
  const startedAt = Number(request.body?.formStartedAt);
  if (request.body?.website || !Number.isFinite(startedAt) || Date.now() - startedAt < 1200) return response.status(400).json({ error: 'Please wait a moment and try again.' });
  try {
    const message = validateMessage(request.body);
    const duplicateSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recentDuplicate, error: duplicateError } = await clients.admin.from('contact_messages').select('id').eq('email', message.email).eq('message', message.message).gte('created_at', duplicateSince).limit(1).maybeSingle();
    if (duplicateError) return respondError(response, duplicateError, 502);
    if (recentDuplicate) return response.status(409).json({ error: 'This message was already received recently.' });
    const { data, error } = await clients.admin.from('contact_messages').insert(message).select('id,created_at').single();
    if (error) return respondError(response, error, 502);
    let notification = 'not_configured';
    try { notification = await sendNotification(message); } catch { console.error('Contact notification delivery failed.'); notification = 'failed'; }
    response.status(201).json({ data, notification });
  } catch (error) { respondError(response, error, 400, true); }
});

app.get('/api/admin/messages', requireAdmin, async (_request, response) => {
  const { data, error } = await clients.admin.from('contact_messages').select('id,name,email,subject,message,status,created_at').order('created_at', { ascending: false });
  if (error) return respondError(response, error, 502);
  response.json({ data: data || [] });
});
app.get('/api/admin/messages/:id', requireAdmin, async (request, response) => {
  const { data, error } = await clients.admin.from('contact_messages').select('id,name,email,subject,message,status,created_at').eq('id', request.params.id).maybeSingle();
  if (error) return respondError(response, error, 502);
  if (!data) return response.status(404).json({ error: 'Message not found.' });
  response.json({ data });
});
app.patch('/api/admin/messages/:id', requireAdmin, async (request, response) => {
  if (!['new', 'read', 'archived'].includes(request.body?.status)) return response.status(400).json({ error: 'Invalid message status.' });
  const { data, error } = await clients.admin.from('contact_messages').update({ status: request.body.status }).eq('id', request.params.id).select('id,name,email,subject,message,status,created_at').maybeSingle();
  if (error) return respondError(response, error, 400);
  if (!data) return response.status(404).json({ error: 'Message not found.' });
  response.json({ data });
});

app.get('/admin', (_request, response) => response.sendFile(path.join(__dirname, 'admin.html')));
app.use(express.static(__dirname, { extensions: ['html'] }));
app.use((_request, response) => response.status(404).json({ error: 'Not found.' }));

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Portfolio server listening on ${publicOrigin}`));
export { app };
