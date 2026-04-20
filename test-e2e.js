/**
 * END-TO-END TEST: MEPS Packet Generator
 * ======================================
 * This script simulates exactly what generate-packet.js does:
 * 1. Load form data
 * 2. Map form data to PDF fields
 * 3. Load PDF templates
 * 4. Fill templates with mapped data
 * 5. Merge all PDFs into single output
 * 6. Log comprehensive field fill statistics
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// ─── LOAD TEMPLATES (base64) ───
const BRAZEN_TEMPLATE_B64 = require('./netlify/functions/meps-template-b64.js');
const BRAZEN_TEMPLATE = Buffer.from(BRAZEN_TEMPLATE_B64, 'base64');

const APP_TEMPLATE_B64 = require('./netlify/functions/application-template-b64.js');
const APP_TEMPLATE = Buffer.from(APP_TEMPLATE_B64, 'base64');

const EARWAX_TEMPLATE_B64 = require('./netlify/functions/earwax-template-b64.js');
const EARWAX_TEMPLATE = Buffer.from(EARWAX_TEMPLATE_B64, 'base64');

// ─── FIELD WIDTH TABLE (from generate-packet.js) ───
const FIELD_WIDTHS = {
  cover_applicant_name: 350, cover_mos: 120, cover_prid: 120, cover_ship_date: 120,
  app_first_name: 200, app_last_name: 220, app_mi: 50, app_suffix: 80,
  app_street: 512, app_city: 250, app_state: 50, app_zip: 80,
  app_phone: 200, app_email: 250, app_dob: 130, app_ssn: 120,
  app_height_ft: 80, app_height_in: 80, app_weight_lbs: 100,
  app_city_birth: 200, app_county_birth: 200, app_state_birth: 150,
  app_dependents_total: 100, app_dependents_minor: 100,
  app_prid: 120, app_rank_grade: 160,
  school_name: 512, school_street: 512, school_city: 250,
  school_state: 50, school_zip: 80, school_grade_level: 250,
  spouse_name: 512, spouse_address: 512, spouse_dob: 140,
  spouse_marriage_date: 140, spouse_ssn: 160,
  emergency_name: 512, emergency_address: 512, emergency_phone: 220, emergency_email: 230,
  tattoo_0_description: 171, tattoo_0_location: 116, tattoo_0_meaning: 146,
  tattoo_1_description: 171, tattoo_1_location: 116, tattoo_1_meaning: 146,
  tattoo_2_description: 171, tattoo_2_location: 116, tattoo_2_meaning: 146,
  tattoo_3_description: 171, tattoo_3_location: 116, tattoo_3_meaning: 146,
  tattoo_4_description: 171, tattoo_4_location: 116, tattoo_4_meaning: 146,
  tattoo_5_description: 171, tattoo_5_location: 116, tattoo_5_meaning: 146,
  primary_benef_0_name: 216, primary_benef_0_relation: 106, primary_benef_0_pct: 76,
  primary_benef_1_name: 216, primary_benef_1_relation: 106, primary_benef_1_pct: 76,
  primary_benef_2_name: 216, primary_benef_2_relation: 106, primary_benef_2_pct: 76,
  contingent_benef_0_name: 216, contingent_benef_0_relation: 106, contingent_benef_0_pct: 76,
  beneficiary_1_name: 216, beneficiary_1_relationship: 106, beneficiary_1_percentage: 76,
  beneficiary_1_address: 512,
  beneficiary_2_name: 216, beneficiary_2_relationship: 106, beneficiary_2_percentage: 76,
  beneficiary_2_address: 512,
  contingent_name: 216, contingent_relationship: 106, contingent_percentage: 76,
  contingent_address: 512,
  w4_first_name: 300, w4_last_name: 160, w4_address: 512,
  w4_city: 250, w4_state: 50, w4_zip: 80,
  dd1966_name: 512,
  med_release_name: 512, med_release_dob: 140, med_release_address: 512,
  med_release_phone: 200, med_release_insurer: 512, med_release_insurer_addr: 512,
  med_release_provider: 512, med_release_provider_addr: 512,
  form408_name: 280,
  ear_wax_patient_name: 250, ear_wax_patient_dob: 140,
  hrr900_student_name: 280, hrr900_school_name: 512,
  hrr900_school_city: 250, hrr900_school_state: 50, hrr900_school_zip: 80,
  hrr900_parent_name: 250,
  hrr907_applicant: 250,
  // RRNCO fields (static — Kara Andrews)
  rrnco_first_name: 250,
  rrnco_mi: 50,
  rrnco_last_name: 250,
  rrnco_rrb_state: 250,
  rrnco_rsid: 100,
  rrnco_rrb_team: 50,
  rrnco_phone: 200,
  rrnco_rank_grade: 160,
  rrnco_street: 512,
  rrnco_city: 250,
  rrnco_state: 50,
  rrnco_zip: 80,
  rrnco_email: 512,
  // MEPS fields (static — Dallas MEPS)
  meps_name: 300,
  meps_address: 512,
  meps_med_records_release: 300,
  // RSP Unit fields
  rsp_street: 512,
  rsp_city_state_zip: 512,
};

const DEFAULT_FIELD_WIDTH = 300;

// Font tiers from generate-packet.js
const FONT_TIERS = [
  { size: 10, charFactor: 0.52 },
  { size: 9,  charFactor: 0.52 },
  { size: 8,  charFactor: 0.52 },
  { size: 7,  charFactor: 0.52 },
  { size: 6,  charFactor: 0.52 },
];

/**
 * Set text on a PDF form field, auto-scaling font size to fit (from generate-packet.js)
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

  const smallest = FONT_TIERS[FONT_TIERS.length - 1];
  const maxChars = Math.floor(widthPts / (smallest.charFactor * smallest.size));
  field.setFontSize(smallest.size);
  field.setText(text.substring(0, Math.max(maxChars - 1, 1)) + '\u2026');
}

/**
 * Format date from YYYY-MM-DD to MM/DD/YYYY
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return dateStr.trim();
}

/**
 * Map form data to BrazenRecruits PDF fields (from generate-packet.js)
 */
