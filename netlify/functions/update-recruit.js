/**
 * Netlify Serverless Function — Update Recruit Status/Notes
 * ==========================================================
 * Called from the admin dashboard to update pipeline status and notes.
 * Protected by the same ADMIN_PASSWORD as get-recruits.
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  // Password protection
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

  let data;
  try { data = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { email, recruit_status, notes } = data;
  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing email' }) };
  }

  // Build update payload — only include fields that were sent
  const update = { updated_at: new Date().toISOString() };
  if (recruit_status !== undefined) update.recruit_status = recruit_status;
  if (notes !== undefined) update.notes = notes;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/recruits?email=eq.${encodeURIComponent(email.toLowerCase().trim())}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(update),
      }
    );

    const result = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, recruit: result }),
    };
  } catch (error) {
    console.error('Update failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to update recruit' }),
    };
  }
};
