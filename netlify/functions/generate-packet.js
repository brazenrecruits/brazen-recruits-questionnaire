/**
 * Netlify Serverless Function — MEPS Flash Packet Auto-Generator
 * ================================================================
 * When the screening form is submitted, this function:
 *   1. Receives the form data as JSON
 *   2. Generates a pre-filled MEPS Flash Packet PDF using pdf-lib
 *   3. Emails the filled PDF to Kara as an attachment via Resend
 *   4. Also forwards the data to Web3Forms (so she still gets the text email)
 *
 * Required environment variables (set in Netlify dashboard):
 *   RESEND_API_KEY       — from resend.com (free tier: 100 emails/day)
 *   KARA_EMAIL           — kara.r.andrews.mil@army.mil (or personal email)
 *   WEB3FORMS_ACCESS_KEY — from web3forms.com (public form key)
 */

const { PDFDocument } = require('pdf-lib');

// ─── PDF TEMPLATE (embedded as base64) ───
// The blank MEPS Flash Packet is embedded directly so it works
// regardless of how Netlify bundles the function (esbuild, nft, etc.)
const PDF_TEMPLATE_B64 = require('./meps-template-b64.js');
const PDF_TEMPLATE = Buffer.from(PDF_TEMPLATE_B64, 'base64');

// ─── FIELD WIDTH TABLE (measured from PDF template, in points) ───
// Used by setTextFit() to auto-scale font size so text never overflows.
const FIELD_WIDTHS = {
  // Cover
  cover_applicant_name: 350, cover_mos: 120, cover_prid: 120, cover_ship_date: 120,
  // Applicant info
  app_first_name: 200, app_last_name: 220, app_mi: 50, app_suffix: 80,
  app_street: 512, app_city: 250, app_state: 50, app_zip: 80,
  app_phone: 200, app_email: 250, app_dob: 130, app_ssn: 120,
  app_height_ft: 80, app_height_in: 80, app_weight_lbs: 100,
  app_city_birth: 200, app_county_birth: 200, app_state_birth: 150,
  app_dependents_total: 100, app_dependents_minor: 100,
  app_prid: 120, app_rank_grade: 160,
  // School
  school_name: 512, school_street: 512, school_city: 250,
  school_state: 50, school_zip: 80, school_grade_level: 250,
  // Spouse
  spouse_name: 512, spouse_address: 512, spouse_dob: 140,
  spouse_marriage_date: 140, spouse_ssn: 160,
  // Emergency contact
  emergency_name: 512, emergency_address: 512, emergency_phone: 220, emergency_email: 230,
  // Tattoos (the tight ones — most likely to overflow)
  tattoo_0_description: 171, tattoo_0_location: 116, tattoo_0_meaning: 146,
  tattoo_1_description: 171, tattoo_1_location: 116, tattoo_1_meaning: 146,
  tattoo_2_description: 171, tattoo_2_location: 116, tattoo_2_meaning: 146,
  tattoo_3_description: 171, tattoo_3_location: 116, tattoo_3_meaning: 146,
  tattoo_4_description: 171, tattoo_4_location: 116, tattoo_4_meaning: 146,
  tattoo_5_description: 171, tattoo_5_location: 116, tattoo_5_meaning: 146,
  // Beneficiaries (also narrow)
  primary_benef_0_name: 216, primary_benef_0_relation: 106, primary_benef_0_pct: 76,
  primary_benef_1_name: 216, primary_benef_1_relation: 106, primary_benef_1_pct: 76,
  primary_benef_2_name: 216, primary_benef_2_relation: 106, primary_benef_2_pct: 76,
  contingent_benef_0_name: 216, contingent_benef_0_relation: 106, contingent_benef_0_pct: 76,
  // Beneficiary fields (old names used in mapping)
  beneficiary_1_name: 216, beneficiary_1_relationship: 106, beneficiary_1_percentage: 76,
  beneficiary_1_address: 512,
  beneficiary_2_name: 216, beneficiary_2_relationship: 106, beneficiary_2_percentage: 76,
  beneficiary_2_address: 512,
  contingent_name: 216, contingent_relationship: 106, contingent_percentage: 76,
  contingent_address: 512,
  // W-4
  w4_first_name: 300, w4_last_name: 160, w4_address: 512,
  w4_city: 250, w4_state: 50, w4_zip: 80,
  // DD 1966
  dd1966_name: 512,
  // Medical release
  med_release_name: 512, med_release_dob: 140, med_release_address: 512,
  med_release_phone: 200, med_release_insurer: 512, med_release_insurer_addr: 512,
  med_release_provider: 512, med_release_provider_addr: 512,
  // Drug/Alcohol form
  form408_name: 280,
  // Cerumen
  ear_wax_patient_name: 250, ear_wax_patient_dob: 140,
  // HRR 900
  hrr900_student_name: 280, hrr900_school_name: 512,
  hrr900_school_city: 250, hrr900_school_state: 50, hrr900_school_zip: 80,
  hrr900_parent_name: 250,
  // HRR 907
  hrr907_applicant: 250,
};

