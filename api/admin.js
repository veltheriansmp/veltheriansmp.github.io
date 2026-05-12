import { sql } from '@vercel/postgres';

// ---- Hardcoded staff list ----
// Add more usernames here as needed (case-insensitive checked below)
const STAFF = ['neurotic_orchid'];

function isStaff(username) {
  return STAFF.some(u => u.toLowerCase() === username?.toLowerCase());
}

// ---- Auth helper ----
// Reuses the same base64(username:id) token from auth.js / register.js
async function resolveStaff(req, res) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header.' });
    return null;
  }

  const token = authHeader.slice(7).trim();
  let username, id;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    [username, id] = decoded.split(':');
    if (!username || !id || isNaN(Number(id))) throw new Error();
  } catch {
    res.status(401).json({ error: 'Invalid token.' });
    return null;
  }

  if (!isStaff(username)) {
    res.status(403).json({ error: 'Forbidden. You are not staff.' });
    return null;
  }

  // Verify token against DB (prevent forged staff tokens)
  const { rows, rowCount } = await sql`
    SELECT id, username FROM users
    WHERE id = ${Number(id)} AND username = ${username}
    LIMIT 1
  `;
  if (rowCount === 0) {
    res.status(401).json({ error: 'Session invalid.' });
    return null;
  }

  return rows[0];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const staff = await resolveStaff(req, res);
  if (!staff) return; // resolveStaff already sent the error response

  const { action } = req.query;

  // ---- GET /api/admin?action=users ----
  // Returns all users (id, username, status, ban_reason) — no password hashes
  if (req.method === 'GET' && action === 'users') {
    const { rows } = await sql`
      SELECT id, username, status, ban_reason
      FROM users
      ORDER BY id ASC
    `;
    return res.status(200).json({ users: rows });
  }

  // ---- POST /api/admin?action=ban ----
  // Body: { username, reason }
  if (req.method === 'POST' && action === 'ban') {
    const { username, reason } = req.body ?? {};
    if (!username) return res.status(400).json({ error: 'Username required.' });

    if (isStaff(username)) {
      return res.status(400).json({ error: 'Cannot ban another staff member.' });
    }

    const { rowCount } = await sql`
      UPDATE users
      SET status = 'banned', ban_reason = ${reason ?? 'No reason provided.'}
      WHERE LOWER(username) = LOWER(${username})
    `;
    if (rowCount === 0) return res.status(404).json({ error: 'User not found.' });

    return res.status(200).json({ message: `${username} has been banned.` });
  }

  // ---- POST /api/admin?action=unban ----
  // Body: { username }
  if (req.method === 'POST' && action === 'unban') {
    const { username } = req.body ?? {};
    if (!username) return res.status(400).json({ error: 'Username required.' });

    const { rowCount } = await sql`
      UPDATE users
      SET status = 'active', ban_reason = NULL
      WHERE LOWER(username) = LOWER(${username})
    `;
    if (rowCount === 0) return res.status(404).json({ error: 'User not found.' });

    return res.status(200).json({ message: `${username} has been unbanned.` });
  }

  // ---- DELETE /api/admin?action=delete ----
  // Body: { username }
  if (req.method === 'DELETE' && action === 'delete') {
    const { username } = req.body ?? {};
    if (!username) return res.status(400).json({ error: 'Username required.' });

    if (isStaff(username)) {
      return res.status(400).json({ error: 'Cannot delete a staff account.' });
    }

    const { rowCount } = await sql`
      DELETE FROM users WHERE LOWER(username) = LOWER(${username})
    `;
    if (rowCount === 0) return res.status(404).json({ error: 'User not found.' });

    return res.status(200).json({ message: `${username} has been deleted.` });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
