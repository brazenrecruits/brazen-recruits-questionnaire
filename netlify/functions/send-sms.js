// Netlify Serverless Function — sends SMS via Twilio after form submission
// Triggered by the survey form's JavaScript on submit

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Parse the incoming data
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { phone, firstName, result } = data;

  if (!phone || !firstName) {
    return { statusCode: 400, body: 'Missing phone or firstName' };
  }

  // Twilio credentials from Netlify environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhone) {
    console.error('Missing Twilio environment variables');
    return { statusCode: 500, body: 'Server configuration error' };
  }

  // Build the SMS message based on result
  let message;
  if (result === 'RED') {
    message = `Hey ${firstName}, this is SGT Andrews with the Texas Army National Guard. I received your survey responses. Even though some answers flagged, there may still be options — every situation is different. Text or call me directly to talk: 903-372-0877`;
  } else if (result === 'YELLOW') {
    message = `Hey ${firstName}, this is SGT Andrews with the Texas Army National Guard! Got your survey — you have some great potential. A couple items need a quick review, but that's totally normal. Here are 3 things most people don't know about the Guard: https://brazenrecruits-survey.netlify.app/faq.html\n\nText or call me directly: 903-372-0877`;
  } else {
    message = `Hey ${firstName}, this is SGT Andrews with the Texas Army National Guard! Based on your survey, you look like a strong candidate. Here are 3 things most people don't know about the Guard: https://brazenrecruits-survey.netlify.app/faq.html\n\nText or call me directly: 903-372-0877`;
  }

  // Send via Twilio REST API (no npm package needed)
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  // Clean the phone number — strip everything except digits, add +1 if needed
  let cleanPhone = phone.replace(/[^\d]/g, '');
  if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  const params = new URLSearchParams();
  params.append('To', cleanPhone);
  params.append('From', twilioPhone);
  params.append('Body', message);

  try {
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const responseData = await response.json();

    if (response.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, sid: responseData.sid }),
      };
    } else {
      console.error('Twilio error:', responseData);
      return {
        statusCode: response.status,
        body: JSON.stringify({ success: false, error: responseData.message }),
      };
    }
  } catch (error) {
    console.error('SMS send failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to send SMS' }),
    };
  }
};
