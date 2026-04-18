/**
 * Netlify Serverless Function — Appointment Form Q&A PDF Generator
 * ================================================================
 * When the appointment form is submitted, this function:
 *   1. Receives the form data as JSON
 *   2. Generates a clean, readable Q&A PDF listing every question and answer
 *   3. Emails the PDF to Kara as an attachment via Resend
 *   4. Forwards a text summary to Web3Forms as backup
 *
 * Required environment variables (set in Netlify dashboard):
 *   RESEND_API_KEY       — from resend.com (free tier: 100 emails/day)
 *   KARA_EMAIL           — kara.r.andrews.mil@army.mil (or personal email)
 *   WEB3FORMS_ACCESS_KEY — from web3forms.com (public form key)
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// ─── PDF LAYOUT CONSTANTS ───
const PAGE_WIDTH = 612;   // Letter size
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Colors
const ARMY_GOLD = rgb(0.77, 0.65, 0.35);      // #C5A55A
const DARK_TEXT = rgb(0.1, 0.1, 0.1);
const SECTION_BG = rgb(0.95, 0.93, 0.88);
const LIGHT_LINE = rgb(0.85, 0.83, 0.78);
const MUTED_TEXT = rgb(0.4, 0.4, 0.4);

// ─── DEFINE THE QUESTION SECTIONS ───
// Each section maps form field names to their display labels.
// Order matters — this is the order they appear in the PDF.
const SECTIONS = [
  {
    title: 'BASIC INFORMATION',
    fields: [
      { key: 'first_name', label: 'First Name' },
      { key: 'middle_name', label: 'Middle Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'suffix', label: 'Suffix' },
      { key: 'gender', label: 'Gender' },
      { key: 'ssn', label: 'Social Security Number' },
    ]
  },
  {
    title: 'PERSONAL INFORMATION',
    fields: [
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'age', label: 'Age' },
      { key: 'birth_city', label: 'Place of Birth — City' },
      { key: 'birth_state', label: 'Place of Birth — State' },
      { key: 'birth_county', label: 'Place of Birth — County' },
      { key: 'primary_phone', label: 'Primary Phone' },
      { key: 'secondary_phone', label: 'Secondary Phone' },
      { key: 'email', label: 'Email' },
      { key: 'street_address', label: 'Current Address — Street' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'county', label: 'County' },
      { key: 'zip_code', label: 'ZIP Code' },
    ]
  },
  {
    title: 'EDUCATION',
    fields: [
      { key: 'high_school_name', label: 'High School Name' },
      { key: 'hs_grad_date', label: 'High School Graduation Date' },
      { key: 'college_name', label: 'Last College Attended' },
      { key: 'college_grad_date', label: 'College Graduation Date' },
      { key: 'credit_hours', label: 'College Credit Hours Earned' },
      { key: 'credit_type', label: 'Credit Type (Semester / Quarter)' },
    ]
  },
  {
    title: 'PHYSICAL & IDENTIFICATION',
    fields: [
      { key: 'primary_race', label: 'Primary Race' },
      { key: 'ethnicity', label: 'Ethnic Category' },
      { key: 'religion', label: 'Religion' },
      { key: '_height', label: 'Height', computed: (d) => {
        if (d.height_ft || d.height_in) return `${d.height_ft || '?'}'${d.height_in || '0'}"`;
        return '';
      }},
      { key: 'weight', label: 'Weight (lbs)' },
      { key: 'eye_color', label: 'Eye Color' },
      { key: 'hair_color', label: 'Hair Color' },
      { key: 'drivers_license', label: "Driver's License #" },
      { key: 'dl_state', label: 'DL State' },
      { key: 'dl_expiration', label: 'DL Expiration' },
      { key: 'citizenship', label: 'Citizenship' },
      { key: 'alien_number', label: 'Alien #' },
    ]
  },
  {
    title: 'PERSONAL & FAMILY',
    fields: [
      { key: 'marital_status', label: 'Marital Status' },
      { key: 'has_children', label: 'Children' },
      { key: 'children_ages', label: 'Ages of Children' },
      { key: 'registered_voter', label: 'Registered to Vote' },
      { key: 'last_menstrual_cycle', label: 'Last Menstrual Cycle (Females Only)' },
      { key: 'alias_1_name', label: 'Alias / Maiden Name #1' },
      { key: '_alias_1_dates', label: 'Alias #1 Dates', computed: (d) => {
        if (d.alias_1_from) return `${d.alias_1_from} to ${d.alias_1_to || 'present'}`;
        return '';
      }},
      { key: 'alias_2_name', label: 'Alias / Maiden Name #2' },
      { key: '_alias_2_dates', label: 'Alias #2 Dates', computed: (d) => {
        if (d.alias_2_from) return `${d.alias_2_from} to ${d.alias_2_to || 'present'}`;
        return '';
      }},
    ]
  },
  {
    title: 'ARMED FORCES PRIOR SERVICE',
    fields: [
      { key: 'prior_service', label: 'Previously Served in Armed Forces' },
      { key: 'service_branch', label: 'Service Branch' },
      { key: 're_code', label: 'RE-Code' },
      { key: 'mos', label: 'MOS' },
      { key: 'pay_grade', label: 'Pay Grade' },
      { key: 'separation_reason', label: 'Narrative Reason for Separation' },
      { key: 'separation_code', label: 'Separation Code' },
      { key: 'enlistment_date', label: 'Enlistment Date' },
      { key: 'date_of_rank', label: 'Date of Rank' },
      { key: 'discharge_date', label: 'Discharge Date' },
    ]
  },
];

// ─── GENERATE CLEAN Q&A PDF ───
async function generateQAPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  // Helper: add a new page if we're running low on space
  function ensureSpace(needed) {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  // ── HEADER ──
  const applicantName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Gold accent bar at top
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: ARMY_GOLD,
  });

  // Title
  y -= 10;
  page.drawText('APPOINTMENT SCREENING FORM', {
    x: MARGIN_LEFT,
    y,
    size: 20,
    font: fontBold,
    color: DARK_TEXT,
  });
  y -= 18;
  page.drawText('Personal Screening Information — 680-3A-E', {
    x: MARGIN_LEFT,
    y,
    size: 10,
    font: fontRegular,
    color: MUTED_TEXT,
  });

  // Applicant name + date on right side
  const dateWidth = fontRegular.widthOfTextAtSize(today, 9);
  page.drawText(today, {
    x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth,
    y: y + 18,
    size: 9,
    font: fontRegular,
    color: MUTED_TEXT,
  });

  // Applicant name
  y -= 6;
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - 24,
    width: CONTENT_WIDTH,
    height: 28,
    color: rgb(0.96, 0.94, 0.89),
  });
  page.drawText(`Applicant: ${applicantName}`, {
    x: MARGIN_LEFT + 10,
    y: y - 17,
    size: 13,
    font: fontBold,
    color: DARK_TEXT,
  });
  y -= 38;

  // Thin separator line
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.5,
    color: LIGHT_LINE,
  });
  y -= 20;

  // ── SECTIONS ──
  for (const section of SECTIONS) {
    // Filter to only fields that have values
    const filledFields = section.fields.filter(f => {
      if (f.computed) return !!f.computed(data);
      return !!data[f.key];
    });

    // Skip section entirely if nothing was filled in
    if (filledFields.length === 0) continue;

    // Section header
    ensureSpace(50);
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: y - 4,
      width: CONTENT_WIDTH,
      height: 20,
      color: ARMY_GOLD,
    });
    page.drawText(section.title, {
      x: MARGIN_LEFT + 8,
      y: y,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    y -= 24;

    // Q&A rows
    let rowIndex = 0;
    for (const field of filledFields) {
      const value = field.computed ? field.computed(data) : (data[field.key] || '');
      if (!value) continue;

      ensureSpace(28);

      // Alternating row backgrounds for readability
      if (rowIndex % 2 === 0) {
        page.drawRectangle({
          x: MARGIN_LEFT,
          y: y - 6,
          width: CONTENT_WIDTH,
          height: 22,
          color: rgb(0.97, 0.97, 0.96),
        });
      }

      // Label (left column)
      page.drawText(field.label + ':', {
        x: MARGIN_LEFT + 8,
        y: y,
        size: 9,
        font: fontBold,
        color: MUTED_TEXT,
      });

      // Value (right column — positioned at 45% from left)
      const valueX = MARGIN_LEFT + CONTENT_WIDTH * 0.45;
      const maxValueWidth = CONTENT_WIDTH * 0.53;

      // Handle long values by truncating with ellipsis
      let displayValue = value;
      let fontSize = 10;
      while (fontRegular.widthOfTextAtSize(displayValue, fontSize) > maxValueWidth && fontSize > 7) {
        fontSize -= 0.5;
      }
      if (fontRegular.widthOfTextAtSize(displayValue, fontSize) > maxValueWidth) {
        while (fontRegular.widthOfTextAtSize(displayValue + '...', fontSize) > maxValueWidth && displayValue.length > 5) {
          displayValue = displayValue.slice(0, -1);
        }
        displayValue += '...';
      }

      page.drawText(displayValue, {
        x: valueX,
        y: y,
        size: fontSize,
        font: fontRegular,
        color: DARK_TEXT,
      });

      y -= 22;
      rowIndex++;
    }

    y -= 12; // Gap between sections
  }

  // ── FOOTER ──
  ensureSpace(40);
  y -= 10;
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.5,
    color: LIGHT_LINE,
  });
  y -= 14;
  page.drawText('Generated by Brazen Recruits — brazenrecruits.com', {
    x: MARGIN_LEFT,
    y,
    size: 8,
    font: fontRegular,
    color: MUTED_TEXT,
  });
  const footerRight = 'For SGT Kara Andrews — Texas Army National Guard';
  const frWidth = fontRegular.widthOfTextAtSize(footerRight, 8);
  page.drawText(footerRight, {
    x: PAGE_WIDTH - MARGIN_RIGHT - frWidth,
    y,
    size: 8,
    font: fontRegular,
    color: MUTED_TEXT,
  });

  // Add gold bar at bottom of every page
  const pages = pdfDoc.getPages();
  for (const p of pages) {
    p.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 4,
      color: ARMY_GOLD,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

// ─── SEND EMAIL VIA RESEND ───
async function sendEmail(recipientEmail, pdfBuffer, applicantName) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const pdfBase64 = pdfBuffer.toString('base64');
  const safeName = applicantName.replace(/[^a-zA-Z0-9_-]/g, '_');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Brazen Recruits <packets@brazenrecruits.com>',
      to: [recipientEmail],
      subject: `Appointment Form: ${applicantName}`,
      text: [
        `New appointment request from ${applicantName}.`,
        '',
        'A PDF with the complete screening information is attached.',
        '',
        '— Brazen Recruits',
      ].join('\n'),
      attachments: [
        {
          filename: `Appointment_${safeName}.pdf`,
          content: pdfBase64,
        },
      ],
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Resend error: ${JSON.stringify(result)}`);
  }
  return result;
}

// ─── FORWARD TO WEB3FORMS (backup) ───
async function forwardToWeb3Forms(data) {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) {
    console.error('WEB3FORMS_ACCESS_KEY not set');
    return { success: false };
  }
  const applicantName = `${data.first_name || ''} ${data.last_name || ''}`.trim();

  const shortMessage = [
    `Name: ${data.last_name || ''}, ${data.first_name || ''} ${data.middle_name || ''}`,
    `Gender: ${data.gender || ''}  |  DOB: ${data.date_of_birth || ''}  |  Age: ${data.age || ''}`,
    `Phone: ${data.primary_phone || ''}  |  Email: ${data.email || ''}`,
    `Address: ${data.street_address || ''}, ${data.city || ''}, ${data.state || ''} ${data.zip_code || ''}`,
    `Prior Service: ${data.prior_service || 'No'}`,
    '',
    'Full Q&A PDF was generated and emailed separately.',
  ].join('\n');

  const payload = {
    access_key: accessKey,
    subject: `Appointment Request: ${applicantName}`,
    from_name: 'Brazen Recruits Appointment Form',
    message: shortMessage,
    'Applicant Name': applicantName,
    'Phone': data.primary_phone || '',
    'Email': data.email || '',
  };

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'BrazenRecruits/1.0',
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.error('Web3Forms non-JSON response:', text.substring(0, 300));
      return { success: false, error: 'Non-JSON response' };
    }
  } catch (e) {
    console.error('Web3Forms forwarding failed:', e.message);
    return { success: false };
  }
}

// ─── MAIN HANDLER ───
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!data.first_name || !data.last_name) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing name fields' }) };
  }

  const applicantName = `${data.first_name} ${data.last_name}`;
  const karaEmail = process.env.KARA_EMAIL || 'kara.r.andrews.mil@army.mil';

  console.log(`Processing appointment form for: ${applicantName}`);

  try {
    // Generate PDF and forward to Web3Forms in parallel
    const [pdfBuffer, _web3Result] = await Promise.all([
      generateQAPdf(data),
      forwardToWeb3Forms(data),
    ]);

    // Send the PDF email to Kara
    const emailResult = await sendEmail(karaEmail, pdfBuffer, applicantName);

    console.log(`Appointment PDF sent for ${applicantName}: ${emailResult.id || 'ok'}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Appointment form processed for ${applicantName}`,
      }),
    };
  } catch (error) {
    console.error('PDF generation/email failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