function mapFormDataToPDFFields(data) {
  const get = (key, fallback = '') => (data[key] || fallback || '').trim();

  const first = get('first_name');
  const last = get('last_name');
  const mi = get('middle_name', '').charAt(0);
  const suffix = get('suffix');
  const dob = formatDate(get('date_of_birth'));

  let fullName = `${last}, ${first}`;
  if (mi) fullName += ` ${mi}.`;

  const fields = {};
  const checks = [];

  // Cover page
  fields['cover_applicant_name'] = fullName;

  // Page 2: Applicant Info
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
  fields['app_ssn'] = get('ssn');

  // Place of birth
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

  // Marital Status
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

  // Ethnicity
  const ethnicity = get('ethnicity');
  if (ethnicity.includes('Not')) {
    checks.push('ethnic_not_hispanic');
  } else if (ethnicity.includes('Hispanic')) {
    checks.push('ethnic_hispanic');
  }

  // Race
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

  // School
  fields['school_name'] = get('high_school');
  if (get('hs_street_address')) fields['school_address'] = get('hs_street_address');
  fields['school_city'] = get('hs_city');
  fields['school_state'] = get('hs_state');
  fields['school_zip'] = get('hs_zip');
  if (get('hs_grade_level')) fields['school_grade_level'] = get('hs_grade_level');

  // Beneficiaries
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

  // Tattoos
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

  // Spouse
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

  // Emergency Contact
  if (get('emergency_contact_name')) fields['emergency_name'] = get('emergency_contact_name');
  if (get('emergency_contact_phone')) fields['emergency_phone'] = get('emergency_contact_phone');
  if (get('emergency_contact_email')) fields['emergency_email'] = get('emergency_contact_email');
  if (get('emergency_contact_address')) fields['emergency_address'] = get('emergency_contact_address');

  // W-4
  fields['w4_first_name'] = mi ? `${first} ${mi}` : first;
  fields['w4_last_name'] = last;
  fields['w4_address'] = get('street_address');
  fields['w4_city'] = get('city');
  fields['w4_state'] = get('state');
  fields['w4_zip'] = get('zip_code');

  // DD 1966
  let dd1966Name = `${last}, ${first}`;
  if (mi) dd1966Name += `, ${mi}`;
  fields['dd1966_name'] = dd1966Name;

  // Parent/Guardian
  if (get('parent_guardian_name')) {
    fields['hrr900_parent_name'] = get('parent_guardian_name');
  }

  // Medical Release
  fields['med_release_name'] = fullName;
  fields['med_release_dob'] = dob;
  fields['med_release_address'] = [get('street_address'), get('city'), get('state'), get('zip_code')].filter(Boolean).join(', ');
  fields['med_release_phone'] = get('primary_phone');
  if (get('medical_insurer_name')) fields['med_release_insurer'] = get('medical_insurer_name');
  if (get('medical_insurer_address')) fields['med_release_insurer_addr'] = get('medical_insurer_address');
  if (get('medical_provider_name')) fields['med_release_provider'] = get('medical_provider_name');
  if (get('medical_provider_address')) fields['med_release_provider_addr'] = get('medical_provider_address');

  // Drug/Alcohol
  fields['form408_name'] = fullName;

  // Cerumen
  fields['ear_wax_patient_name'] = fullName;
  fields['ear_wax_patient_dob'] = dob;

  // HRR 900
  fields['hrr900_student_name'] = fullName;
  fields['hrr900_school_name'] = get('high_school');
  if (get('hs_city')) fields['hrr900_school_city'] = get('hs_city');
  if (get('hs_state')) fields['hrr900_school_state'] = get('hs_state');
  if (get('hs_zip')) fields['hrr900_school_zip'] = get('hs_zip');

  // HRR 907
  fields['hrr907_applicant'] = fullName;

  // RRNCO Information (static — SGT Kara Andrews)
  fields['rrnco_first_name'] = 'KARA';
  fields['rrnco_mi'] = 'R';
  fields['rrnco_last_name'] = 'ANDREWS';
  fields['rrnco_rrb_state'] = 'TEXAS';
  fields['rrnco_rsid'] = 'TXD';
  fields['rrnco_rrb_team'] = 'D';
  fields['rrnco_phone'] = '903-372-0877';
  fields['rrnco_rank_grade'] = 'SGT / E-5';
  fields['rrnco_street'] = '5001 MAIN ST';
  fields['rrnco_city'] = 'THE COLONY';
  fields['rrnco_state'] = 'TX';
  fields['rrnco_zip'] = '75056';
  fields['rrnco_email'] = 'KARA.R.ANDREWS.MIL@ARMY.MIL';

  // MEPS Information (static — Dallas MEPS)
  fields['meps_name'] = 'DALLAS MEPS C38';
  fields['meps_address'] = '207 S HOUSTON ST';
  fields['meps_med_records_release'] = 'DALLAS MEPS C38';

  // RSP Unit Information (static)
  fields['rsp_street'] = '1775 CALIFORNIA CROSSING RD';
  fields['rsp_city_state_zip'] = 'DALLAS, TX, 75220';

  return { fields, checks };
}

