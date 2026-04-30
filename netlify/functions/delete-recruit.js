/**
 * Netlify Serverless Function — Delete Recruit
 * ===============================================
 * Called from the admin dashboard to remove a recruit from Supabase.
 * Protected by the same ADMIN_PASSWORD as other admin endpoints.
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

  const { email } = data;
  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/recruits?email=eq.${encodeURIComponent(emailLower)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Supabase delete error:', errText);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to delete recruit' }) };
    }

    const result = await response.json();
    if (!result || result.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Recruit not found' }) };
    }

    console.log(`Deleted recruit: ${emailLower}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: emailLower }) };

  } catch (error) {
    console.error('Delete recruit error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to delete recruit' }) };
  }
};
