/**
 * Netlify Serverless Function — Application Form Q&A PDF Generator
 * ================================================================
 * Generates a clean Q&A PDF from the application form and emails it to Kara.
 * Same style as generate-appointment-pdf.js — gold section headers, Q&A rows.
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const ARMY_GOLD = rgb(0.77, 0.65, 0.35);
const DARK_TEXT = rgb(0.1, 0.1, 0.1);
const LIGHT_LINE = rgb(0.85, 0.83, 0.78);
const MUTED_TEXT = rgb(0.4, 0.4, 0.4);

const SECTIONS = [
  {
    title: 'APPLICANT',
    fields: [
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'email', label: 'Email' },
    ]
  },
  {
    title: 'SPOUSE INFORMATION',
    fields: [
      { key: 'is_married', label: 'Married' },
      { key: 'spouse_name', label: 'Spouse Full Name' },
      { key: 'spouse_ssn', label: 'Spouse SSN' },
      { key: 'spouse_dob', label: 'Spouse Date of Birth' },
      { key: 'spouse_marriage_date', label: 'Marriage Date' },
      { key: 'spouse_address', label: 'Spouse Address (if different)' },
    ]
  },
  {
    title: 'DEPENDENTS',
    fields: [
      { key: 'num_dependents_total', label: 'Total Dependents' },
      { key: 'num_dependents_minor', label: 'Minor Dependents' },
    ]
  },
  {
    title: 'EMERGENCY CONTACT',
    fields: [
      { key: 'emergency_contact_name', label: 'Full Name' },
      { key: 'emergency_contact_relationship', label: 'Relationship' },
      { key: 'emergency_contact_phone', label: 'Phone' },
      { key: 'emergency_contact_email', label: 'Email' },
      { key: 'emergency_contact_address', label: 'Address' },
    ]
  },
  {
    title: 'PARENT / GUARDIAN',
    fields: [
      { key: 'parent_guardian_name', label: 'Full Name' },
      { key: 'parent_guardian_relationship', label: 'Relationship' },
      { key: 'parent_guardian_phone', label: 'Phone' },
    ]
  },
  {
    title: 'PRIMARY BENEFICIARY 1',
    fields: [
      { key: 'beneficiary_1_name', label: 'Full Name' },
      { key: 'beneficiary_1_address', label: 'Address' },
      { key: 'beneficiary_1_relationship', label: 'Relationship' },
      { key: 'beneficiary_1_percentage', label: 'Percentage' },
    ]
  },
  {
    title: 'PRIMARY BENEFICIARY 2',
    fields: [
      { key: 'beneficiary_2_name', label: 'Full Name' },
      { key: 'beneficiary_2_address', label: 'Address' },
      { key: 'beneficiary_2_relationship', label: 'Relationship' },
      { key: 'beneficiary_2_percentage', label: 'Percentage' },
    ]
  },
  {
    title: 'CONTINGENT BENEFICIARY',
    fields: [
      { key: 'contingent_beneficiary_name', label: 'Full Name' },
      { key: 'contingent_beneficiary_address', label: 'Address' },
      { key: 'contingent_beneficiary_relationship', label: 'Relationship' },
      { key: 'contingent_beneficiary_percentage', label: 'Percentage' },
    ]
  },
  {
    title: 'MEDICAL INFORMATION',
    fields: [
      { key: 'medical_insurer_name', label: 'Insurance Provider' },
      { key: 'medical_insurer_address', label: 'Insurance Address' },
      { key: 'medical_provider_name', label: 'Primary Care Doctor / Clinic' },
      { key: 'medical_provider_address', label: 'Doctor / Clinic Address' },
    ]
  },
  {
    title: 'TATTOOS',
    fields: [
      { key: 'has_tattoos', label: 'Has Tattoos' },
      { key: 'tattoo_1', label: 'Tattoo 1' },
      { key: 'tattoo_2', label: 'Tattoo 2' },
      { key: 'tattoo_3', label: 'Tattoo 3' },
      { key: 'tattoo_4', label: 'Tattoo 4' },
      { key: 'tattoo_5', label: 'Tattoo 5' },
      { key: 'tattoo_6', label: 'Tattoo 6' },
    ]
  },
  {
    title: 'EDUCATION DETAILS',
    fields: [
      { key: 'hs_street_address', label: 'High School Street Address' },
      { key: '_hs_location', label: 'High School City/State/ZIP', computed: (d) => {
        const parts = [d.hs_city, d.hs_state, d.hs_zip].filter(Boolean);
        return parts.length ? parts.join(', ') : '';
      }},
      { key: 'hs_grade_level', label: 'Current Grade Level' },
      { key: 'degree', label: 'Degree Earned or Pursuing' },
    ]
  },
];

async function generateQAPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function ensureSpace(needed) {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  const applicantName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Gold bar top
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: ARMY_GOLD });

  // Title
  y -= 10;
  page.drawText('ENLISTMENT APPLICATION', {
    x: MARGIN_LEFT, y, size: 20, font: fontBold, color: DARK_TEXT,
  });
  y -= 18;
  page.drawText('Supplemental Information — Spouse, Emergency, Beneficiary, Medical, Education', {
    x: MARGIN_LEFT, y, size: 9, font: fontRegular, color: MUTED_TEXT,
  });

  const dateWidth = fontRegular.widthOfTextAtSize(today, 9);
  page.drawText(today, { x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth, y: y + 18, size: 9, font: fontRegular, color: MUTED_TEXT });

  // Applicant name bar
  y -= 6;
  page.drawRectangle({ x: MARGIN_LEFT, y: y - 24, width: CONTENT_WIDTH, height: 28, color: rgb(0.96, 0.94, 0.89) });
  page.drawText(`Applicant: ${applicantName}`, { x: MARGIN_LEFT + 10, y: y - 17, size: 13, font: fontBold, color: DARK_TEXT });
  y -= 38;

  page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: PAGE_WIDTH - MARGIN_RIGHT, y }, thickness: 0.5, color: LIGHT_LINE });
  y -= 20;

  // Sections
  for (const section of SECTIONS) {
    const filledFields = section.fields.filter(f => {
      if (f.computed) return !!f.computed(data);
      return !!data[f.key];
    });
    if (filledFields.length === 0) continue;

    ensureSpace(50);
    page.drawRectangle({ x: MARGIN_LEFT, y: y - 4, width: CONTENT_WIDTH, height: 20, color: ARMY_GOLD });
    page.drawText(section.title, { x: MARGIN_LEFT + 8, y, size: 10, font: fontBold, color: rgb(1, 1, 1) });
    y -= 24;

    let rowIndex = 0;
    for (const field of filledFields) {
      const value = field.computed ? field.computed(data) : (data[field.key] || '');
      if (!value) continue;

      ensureSpace(28);

      if (rowIndex % 2 === 0) {
        page.drawRectangle({ x: MARGIN_LEFT, y: y - 6, width: CONTENT_WIDTH, height: 22, color: rgb(0.97, 0.97, 0.96) });
      }

      page.drawText(field.label + ':', { x: MARGIN_LEFT + 8, y, size: 9, font: fontBold, color: MUTED_TEXT });

      const valueX = MARGIN_LEFT + CONTENT_WIDTH * 0.45;
      const maxValueWidth = CONTENT_WIDTH * 0.53;
      let displayValue = value;
      let fontSize = 10;
      while (fontRegular.widthOfTextAtSize(displayValue, fontSize) > maxValueWidth && fontSize > 7) { fontSize -= 0.5; }
      if (fontRegular.widthOfTextAtSize(displayValue, fontSize) > maxValueWidth) {
        while (fontRegular.widthOfTextAtSize(displayValue + '...', fontSize) > maxValueWidth && displayValue.length > 5) {
          displayValue = displayValue.slice(0, -1);
        }
        displayValue += '...';
      }

      page.drawText(displayValue, { x: valueX, y, size: fontSize, font: fontRegular, color: DARK_TEXT });
      y -= 22;
      rowIndex++;
    }
    y -= 12;
  }

  // Footer
  ensureSpace(40);
  y -= 10;
  page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: PAGE_WIDTH - MARGIN_RIGHT, y }, thickness: 0.5, color: LIGHT_LINE });
  y -= 14;
  page.drawText('Generated by Brazen Recruits — brazenrecruits.com', { x: MARGIN_LEFT, y, size: 8, font: fontRegular, color: MUTED_TEXT });
  const footerRight = 'For SGT Kara Andrews — Texas Army National Guard';
  const frWidth = fontRegular.widthOfTextAtSize(footerRight, 8);
  page.drawText(footerRight, { x: PAGE_WIDTH - MARGIN_RIGHT - frWidth, y, size: 8, font: fontRegular, color: MUTED_TEXT });

  // Gold bar bottom on every page
  for (const p of pdfDoc.getPages()) {
    p.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 4, color: ARMY_GOLD });
  }

  return Buffer.from(await pdfDoc.save());
}

async function sendEmail(recipientEmail, pdfBuffer, applicantName) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const pdfBase64 = pdfBuffer.toString('base64');
  const safeName = applicantName.replace(/[^a-zA-Z0-9_-]/g, '_');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Brazen Recruits <packets@brazenrecruits.com>',
      to: [recipientEmail],
      subject: `Application Complete: ${applicantName}`,
      text: `${applicantName} has completed the enlistment application.\n\nThe full Q&A PDF with spouse, emergency contact, beneficiary, medical, and education details is attached.\n\n— Brazen Recruits`,
      attachments: [{ filename: `Application_${safeName}.pdf`, content: pdfBase64 }],
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(`Resend error: ${JSON.stringify(result)}`);
  return result;
}

async function forwardToWeb3Forms(data) {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) { console.error('WEB3FORMS_ACCESS_KEY not set'); return { success: false }; }
  const applicantName = `${data.first_name || ''} ${data.last_name || ''}`.trim();

  const payload = {
    access_key: accessKey,
    subject: `Application Complete: ${applicantName}`,
    from_name: 'Brazen Recruits Application Form',
    message: `${applicantName} submitted the enlistment application. Full Q&A PDF emailed separately.`,
    'Applicant Name': applicantName,
    'Email': data.email || '',
  };

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'BrazenRecruits/1.0' },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    try { return JSON.parse(text); } catch (e) { return { success: false }; }
  } catch (e) {
    console.error('Web3Forms failed:', e.message);
    return { success: false };
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let data;
  try { data = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!data.first_name || !data.last_name) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing name fields' }) };
  }

  const applicantName = `${data.first_name} ${data.last_name}`;
  const karaEmail = process.env.KARA_EMAIL || 'kara.r.andrews.mil@army.mil';

  console.log(`Processing application for: ${applicantName}`);

  try {
    const [pdfBuffer, _web3] = await Promise.all([
      generateQAPdf(data),
      forwardToWeb3Forms(data),
    ]);

    const emailResult = await sendEmail(karaEmail, pdfBuffer, applicantName);
    console.log(`Application PDF sent for ${applicantName}: ${emailResult.id || 'ok'}`);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, message: `Application processed for ${applicantName}` }),
    };
  } catch (error) {
    console.error('Application PDF failed:', error);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
