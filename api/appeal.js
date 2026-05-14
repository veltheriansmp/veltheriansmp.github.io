// Env vars needed:
// APPEAL_WEBHOOK_URL — Discord webhook URL for your appeals channel
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { username, reason } = req.body ?? {};
  if (!username || !reason?.trim()) {
    return res.status(400).json({ error: 'Username and reason are required.' });
  }
  if (reason.trim().length < 20) {
    return res.status(400).json({ error: 'Appeal must be at least 20 characters.' });
  }

  const webhookUrl = process.env.APPEAL_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[appeal] APPEAL_WEBHOOK_URL not set');
    return res.status(500).json({ error: 'Appeal system not configured.' });
  }

  const embed = {
    title: '📝 New Ban Appeal',
    color: 0x4F6BFF,
    fields: [
      { name: '👤 Username', value: username, inline: true },
      { name: '📅 Submitted', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
      { name: '📄 Appeal', value: reason.trim().slice(0, 1024) },
    ],
    footer: { text: 'Cloudrend SMP — Ban Appeal System' },
    timestamp: new Date().toISOString(),
  };

  try {
    const wRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Appeal Bot',
        avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
        embeds: [embed],
      }),
    });

    if (!wRes.ok) {
      const text = await wRes.text();
      console.error('[appeal] webhook error:', wRes.status, text);
      return res.status(502).json({ error: 'Failed to deliver appeal. Try again.' });
    }

    return res.status(200).json({ message: 'Appeal submitted successfully.' });
  } catch (err) {
    console.error('[appeal] fetch error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
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

