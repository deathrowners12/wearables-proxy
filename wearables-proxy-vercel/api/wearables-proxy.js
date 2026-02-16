const express = require('express');
const fetch = require('node-fetch'); // Use native fetch in Node 18+ if available

const app = express();
app.use(express.json());

const SUPABASE_FUNCTION_URL = process.env.SUPABASE_FUNCTION_URL; // e.g. https://ygcckclrplotddnaxzgr.functions.supabase.co/wearables-oauth

app.all('/api/wearables-proxy', async (req, res) => {
  if (!SUPABASE_FUNCTION_URL) {
    return res.status(500).send('Missing SUPABASE_FUNCTION_URL env var');
  }

  // Set CORS headers for browser
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, x-requested-with');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Forward request to Supabase Edge Function
  const url = SUPABASE_FUNCTION_URL + (req.originalUrl.replace('/api/wearables-proxy', '') || '');
  const init = {
    method: req.method,
    headers: { ...req.headers },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  };
  delete init.headers.host;

  try {
    const upstreamRes = await fetch(url, init);
    const text = await upstreamRes.text();
    // Forward upstream status/body/headers (except CORS ones)
    for (const [k, v] of upstreamRes.headers.entries()) {
      if (!k.toLowerCase().startsWith('access-control-')) res.setHeader(k, v);
    }
    res.status(upstreamRes.status).send(text);
  } catch (err) {
    console.error('proxy error', err);
    res.status(502).send('Bad Gateway');
  }
});

module.exports = app;