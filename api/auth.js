import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const { rows, rowCount } = await sql`
      SELECT id, username, password_hash, status, ban_reason
      FROM users
      WHERE LOWER(username) = LOWER(${username})
      LIMIT 1
    `;

    // Same timing either way to avoid user enumeration
    if (rowCount === 0) {
      await bcrypt.hash(password, 12); // dummy hash to normalize response time
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Same token format as register.js: base64(username:id)
    const token = Buffer.from(`${user.username}:${user.id}`).toString('base64');

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        status: user.status,           // 'active' | 'banned'
        ban_reason: user.ban_reason ?? null,
      },
    });
  } catch (err) {
    console.error('[auth] DB error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
