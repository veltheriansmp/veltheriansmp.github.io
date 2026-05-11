import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { username, password } = req.body;

    try {
        const { rows } = await sql`
            SELECT * FROM users WHERE LOWER(username) = ${username.toLowerCase()} LIMIT 1;
        `;
        const user = rows[0];
        
        if (!user) return res.status(401).json({ error: 'User not found' });
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        return res.status(200).json({ 
            username: user.username, 
            status: user.status, 
            ban_reason: user.ban_reason 
        });
    } catch (e) {
        return res.status(500).json({ error: 'DB Error' });
    }
}
