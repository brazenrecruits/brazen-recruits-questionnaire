/**
 * Netlify Serverless Function — Get Recruits for Admin Dashboard
 * ==============================================================
 * Fetches all recruits from Supabase for the admin dashboard.
 * Protected by a simple password check (ADMIN_PASSWORD env var).
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // Simple password protection
  const password = (event.headers['x-admin-password'] || '').trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'brazenrecruits2026';
  if (password !== adminPassword) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/recruits?select=*&order=updated_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const recruits = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, recruits }),
    };
  } catch (error) {
    console.error('Failed to fetch recruits:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch recruits' }),
    };
  }
};
