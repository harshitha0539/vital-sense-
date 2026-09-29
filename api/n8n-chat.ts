const N8N_WEBHOOK_URL =
  'https://harshitha39.app.n8n.cloud/webhook/90bab5af-e28b-4460-b3b3-40029d90c209/chat';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { chatInput, sessionId, action = 'sendMessage', metadata } = req.body || {};

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({
        action,
        sessionId: sessionId || 'vitalsense-session-1',
        chatInput: chatInput || '',
        metadata: metadata || {},
      }),
    });

    const rawText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { output: rawText };
    }

    if (!response.ok) {
      res.status(response.status).json({
        error: data?.message || data?.error || `n8n webhook returned HTTP ${response.status}`,
        details: data,
      });
      return;
    }

    res.status(200).json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reach n8n chat webhook.';
    res.status(500).json({ error: message });
  }
}