// Default width for fields not in the table (generous assumption)
const DEFAULT_FIELD_WIDTH = 300;

// Font-size tiers to try, from preferred (largest) to fallback (smallest).
// avg char width ≈ 0.52 × fontSize for Helvetica (pdf-lib default)
const FONT_TIERS = [
  { size: 10, charFactor: 0.52 },
  { size: 9,  charFactor: 0.52 },
  { size: 8,  charFactor: 0.52 },
  { size: 7,  charFactor: 0.52 },
  { size: 6,  charFactor: 0.52 },
];

/**
 * Set text on a PDF form field, auto-scaling font size to fit.
 * If even the smallest tier can't fit, the text is truncated with "…".
 */
function setTextFit(field, fieldName, value) {
  const text = String(value);
  if (!text) return;

  const widthPts = FIELD_WIDTHS[fieldName] || DEFAULT_FIELD_WIDTH;

  for (const tier of FONT_TIERS) {
    const maxChars = Math.floor(widthPts / (tier.charFactor * tier.size));
    if (text.length <= maxChars) {
      field.setFontSize(tier.size);
      field.setText(text);
      return;
    }
  }

  // Even smallest font can't fit — truncate to fit at smallest tier
  const smallest = FONT_TIERS[FONT_TIERS.length - 1];
  const maxChars = Math.floor(widthPts / (smallest.charFactor * smallest.size));
  field.setFontSize(smallest.size);
  field.setText(text.substring(0, Math.max(maxChars - 1, 1)) + '\u2026');
}

// ─── HELPERS ───
function formatDate(dateStr) {
  if (!dateStr) return '';
  // Convert YYYY-MM-DD → MM/DD/YYYY for display
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return dateStr.trim();
}

