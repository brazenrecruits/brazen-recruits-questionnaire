/**
 * Netlify Serverless Function — Add Recruit Manually
 * ====================================================
 * Called from the admin dashboard to manually add a new recruit.
 * Protected by the same ADMIN_PASSWORD as get-recruits / update-recruit.
 *
 * Accepts: first_name, last_name, email, phone (optional), recruit_status (optional), notes (optional)
 * Creates a new recruit record in Supabase. If email already exists, returns an error.
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

  const { first_name, last_name, email, phone, recruit_status, notes } = data;

  if (!first_name || !last_name || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'First name, last name, and email are required' }) };
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Check if recruit already exists
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recruits?email=eq.${encodeURIComponent(emailLower)}&select=email`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const existing = await getRes.json();

    if (existing && existing.length > 0) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'A recruit with this email already exists' }) };
    }

    // Insert new recruit
    const now = new Date().toISOString();
    const record = {
      email: emailLower,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      recruit_status: recruit_status || 'New Lead',
      notes: notes || '',
      created_at: now,
      updated_at: now,
      // Store phone in lead_capture_data so it shows up in the detail panel
      lead_capture_data: phone ? { phone: phone.trim() } : null,
    };

    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recruits`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(record),
      }
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Supabase insert error:', errText);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to add recruit' }) };
    }

    const result = await insertRes.json();
    console.log(`Manually added recruit: ${emailLower}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, recruit: result }) };

  } catch (error) {
    console.error('Add recruit error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to add recruit' }) };
  }
};
