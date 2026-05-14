import { sql } from '@vercel/postgres';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: "2153636",
  key: "280cbae97b79cb1421b2",
  secret: "bcfb2533ab20cc8368c1",
  cluster: "ap1",
  useTLS: true
});

const DISCORD_CHAT_WEBHOOK = process.env.DISCORD_CHAT_WEBHOOK;

async function sendDiscordWebhook(username, source, content) {
  if (!DISCORD_CHAT_WEBHOOK) return;
  if (source === 'discord') return;

  const embed = {
    title: source === 'minecraft' ? 'Minecraft Chat' : 'Website Chat',
    description: content,
    color: source === 'minecraft' ? 0x059669 : 0x7C3AED,
    fields: [
      { name: 'User', value: username || 'Unknown', inline: true },
      { name: 'Source', value: source, inline: true }
    ],
    timestamp: new Date().toISOString()
  };

  const payload = { embeds: [embed] };
  try {
    await fetch(DISCORD_CHAT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[discord webhook]', err);
  }
}

// Reuse token auth from me.js
async function resolveUser(req, res) {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header.' });
    return null;
  }
  const token = auth.slice(7).trim();
  let username, id;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    [username, id] = decoded.split(':');
    if (!username || !id || isNaN(Number(id))) throw new Error();
  } catch {
    res.status(401).json({ error: 'Invalid token.' });
    return null;
  }
  const { rows, rowCount } = await sql`
    SELECT id, username, status FROM users
    WHERE id = ${Number(id)} AND username = ${username} LIMIT 1
  `;
  if (rowCount === 0) { res.status(401).json({ error: 'Session invalid.' }); return null; }
  if (rows[0].status === 'banned') { res.status(403).json({ error: 'You are banned.' }); return null; }
  return rows[0];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Ensure messages table exists (idempotent)
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'web',  -- 'web' | 'discord' | 'minecraft'
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ---- GET: fetch last 50 messages ----
  if (req.method === 'GET') {
    const user = await resolveUser(req, res);
    if (!user) return;

    const { rows } = await sql`
      SELECT id, username, source, content, created_at
      FROM chat_messages
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return res.status(200).json({ messages: rows.reverse() });
  }

  // ---- POST: send a message ----
  if (req.method === 'POST') {
    const bridgeSecret = req.headers['x-bridge-secret'];
    const authHeader = req.headers['authorization'];
    const authToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const isBridge = process.env.BRIDGE_SECRET && (bridgeSecret === process.env.BRIDGE_SECRET || authToken === process.env.BRIDGE_SECRET);

    let username, source;
    if (isBridge) {
      // Trusted bridge — accepts { username, source, content } directly
      username = req.body?.username;
      source = req.body?.source ?? 'discord';
    } else {
      const user = await resolveUser(req, res);
      if (!user) return;
      username = user.username;
      source = 'web';
    }

    const content = req.body?.content?.trim();
    if (!content) return res.status(400).json({ error: 'Message content is required.' });
    if (content.length > 500) return res.status(400).json({ error: 'Max 500 characters.' });

    const { rows } = await sql`
      INSERT INTO chat_messages (username, source, content)
      VALUES (${username}, ${source}, ${content})
      RETURNING id, username, source, content, created_at
    `;

    const msg = rows[0];

    // Broadcast to all connected Pusher clients
    await pusher.trigger('smp-chat', 'new-message', {
      id: msg.id,
      username: msg.username,
      source: msg.source,
      content: msg.content,
      created_at: msg.created_at,
    });

    // Forward website/MC messages to Discord if configured
    await sendDiscordWebhook(msg.username, msg.source, msg.content);

    return res.status(201).json({ message: msg });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