// ─── FIELD MAPPING ───
function mapFormDataToPDFFields(data) {
  const get = (key, fallback = '') => (data[key] || fallback || '').trim();

  const first = get('first_name');
  const last = get('last_name');
  const mi = get('middle_name', '').charAt(0);
  const suffix = get('suffix');
  const dob = formatDate(get('date_of_birth'));

  let fullName = `${last}, ${first}`;
  if (mi) fullName += ` ${mi}.`;

  const fields = {}; // text fields
  const checks = []; // checkbox field names to check

  // ── Cover page ──
  fields['cover_applicant_name'] = fullName;

  // ── Page 2: Applicant Info ──
  fields['app_first_name'] = first;
  fields['app_last_name'] = last;
  fields['app_mi'] = mi;
  fields['app_suffix'] = suffix;
  fields['app_street'] = get('street_address');
  fields['app_city'] = get('city');
  fields['app_state'] = get('state');
  fields['app_zip'] = get('zip_code');
  fields['app_phone'] = get('primary_phone');
  fields['app_email'] = get('email');
  fields['app_dob'] = dob;
  fields['app_height_ft'] = get('height_ft');
  fields['app_height_in'] = get('height_in');
  fields['app_weight_lbs'] = get('weight');
  // SSN
  fields['app_ssn'] = get('ssn');

  // Place of birth (new separate fields)
  fields['app_city_birth'] = get('city_of_birth') || get('place_of_birth', '').split(',')[0];
  fields['app_county_birth'] = get('county_of_birth') || get('county');
  fields['app_state_birth'] = get('state_of_birth');

  // Dependents
  fields['app_dependents_total'] = get('num_dependents_total', '0');
  fields['app_dependents_minor'] = get('num_dependents_minor', '0');
  if (get('children') === 'No') {
    fields['app_dependents_total'] = '0';
    fields['app_dependents_minor'] = '0';
  }

  // Gender
  const gender = get('gender');
  if (gender === 'Male') {
    checks.push('app_gender_m', 'app_dob_gender_m');
  } else if (gender === 'Female') {
    checks.push('app_gender_f', 'app_dob_gender_f');
  }

  // ── Page 3: Marital Status ──
  const marital = get('marital_status');
  if (marital === 'Never Married' || marital === 'Single') {
    checks.push('marital_w4_single', 'marital_sglv_single');
  } else if (marital === 'Married') {
    checks.push('marital_w4_mfj', 'marital_sglv_married');
  } else if (marital === 'Divorced') {
    checks.push('marital_w4_single', 'marital_sglv_single');
  } else if (marital === 'Separated') {
    checks.push('marital_w4_mfs', 'marital_sglv_married');
  }

  // ── Ethnic / Racial ──
  const ethnicity = get('ethnicity');
  if (ethnicity.includes('Not')) {
    checks.push('ethnic_not_hispanic');
  } else if (ethnicity.includes('Hispanic')) {
    checks.push('ethnic_hispanic');
  }

  const raceMap = {
    'American Indian': 'race_native_american',
    'Alaskan Native': 'race_native_american',
    'Asian': 'race_asian',
    'Black': 'race_black',
    'African American': 'race_black',
    'Native Hawaiian': 'race_pacific',
    'Pacific Islander': 'race_pacific',
    'White': 'race_white',
  };
  const race = get('primary_race');
  for (const [keyword, fieldName] of Object.entries(raceMap)) {
    if (race.includes(keyword)) {
      checks.push(fieldName);
      break;
    }
  }

  // ── School ──
  fields['school_name'] = get('high_school');
  if (get('hs_street_address')) fields['school_address'] = get('hs_street_address');
  fields['school_city'] = get('hs_city');
  fields['school_state'] = get('hs_state');
  fields['school_zip'] = get('hs_zip');
  if (get('hs_grade_level')) fields['school_grade_level'] = get('hs_grade_level');

  // ── Beneficiaries ──
  if (get('beneficiary_1_name')) {
    fields['beneficiary_1_name'] = get('beneficiary_1_name');
    if (get('beneficiary_1_address')) fields['beneficiary_1_address'] = get('beneficiary_1_address');
    if (get('beneficiary_1_relationship')) fields['beneficiary_1_relationship'] = get('beneficiary_1_relationship');
    if (get('beneficiary_1_percentage')) fields['beneficiary_1_percentage'] = get('beneficiary_1_percentage');
  }
  if (get('beneficiary_2_name')) {
    fields['beneficiary_2_name'] = get('beneficiary_2_name');
    if (get('beneficiary_2_address')) fields['beneficiary_2_address'] = get('beneficiary_2_address');
    if (get('beneficiary_2_relationship')) fields['beneficiary_2_relationship'] = get('beneficiary_2_relationship');
    if (get('beneficiary_2_percentage')) fields['beneficiary_2_percentage'] = get('beneficiary_2_percentage');
  }
  if (get('contingent_beneficiary_name')) {
    fields['contingent_name'] = get('contingent_beneficiary_name');
    if (get('contingent_beneficiary_address')) fields['contingent_address'] = get('contingent_beneficiary_address');
    if (get('contingent_beneficiary_relationship')) fields['contingent_relationship'] = get('contingent_beneficiary_relationship');
    if (get('contingent_beneficiary_percentage')) fields['contingent_percentage'] = get('contingent_beneficiary_percentage');
  }

  // ── Tattoos ──
  const hasTattoos = get('has_tattoos');
  if (hasTattoos === 'Yes') {
    checks.push('tattoo_yes');
  } else if (hasTattoos === 'No') {
    checks.push('tattoo_no');
  }

  for (let i = 1; i <= 6; i++) {
    const raw = get(`tattoo_${i}`);
    if (raw) {
      const parts = raw.split(';').map(s => s.trim());
      const idx = i - 1;
      if (parts[0]) fields[`tattoo_${idx}_description`] = parts[0];
      if (parts[1]) fields[`tattoo_${idx}_location`] = parts[1];
      if (parts[2]) fields[`tattoo_${idx}_meaning`] = parts[2];
    }
  }

  // ── Spouse ──
  if (get('spouse_name')) fields['spouse_name'] = get('spouse_name');
  if (get('spouse_ssn')) fields['spouse_ssn'] = get('spouse_ssn');
  if (get('spouse_dob')) fields['spouse_dob'] = formatDate(get('spouse_dob'));
  if (get('spouse_marriage_date')) fields['spouse_marriage_date'] = formatDate(get('spouse_marriage_date'));
  if (get('spouse_address')) {
    let spouseAddr = get('spouse_address');
    if (get('spouse_city')) spouseAddr += ', ' + get('spouse_city');
    if (get('spouse_state')) spouseAddr += ', ' + get('spouse_state');
    if (get('spouse_zip')) spouseAddr += ' ' + get('spouse_zip');
    fields['spouse_address'] = spouseAddr;
  }

  // ── Emergency Contact ──
  if (get('emergency_contact_name')) fields['emergency_name'] = get('emergency_contact_name');
  if (get('emergency_contact_phone')) fields['emergency_phone'] = get('emergency_contact_phone');
  if (get('emergency_contact_email')) fields['emergency_email'] = get('emergency_contact_email');
  if (get('emergency_contact_address')) fields['emergency_address'] = get('emergency_contact_address');

  // ── W-4 ──
  fields['w4_first_name'] = mi ? `${first} ${mi}` : first;
  fields['w4_last_name'] = last;
  fields['w4_address'] = get('street_address');
  fields['w4_city'] = get('city');
  fields['w4_state'] = get('state');
  fields['w4_zip'] = get('zip_code');

  // ── DD 1966 ──
  let dd1966Name = `${last}, ${first}`;
  if (mi) dd1966Name += `, ${mi}`;
  fields['dd1966_name'] = dd1966Name;

  // Parent/Guardian
  if (get('parent_guardian_name')) {
    fields['hrr900_parent_name'] = get('parent_guardian_name');
  }

  // ── Medical Release ──
  fields['med_release_name'] = fullName;
  fields['med_release_dob'] = dob; // already formatted via formatDate above
  fields['med_release_address'] = [get('street_address'), get('city'), get('state'), get('zip_code')].filter(Boolean).join(', ');
  fields['med_release_phone'] = get('primary_phone');
  if (get('medical_insurer_name')) fields['med_release_insurer'] = get('medical_insurer_name');
  if (get('medical_insurer_address')) fields['med_release_insurer_addr'] = get('medical_insurer_address');
  if (get('medical_provider_name')) fields['med_release_provider'] = get('medical_provider_name');
  if (get('medical_provider_address')) fields['med_release_provider_addr'] = get('medical_provider_address');

  // ── Drug/Alcohol ──
  fields['form408_name'] = fullName;

  // ── Cerumen ──
  fields['ear_wax_patient_name'] = fullName;
  fields['ear_wax_patient_dob'] = dob;

  // ── HRR 900 ──
  fields['hrr900_student_name'] = fullName;
  fields['hrr900_school_name'] = get('high_school');
  if (get('hs_city')) fields['hrr900_school_city'] = get('hs_city');
  if (get('hs_state')) fields['hrr900_school_state'] = get('hs_state');
  if (get('hs_zip')) fields['hrr900_school_zip'] = get('hs_zip');

  // ── HRR 907 ──
  fields['hrr907_applicant'] = fullName;

  return { fields, checks };
}

