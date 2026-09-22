import webPush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

webPush.setVapidDetails(
  'mailto:test@example.com',
  "BLCbyjtnBK8rB7Md_aEtONwHdugGwwKQRKILzCOB5h-QXFZTEf4SshBrnFfn-BAJFnzLDeL52j3tl5jRx2h_AJk",
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sender, target, taskText, isCompliment } = req.body;

  if (!sender || !target) {
    return res.status(400).json({ error: 'Missing sender or target' });
  }

  try {
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_name', target);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: 'Target has no push subscriptions' });
    }

    let title = '👉 콕 찌르기!';
    let body = taskText 
      ? `${sender}님이 '${taskText}' 할 일을 콕 찔렀어요!`
      : `${sender}님이 콕 찔렀어요! 할 일을 확인해볼까요?`;

    if (isCompliment) {
      title = '😍 쓰담쓰담!';
      body = `${sender}님이 ${target}님을 칭찬했어요! 😍`;
    }

    const payload = JSON.stringify({ title, body });

    const sendPromises = subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys
      };
      return webPush.sendNotification(pushSubscription, payload)
        .catch(err => {
          console.error('Error sending push to endpoint', sub.endpoint, err);
          if (err.statusCode === 410 || err.statusCode === 404) {
            return supabase.from('subscriptions').delete().eq('id', sub.id);
          }
        });
    });

    await Promise.all(sendPromises);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Poke Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
