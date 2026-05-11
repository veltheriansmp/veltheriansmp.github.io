import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.slice(7).trim();

  let username, id;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 2) throw new Error('bad format');
    [username, id] = parts;
    if (!username || !id || isNaN(Number(id))) throw new Error('invalid fields');
  } catch {
    return res.status(401).json({ error: 'Invalid session token.' });
  }

  try {
    const { rows, rowCount } = await sql`
      SELECT id, username, status, ban_reason
      FROM users
      WHERE id = ${Number(id)} AND username = ${username}
      LIMIT 1
    `;

    if (rowCount === 0) {
      return res.status(401).json({ error: 'Session invalid. Please log in again.' });
    }

    const user = rows[0];

    return res.status(200).json({
      id: user.id,
      username: user.username,
      status: user.status,             // 'active' | 'banned'
      ban_reason: user.ban_reason ?? null,
    });
  } catch (err) {
    console.error('[me] DB error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