// ─── PDF GENERATION ───
async function generateFilledPDF(data) {
  if (!PDF_TEMPLATE) throw new Error('PDF template not loaded');

  const pdfDoc = await PDFDocument.load(PDF_TEMPLATE);
  const form = pdfDoc.getForm();
  const { fields, checks } = mapFormDataToPDFFields(data);

  let filled = 0;

  // Fill text fields (auto-scaling font size to prevent overflow)
  for (const [name, value] of Object.entries(fields)) {
    if (!value) continue;
    try {
      const field = form.getTextField(name);
      setTextFit(field, name, value);
      filled++;
    } catch (e) {
      // Field not found — skip silently
    }
  }

  // Check checkboxes
  for (const name of checks) {
    try {
      const cb = form.getCheckBox(name);
      cb.check();
      filled++;
    } catch (e) {
      // Checkbox not found — skip silently
    }
  }

  console.log(`Filled ${filled} fields for ${data.first_name} ${data.last_name}`);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ─── BUILD DETAILED EMAIL BODY (full sectioned format for Web3Forms) ───
function buildDetailedEmailBody(data) {
  const get = (key, fallback = '') => (data[key] || fallback || '').trim();
  const lines = [];

  lines.push('=== SCREENING FORM SUBMISSION ===');
  lines.push('');
  lines.push('--- BASIC INFORMATION ---');
  lines.push(`Name: ${get('last_name')}, ${get('first_name')} ${get('middle_name')} ${get('suffix')}`);
  lines.push(`SSN: ${get('ssn')}`);
  lines.push(`Gender: ${get('gender')}`);
  lines.push(`DOB: ${get('date_of_birth')}  |  Age: ${get('age')}`);
  lines.push(`City of Birth: ${get('city_of_birth')}  |  County: ${get('county_of_birth')}  |  State: ${get('state_of_birth')}  |  Country: ${get('country_of_birth', 'USA')}`);
  lines.push('');
  lines.push('--- CONTACT ---');
  lines.push(`Phone: ${get('primary_phone')}${get('secondary_phone') ? '  |  Alt: ' + get('secondary_phone') : ''}`);
  lines.push(`Email: ${get('email')}`);
  lines.push(`Address: ${get('street_address')}, ${get('city')}, ${get('state')} ${get('zip_code')}${get('county') ? ' (' + get('county') + ' Co.)' : ''}`);
  lines.push('');
  lines.push('--- PHYSICAL / ID ---');
  lines.push(`Height: ${get('height_ft', '?')}'${get('height_in', '0')}"  |  Weight: ${get('weight', '?')} lbs`);
  lines.push(`Eyes: ${get('eye_color')}  |  Hair: ${get('hair_color')}`);
  lines.push(`DL: ${get('drivers_license')}  State: ${get('dl_state')}  Exp: ${get('dl_expiration')}`);
  lines.push(`Citizenship: ${get('citizenship')}${get('alien_number') ? '  Alien #: ' + get('alien_number') : ''}`);
  lines.push(`Race: ${get('primary_race')}  |  Ethnicity: ${get('ethnicity')}`);
  lines.push(`Religion: ${get('religion') || 'N/A'}`);
  lines.push('');
  lines.push('--- PERSONAL / FAMILY ---');
  lines.push(`Marital Status: ${get('marital_status')}${get('spouse_name') ? '  Spouse: ' + get('spouse_name') : ''}`);
  if (get('spouse_ssn')) lines.push(`Spouse SSN: ${get('spouse_ssn')}`);
  if (get('spouse_dob')) lines.push(`Spouse DOB: ${get('spouse_dob')}${get('spouse_marriage_date') ? '  Marriage Date: ' + get('spouse_marriage_date') : ''}`);
  if (get('spouse_address')) {
    let spAddr = get('spouse_address');
    if (get('spouse_city')) spAddr += ', ' + get('spouse_city');
    if (get('spouse_state')) spAddr += ', ' + get('spouse_state');
    if (get('spouse_zip')) spAddr += ' ' + get('spouse_zip');
    lines.push(`Spouse Address: ${spAddr}`);
  }
  lines.push(`# Dependents (Total): ${get('num_dependents_total', '0')}  |  # Dependents (Minor): ${get('num_dependents_minor', '0')}${get('children_ages') ? '  |  Ages: ' + get('children_ages') : ''}`);
  lines.push(`Registered Voter: ${get('registered_voter')}`);
  if (get('last_menstrual_cycle')) lines.push(`Last Menstrual Cycle: ${get('last_menstrual_cycle')}`);
  if (get('aliases')) lines.push(`Aliases: ${get('aliases')}`);
  lines.push('');
  lines.push('--- EMERGENCY CONTACT ---');
  lines.push(`Name: ${get('emergency_contact_name')}${get('emergency_contact_relationship') ? '  (' + get('emergency_contact_relationship') + ')' : ''}`);
  lines.push(`Phone: ${get('emergency_contact_phone')}${get('emergency_contact_email') ? '  Email: ' + get('emergency_contact_email') : ''}`);
  if (get('emergency_contact_address')) lines.push(`Address: ${get('emergency_contact_address')}`);
  if (get('parent_guardian_name')) {
    lines.push('');
    lines.push('--- PARENT / GUARDIAN ---');
    lines.push(`Name: ${get('parent_guardian_name')}${get('parent_guardian_relationship') ? '  (' + get('parent_guardian_relationship') + ')' : ''}`);
    if (get('parent_guardian_phone')) lines.push(`Phone: ${get('parent_guardian_phone')}`);
  }
  lines.push('');
  lines.push('--- BENEFICIARY INFORMATION ---');
  if (get('beneficiary_1_name')) {
    lines.push(`Primary Beneficiary 1: ${get('beneficiary_1_name')}  |  Relationship: ${get('beneficiary_1_relationship')}  |  %: ${get('beneficiary_1_percentage')}`);
    if (get('beneficiary_1_address')) lines.push(`  Address: ${get('beneficiary_1_address')}`);
  }
  if (get('beneficiary_2_name')) {
    lines.push(`Primary Beneficiary 2: ${get('beneficiary_2_name')}  |  Relationship: ${get('beneficiary_2_relationship')}  |  %: ${get('beneficiary_2_percentage')}`);
    if (get('beneficiary_2_address')) lines.push(`  Address: ${get('beneficiary_2_address')}`);
  }
  if (get('contingent_beneficiary_name')) {
    lines.push(`Contingent Beneficiary: ${get('contingent_beneficiary_name')}  |  Relationship: ${get('contingent_beneficiary_relationship')}  |  %: ${get('contingent_beneficiary_percentage')}`);
    if (get('contingent_beneficiary_address')) lines.push(`  Address: ${get('contingent_beneficiary_address')}`);
  }
  lines.push('');
  lines.push('--- MEDICAL & TATTOOS ---');
  if (get('medical_insurer_name')) lines.push(`Insurer: ${get('medical_insurer_name')}${get('medical_insurer_address') ? '  Address: ' + get('medical_insurer_address') : ''}`);
  if (get('medical_provider_name')) lines.push(`Provider: ${get('medical_provider_name')}${get('medical_provider_address') ? '  Address: ' + get('medical_provider_address') : ''}`);
  lines.push(`Tattoos: ${get('has_tattoos') || 'N/A'}`);
  for (let t = 1; t <= 6; t++) {
    if (get(`tattoo_${t}`)) lines.push(`  Tattoo ${t}: ${get(`tattoo_${t}`)}`);
  }
  lines.push('');
  lines.push('--- EDUCATION & PRIOR SERVICE ---');
  lines.push(`High School: ${get('high_school')}  Grad: ${get('hs_grad_date')}${get('hs_grade_level') ? '  Current Grade: ' + get('hs_grade_level') : ''}`);
  if (get('hs_street_address')) lines.push(`HS Address: ${get('hs_street_address')}`);
  if (get('hs_city') || get('hs_state') || get('hs_zip')) {
    lines.push(`HS Location: ${get('hs_city')}, ${get('hs_state')} ${get('hs_zip')}`);
  }
  if (get('college')) lines.push(`College: ${get('college')}  Hours: ${get('credit_hours')}  Degree: ${get('degree')}`);
  lines.push(`Prior Service: ${get('prior_service') || 'No'}`);
  if (get('prior_service') === 'Yes') {
    lines.push(`  Branch: ${get('service_branch')}  MOS: ${get('mos')}  Grade: ${get('pay_grade')}`);
    lines.push(`  RE Code: ${get('re_code')}  Sep Code: ${get('separation_code')}`);
    lines.push(`  Sep Reason: ${get('separation_reason')}`);
    lines.push(`  Enlisted: ${get('enlistment_date')}  Discharged: ${get('discharge_date')}`);
  }

  return lines.join('\n');
}

// ─── BUILD SHORT EMAIL BODY (for Resend packet email) ───
function buildPacketEmailBody(data) {
  const get = (key, fallback = '') => (data[key] || fallback || '').trim();
  const lines = [];

  lines.push(`NEW SCREENING FORM \u2014 ${get('first_name')} ${get('last_name')}`);
  lines.push('');
  lines.push(`Name: ${get('last_name')}, ${get('first_name')} ${get('middle_name')} ${get('suffix')}`);
  lines.push(`Gender: ${get('gender')}  |  DOB: ${get('date_of_birth')}  |  Age: ${get('age')}`);
  lines.push(`Phone: ${get('primary_phone')}  |  Email: ${get('email')}`);
  lines.push(`Address: ${get('street_address')}, ${get('city')}, ${get('state')} ${get('zip_code')}`);
  lines.push('');
  lines.push('The pre-filled MEPS Flash Packet is attached to this email.');
  lines.push('Open it in Adobe Reader, fill in any remaining fields (bank info, beneficiaries, MEPS details), and print.');
  lines.push('');
  lines.push('\u2014 Brazen Recruits Auto-Packet System');

  return lines.join('\n');
}

// ─── SEND EMAIL WITH ATTACHMENT VIA RESEND ───
async function sendPacketEmail(recipientEmail, pdfBuffer, applicantName, formData) {
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
      from: 'MEPS Packet System <packets@brazenrecruits.com>',
      to: [recipientEmail],
      subject: `MEPS Packet Ready: ${applicantName}`,
      text: buildPacketEmailBody(formData),
      attachments: [
        {
          filename: `MEPS_Packet_${safeName}.pdf`,
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

// ─── FORWARD TO WEB3FORMS ───
async function forwardToWeb3Forms(data, emailBody) {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) {
    console.error('WEB3FORMS_ACCESS_KEY not set');
    return { success: false };
  }
  const applicantName = `${data.first_name || ''} ${data.last_name || ''}`.trim();

  // Use a shorter summary for Web3Forms to avoid payload size issues
  const shortMessage = [
    `Name: ${data.last_name || ''}, ${data.first_name || ''} ${data.middle_name || ''}`,
    `Gender: ${data.gender || ''}  |  DOB: ${data.date_of_birth || ''}  |  Age: ${data.age || ''}`,
    `Phone: ${data.primary_phone || ''}  |  Email: ${data.email || ''}`,
    `Address: ${data.street_address || ''}, ${data.city || ''}, ${data.state || ''} ${data.zip_code || ''}`,
    `Prior Service: ${data.prior_service || 'No'}`,
    '',
    'Full MEPS packet was auto-generated and emailed separately.',
  ].join('\n');

  const payload = {
    access_key: accessKey,
    subject: `Screening Form: ${applicantName} \u2014 Schedule Appointment`,
    from_name: 'Brazen Recruits Screening Form',
    message: shortMessage,
    'Applicant Name': applicantName,
    'Phone': data.primary_phone || '',
    'Email': data.email || '',
    'Age': data.age || '',
    'Prior Service': data.prior_service || 'No',
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
    console.log('Web3Forms HTTP status:', response.status);
    console.log('Web3Forms response (first 300 chars):', text.substring(0, 300));
    try {
      const result = JSON.parse(text);
      console.log('Web3Forms result:', JSON.stringify(result));
      return result;
    } catch (parseErr) {
      console.error('Web3Forms returned non-JSON (status ' + response.status + '):', text.substring(0, 300));
      return { success: false, error: 'Non-JSON response from Web3Forms' };
    }
  } catch (e) {
    console.error('Web3Forms forwarding failed:', e.message);
    return { success: false };
  }
}

// ─── MAIN HANDLER ───
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
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

  console.log(`Processing packet for: ${applicantName}`);

  // Run PDF generation + Web3Forms forwarding in parallel
  try {
    const [pdfBuffer, _web3Result] = await Promise.all([
      generateFilledPDF(data),
      forwardToWeb3Forms(data, buildDetailedEmailBody(data)),
    ]);

    // Send the PDF email
    const emailResult = await sendPacketEmail(karaEmail, pdfBuffer, applicantName, data);

    console.log(`Packet sent for ${applicantName}: ${emailResult.id || 'ok'}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `MEPS packet generated and sent for ${applicantName}`,
        fields_filled: Object.keys(mapFormDataToPDFFields(data).fields).length,
      }),
    };
  } catch (error) {
    console.error('Packet generation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        // Still try to forward to Web3Forms so Kara at least gets the text email
      }),
    };
  }
};