/**
 * Map form data to APPLICATION.pdf fields (from generate-packet.js)
 */
function mapFormDataToApplicationFields(data) {
  const get = (key, fallback = '') => (data[key] || fallback || '').trim();
  const fields = {};
  const checks = [];

  // Beneficiaries
  if (get('beneficiary_1_name')) {
    const parts1 = get('beneficiary_1_name').split(' ');
    fields['Primary Beneficiary First'] = parts1[0] || '';
    fields['Last_3'] = parts1[parts1.length - 1] || '';
    if (parts1.length > 2) fields['Middle_3'] = parts1.slice(1, -1).join(' ');
  }
  if (get('beneficiary_1_address')) {
    // Note: APPLICATION doesn't have dedicated beneficiary address field
  }
  fields['Primary Phone Number'] = get('primary_phone');

  if (get('beneficiary_2_name')) {
    const parts2 = get('beneficiary_2_name').split(' ');
    fields['Secondary Beneficiary First'] = parts2[0] || '';
    fields['Last_4'] = parts2[parts2.length - 1] || '';
    if (parts2.length > 2) fields['Middle_4'] = parts2.slice(1, -1).join(' ');
  }
  fields['Secondary Phone Number_2'] = get('secondary_phone');

  // Foreign Languages
  if (get('foreign_language')) {
    fields['a If so which Languages'] = get('foreign_language');
    checks.push('Check Box37');
  }

  // Spouse
  if (get('spouse_name')) {
    const spouseParts = get('spouse_name').split(' ');
    fields['Current Spouse Name First'] = spouseParts[0] || '';
    if (get('spouse_ssn')) fields['Social Security Number_2'] = get('spouse_ssn');
  }

  // School
  if (get('high_school')) {
    fields['School Name'] = get('high_school');
    if (get('hs_street_address')) fields['School Address Street'] = get('hs_street_address');
  }
  if (get('college')) {
    fields['School Name_2'] = get('college');
  }

  // Mother's Maiden Name
  if (get('mothers_maiden_name')) {
    fields['Mothers Maiden Name'] = get('mothers_maiden_name');
  }

  // Email
  if (get('email')) fields['Email'] = get('email');

  // Current Address
  if (get('street_address')) {
    fields['Current Address'] = get('street_address');
    if (get('city')) fields['City_14'] = get('city');
    if (get('state')) fields['State_16'] = get('state');
    if (get('zip_code')) fields['Zip_2'] = get('zip_code');
    if (get('county')) fields['County_15'] = get('county');
  }

  // Place of Birth
  if (get('city_of_birth')) {
    fields['Place of Birth  City'] = get('city_of_birth');
  }
  if (get('country_of_birth')) {
    fields['Country of Birth'] = get('country_of_birth');
  }

  return { fields, checks };
}

