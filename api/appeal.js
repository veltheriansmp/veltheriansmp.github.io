export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const webhookUrl = process.env.DISCORD_APPEAL_WEBHOOK;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'Appeal webhook not configured.' });
  }

  const { username, discord, email, message } = req.body ?? {};
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const clean = (value) => String(value ?? '').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const payload = {
    content: null,
    embeds: [{
      title: 'Cloudrend SMP Ban Appeal',
      color: 15105570,
      fields: [
        { name: 'Username', value: clean(username).slice(0, 100), inline: true },
        { name: 'Discord', value: clean(discord || 'N/A').slice(0, 100), inline: true },
        { name: 'Email', value: clean(email || 'N/A').slice(0, 100), inline: true },
        { name: 'Appeal', value: clean(message).slice(0, 1024), inline: false },
      ],
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const body = await discordRes.text();
      return res.status(502).json({ error: `Discord webhook failed: ${discordRes.status} ${body}` });
    }

    return res.status(201).json({ message: 'Appeal submitted successfully.' });
  } catch (err) {
    console.error('[appeal] error', err);
    return res.status(500).json({ error: 'Unable to send appeal. Try again later.' });
  }
}
