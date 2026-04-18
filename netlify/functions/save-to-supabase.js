/**
 * Netlify Serverless Function — Save Recruit Data to Supabase
 * ============================================================
 * Called by all three forms (appointment, eligibility, application) after submission.
 * Upserts a recruit record keyed by email, tracking which forms have been completed.
 *
 * Required environment variables:
 *   SUPABASE_URL      — Your Supabase project URL (e.g. https://xxxx.supabase.co)
 *   SUPABASE_ANON_KEY — Supabase anon/public key (safe for serverless functions)
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase env vars not set');
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, warning: 'Supabase not configured' }) };
  }

  let data;
  try { data = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { form_type, first_name, last_name, email } = data;
  if (!form_type || !first_name || !last_name || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields (form_type, first_name, last_name, email)' }) };
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // 1. Check if recruit already exists by email
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recruits?email=eq.${encodeURIComponent(emailLower)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const existing = await getRes.json();

    // Build the update/insert payload
    const now = new Date().toISOString();
    const formDataField = `${form_type}_data`;
    const formCompleteField = `${form_type}_complete`;
    const formDateField = `${form_type}_completed_at`;

    // Store all form data as JSON, plus mark form as complete
    const record = {
      email: emailLower,
      first_name: first_name,
      last_name: last_name,
      [formCompleteField]: true,
      [formDateField]: now,
      [formDataField]: data,
      updated_at: now,
    };

    if (existing && existing.length > 0) {
      // UPDATE existing record
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/recruits?email=eq.${encodeURIComponent(emailLower)}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(record),
        }
      );
      const result = await updateRes.json();
      console.log(`Updated recruit ${emailLower} with ${form_type} data`);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'updated', recruit: emailLower }) };
    } else {
      // INSERT new record
      record.created_at = now;
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
      const result = await insertRes.json();
      console.log(`Created recruit ${emailLower} with ${form_type} data`);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'created', recruit: emailLower }) };
    }
  } catch (error) {
    console.error('Supabase error:', error);
    // Don't fail the form submission — just log it
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, warning: 'Database save failed but form submission succeeded' }) };
  }
};