/**
 * Fill form fields on a PDF document
 */
function fillFormFields(form, fields, checks) {
  let filled = 0;
  const errors = [];

  // Fill text fields
  for (const [name, value] of Object.entries(fields)) {
    if (!value) continue;
    try {
      const field = form.getTextField(name);
      setTextFit(field, name, value);
      filled++;
    } catch (e) {
      // Field not found — track error
      errors.push(`Text field not found: ${name}`);
    }
  }

  // Check checkboxes
  for (const name of checks) {
    try {
      const cb = form.getCheckBox(name);
      cb.check();
      filled++;
    } catch (e) {
      // Checkbox not found — track error
      errors.push(`Checkbox not found: ${name}`);
    }
  }

  return { filled, errors };
}

/**
 * Main test function
 */
async function runTest() {
  console.log('========================================');
  console.log('MEPS PACKET GENERATOR E2E TEST');
  console.log('========================================\n');

  // Test data
  const testData = {
    first_name: 'Dallas',
    last_name: 'Andrews',
    middle_name: 'Test',
    date_of_birth: '1993-08-30',
    gender: 'Male',
    ssn: '111-12-1234',
    street_address: '1905 J J Pearce Dr',
    city: 'Richardson',
    state: 'TX',
    zip_code: '75081',
    primary_phone: '469-236-6459',
    email: 'andrewsdallas3@gmail.com',
    ethnicity: 'Not Hispanic',
    primary_race: 'Black',
    marital_status: 'Married',
    high_school: 'Berkner High School',
    hs_city: 'Richardson',
    hs_state: 'TX',
    hs_zip: '75081',
    city_of_birth: 'Dallas',
    county_of_birth: 'Dallas',
    state_of_birth: 'TX',
    num_dependents_total: '1',
    num_dependents_minor: '1',
    beneficiary_1_name: 'Jane Andrews',
    provider_name: 'Dr. Richard Townsend',
    insurance_name: 'Aetna',
  };

  console.log('Test Data:');
  console.log(`  Name: ${testData.last_name}, ${testData.first_name}`);
  console.log(`  DOB: ${testData.date_of_birth}`);
  console.log(`  SSN: ${testData.ssn}`);
  console.log(`  Phone: ${testData.primary_phone}`);
  console.log('');

  try {
    // ─── MAP FORM DATA ───
    console.log('STEP 1: Mapping form data to PDF fields...');
    const { fields: brazenFields, checks: brazenChecks } = mapFormDataToPDFFields(testData);
    const { fields: appFields, checks: appChecks } = mapFormDataToApplicationFields(testData);

    console.log(`  BrazenRecruits fields to fill: ${Object.keys(brazenFields).length}`);
    console.log(`  BrazenRecruits checkboxes to check: ${brazenChecks.length}`);
    console.log(`  APPLICATION fields to fill: ${Object.keys(appFields).length}`);
    console.log(`  APPLICATION checkboxes to check: ${appChecks.length}`);
    console.log('');

    // ─── LOAD TEMPLATES ───
    console.log('STEP 2: Loading PDF templates...');
    if (!BRAZEN_TEMPLATE) throw new Error('BrazenRecruits template not loaded');
    if (!APP_TEMPLATE) throw new Error('APPLICATION template not loaded');
    if (!EARWAX_TEMPLATE) throw new Error('Ear Wax template not loaded');
    console.log('  All templates loaded successfully');
    console.log('');

    // ─── FILL BRAZEN TEMPLATE ───
    console.log('STEP 3: Filling BrazenRecruits template...');
    const brazenDoc = await PDFDocument.load(BRAZEN_TEMPLATE);
    const brazenForm = brazenDoc.getForm();
    const brazenFillResult = fillFormFields(brazenForm, brazenFields, brazenChecks);
    console.log(`  Fields filled: ${brazenFillResult.filled}`);
    console.log(`  Brazen template pages: ${brazenDoc.getPageCount()}`);
    if (brazenFillResult.errors.length > 0) {
      console.log(`  Errors (first 5):`);
      brazenFillResult.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
    }
    brazenForm.flatten();
    const brazenBytes = await brazenDoc.save();
    console.log('');

    // ─── FILL APPLICATION TEMPLATE ───
    console.log('STEP 4: Filling APPLICATION.pdf template...');
    const appDoc = await PDFDocument.load(APP_TEMPLATE);
    const appForm = appDoc.getForm();
    const appFillResult = fillFormFields(appForm, appFields, appChecks);
    console.log(`  Fields filled: ${appFillResult.filled}`);
    console.log(`  APPLICATION template pages: ${appDoc.getPageCount()}`);
    if (appFillResult.errors.length > 0) {
      console.log(`  Errors (first 5):`);
      appFillResult.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
    }
    appForm.flatten();
    const appBytes = await appDoc.save();
    console.log('');

    // ─── FILL EARWAX TEMPLATE ───
    console.log('STEP 5: Filling Ear Wax SF 507 template...');
    const earWaxDoc = await PDFDocument.load(EARWAX_TEMPLATE);
    const helvetica = await earWaxDoc.embedFont(StandardFonts.Helvetica);
    const fullName = `${testData.last_name}, ${testData.first_name} ${testData.middle_name.charAt(0)}`;
    const dob = formatDate(testData.date_of_birth);

    // Page 1: Applicant's Name + DOB
    const earPage1 = earWaxDoc.getPage(0);
    earPage1.drawText(fullName, { x: 155, y: 78, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    earPage1.drawText(dob, { x: 140, y: 50, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    // Page 2: Applicant name in consent line
    if (earWaxDoc.getPageCount() > 1) {
      const earPage2 = earWaxDoc.getPage(1);
      earPage2.drawText(fullName, { x: 325, y: 726, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    }

    console.log(`  Text draws: 3`);
    console.log(`  Ear Wax template pages: ${earWaxDoc.getPageCount()}`);
    const earWaxBytes = await earWaxDoc.save();
    console.log('');

    // ─── MERGE PDFS ───
    console.log('STEP 6: Merging all PDFs...');
    const output = await PDFDocument.create();

    // Load the saved (flattened) PDFs
    const brazenFinal = await PDFDocument.load(brazenBytes);
    const appFinal = await PDFDocument.load(appBytes);
    const earWaxFinal = await PDFDocument.load(earWaxBytes);

    const brazenPageCount = brazenFinal.getPageCount();
    const appPageCount = appFinal.getPageCount();
    const earWaxPageCount = earWaxFinal.getPageCount();

    // BrazenRecruits pages 1-9 (indices 0-8)
    const brazenCustomEnd = Math.min(9, brazenPageCount);
    const brazenCustomPages = await output.copyPages(
      brazenFinal,
      Array.from({ length: brazenCustomEnd }, (_, i) => i)
    );
    brazenCustomPages.forEach(p => output.addPage(p));
    console.log(`  Added BrazenRecruits custom pages: ${brazenCustomPages.length}`);

    // APPLICATION.pdf — all pages
    const applicationPages = await output.copyPages(
      appFinal,
      Array.from({ length: appPageCount }, (_, i) => i)
    );
    applicationPages.forEach(p => output.addPage(p));
    console.log(`  Added APPLICATION.pdf pages: ${applicationPages.length}`);

    // Ear Wax SF 507 — all pages
    const earWaxPages = await output.copyPages(
      earWaxFinal,
      Array.from({ length: earWaxPageCount }, (_, i) => i)
    );
    earWaxPages.forEach(p => output.addPage(p));
    console.log(`  Added Ear Wax pages: ${earWaxPages.length}`);

    // Remaining govt forms from BrazenRecruits template (pages 10+, skip old cerumen pages)
    if (brazenPageCount > 9) {
      const remainingIndices = [];
      for (let i = 9; i < brazenPageCount; i++) {
        // Skip old cerumen pages (indices 16, 17 in the 19-page template)
        if (i === 16 || i === 17) continue;
        remainingIndices.push(i);
      }
      if (remainingIndices.length > 0) {
        const remainingPages = await output.copyPages(brazenFinal, remainingIndices);
        remainingPages.forEach(p => output.addPage(p));
        console.log(`  Added remaining BrazenRecruits govt forms pages: ${remainingPages.length}`);
      }
    }

    console.log('');

    // ─── SAVE OUTPUT ───
    console.log('STEP 7: Saving filled PDF...');
    const pdfBytes = await output.save();
    const outputPath = path.join(__dirname, 'test-filled-output.pdf');
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`  Saved to: ${outputPath}`);
    console.log(`  File size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
    console.log('');

    // ─── SUMMARY ───
    console.log('========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`Applicant: ${testData.last_name}, ${testData.first_name}`);
    console.log(`DOB: ${testData.date_of_birth} → ${formatDate(testData.date_of_birth)}`);
    console.log('');
    console.log('BrazenRecruits Template:');
    console.log(`  Pages: ${brazenPageCount}`);
    console.log(`  Fields mapped: ${Object.keys(brazenFields).length}`);
    console.log(`  Checkboxes mapped: ${brazenChecks.length}`);
    console.log(`  Total filled: ${brazenFillResult.filled}`);
    console.log('  RRNCO Fields (SGT Kara Andrews):');
    console.log(`    - rrnco_first_name: KARA`);
    console.log(`    - rrnco_last_name: ANDREWS`);
    console.log(`    - rrnco_phone: 903-372-0877`);
    console.log(`    - rrnco_email: KARA.R.ANDREWS.MIL@ARMY.MIL`);
    console.log('');
    console.log('APPLICATION.pdf Template:');
    console.log(`  Pages: ${appPageCount}`);
    console.log(`  Fields mapped: ${Object.keys(appFields).length}`);
    console.log(`  Checkboxes mapped: ${appChecks.length}`);
    console.log(`  Total filled: ${appFillResult.filled}`);
    console.log('');
    console.log('Ear Wax SF 507:');
    console.log(`  Pages: ${earWaxPageCount}`);
    console.log(`  Text draws: 3`);
    console.log('');
    console.log('Final Output:');
    console.log(`  Total pages: ${output.getPageCount()}`);
    console.log(`  Expected breakdown:`);
    console.log(`    - BrazenRecruits custom (pages 1-9): ${brazenCustomPages.length}`);
    console.log(`    - APPLICATION.pdf: ${applicationPages.length}`);
    console.log(`    - Ear Wax SF 507: ${earWaxPages.length}`);
    console.log(`    - Remaining govt forms: ${output.getPageCount() - brazenCustomPages.length - applicationPages.length - earWaxPages.length}`);
    console.log('');
    console.log('STATUS: SUCCESS');
    console.log('');

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
