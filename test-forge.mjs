const url = (process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.im').replace(/\/$/, '') + '/v1/chat/completions';
const key = process.env.BUILT_IN_FORGE_API_KEY || '';
console.log('URL:', url);
console.log('KEY present:', !!key);
try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: 'gpt-5', messages: [{ role: 'user', content: 'Say hi' }], max_completion_tokens: 10 }),
    signal: AbortSignal.timeout(15000),
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text.substring(0, 500));
} catch (e) {
  console.error('Error:', e.message);
}
