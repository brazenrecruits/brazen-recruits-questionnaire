# Brazen Recruits — Complete Setup Guide

## What's in this folder

- `index.html` — The full 24-question qualification survey (branching logic, pass/fail, email + SMS notifications)
- `faq.html` — "3 Things You Didn't Know" page (linked from SMS follow-up texts)
- `refer.html` — Referral tracker page (recruits generate personal referral links)
- `netlify/functions/send-sms.js` — Serverless function that sends auto-texts via Twilio
- `netlify/functions/generate-packet.js` — Serverless function that generates pre-filled MEPS packets and emails them
- `netlify/functions/meps-template.pdf` — Blank MEPS Flash Packet template (used by generate-packet)
- `package.json` — Dependencies for serverless functions (pdf-lib)
- `qr-code-brazenrecruits-survey.png` — QR code pointing to brazenrecruits-survey.netlify.app
- `SETUP-INSTRUCTIONS.md` — This file

---

## ALREADY DONE (no action needed)

- Email notifications via Web3Forms (access key is already baked in)
- Referral tracking via URL parameters (already wired into the survey + emails)
- FAQ page (ready to go, no configuration needed)
- Referral page (ready to go, no configuration needed)

---

## STEP 1: Set Up Twilio for Auto-SMS (10 minutes)

Every time someone submits the survey, they'll automatically get a text from Kara's number with a personalized message + link to the FAQ page. Here's how to set it up:

### 1a. Create a Twilio Account
1. Go to **https://www.twilio.com/try-twilio** and sign up (free trial gives you $15 credit)
2. Verify your email and phone number
3. In the Twilio Console dashboard, you'll see:
   - **Account SID** (starts with "AC...")
   - **Auth Token** (click to reveal)
4. Copy both — you'll need them in Step 1c

### 1b. Get a Twilio Phone Number
1. In Twilio Console, go to **Phone Numbers > Manage > Buy a Number**
2. Search for a number with area code **903** or **972** (DFW-local looks more legitimate to recipients)
3. Make sure it has **SMS** capability checked
4. Buy the number (uses your trial credit)
5. Copy the full phone number (format: +19035551234)

### 1c. Add Twilio Credentials to Netlify
1. Log into **https://app.netlify.com**
2. Go to your **brazenrecruits-survey** site
3. Go to **Site Configuration > Environment Variables**
4. Add these three variables:

| Key | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | Your Account SID from Twilio (starts with AC...) |
| `TWILIO_AUTH_TOKEN` | Your Auth Token from Twilio |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number (format: +19035551234) |

5. Save and **redeploy** the site

### Important Twilio Notes
- **Trial accounts** can only send to verified numbers. To send to anyone, upgrade the account ($1/month + ~$0.0079/text). At 100 leads/month that's under $2/month total.
- **SMS compliance**: Twilio requires opt-in consent. The survey's disclaimer ("By submitting this form, you are allowing the Texas Army National Guard to contact you") covers this.
- The text message comes from the Twilio number, not Kara's personal phone. Pick a local area code so it feels familiar.

---

## STEP 2: Set Up Resend for Auto-Packet Emails (5 minutes)

Every time someone submits the screening form, the system automatically generates a pre-filled MEPS Flash Packet PDF and emails it to Kara as an attachment. This uses Resend (free tier: 100 emails/day).

### 2a. Create a Resend Account
1. Go to **https://resend.com/signup** and sign up (free, no credit card needed)
2. Verify your email address
3. In the Resend dashboard, go to **API Keys**
4. Click **Create API Key**
   - Name it: "Brazen Recruits Packet System"
   - Permission: **Sending access**
5. Copy the API key (starts with "re_...")

### 2b. Verify Your Domain (recommended) or Use Default
- **Option A (recommended):** Go to **Domains** in Resend, add `brazenrecruits.com`, and add the DNS records they provide. This lets emails come from `packets@brazenrecruits.com`.
- **Option B (quick start):** Skip domain verification. Emails will come from `onboarding@resend.dev` (still works, just looks less professional).

### 2c. Add Resend Credentials to Netlify
1. Log into **https://app.netlify.com**
2. Go to your site → **Site Configuration > Environment Variables**
3. Add these variables:

| Key | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key (starts with re_...) |
| `KARA_EMAIL` | Kara's email where packets should be sent |
| `WEB3FORMS_ACCESS_KEY` | Your Web3Forms access key (see web3forms.com dashboard) |

4. Save and **redeploy** the site

### How it works
1. Applicant submits the screening form on brazenrecruits.com
2. The Netlify function `generate-packet` receives all the form data
3. It generates a pre-filled 19-page MEPS Flash Packet PDF using pdf-lib
4. It emails the PDF to Kara as an attachment via Resend
5. It also forwards the data to Web3Forms (so Kara gets the text summary email too)
6. If the function fails for any reason, the form falls back to direct Web3Forms submission (belt and suspenders)

**Result:** Kara opens her email and the filled packet is already attached. Zero clicks on her end.

---

## STEP 3: Deploy Everything to Netlify

Drag and drop the entire `brazen-recruits-questionnaire` folder to your brazenrecruits-survey Netlify site. This deploys:
- The survey at: brazenrecruits-survey.netlify.app
- The FAQ page at: brazenrecruits-survey.netlify.app/faq.html
- The referral page at: brazenrecruits-survey.netlify.app/refer.html
- The SMS function at: brazenrecruits-survey.netlify.app/.netlify/functions/send-sms

---

## HOW THE REFERRAL SYSTEM WORKS

### For current recruits/referrers:
1. Go to **brazenrecruits-survey.netlify.app/refer.html**
2. Enter their name and click "Create My Link"
3. They get a unique URL like: `brazenrecruits-survey.netlify.app?ref=john-smith`
4. Share that link via text, Instagram, Snapchat, whatever

### For Kara:
- Every email notification now includes a **"Referred By"** field
- If someone used a referral link: shows the referrer's name (e.g., "john-smith")
- If someone came directly: shows "Direct (no referral)"
- She can track which referrers are bringing in the most leads just by scanning her inbox

### How to share the referral page:
- Have Kara text the refer.html link to new recruits after they sign
- Add it to her Instagram bio or stories
- Include it in follow-up emails: "Know someone who'd be a good fit? Share your link:"

---

## HOW THE SMS SYSTEM WORKS

### What happens when someone submits:
1. Form submits → Email sent to Kara (Web3Forms) + SMS sent to applicant (Twilio)
2. The text message is personalized based on their result:

**GREEN (qualified):**
"Hey [name], this is SGT Andrews with the Texas Army National Guard! Great news — based on your survey, you look like a strong candidate. I'll be reaching out soon to discuss next steps. In the meantime, here are 3 things most people don't know about the Guard: [FAQ link]"

**YELLOW (conditional):**
"Hey [name], this is SGT Andrews with the Texas Army National Guard! Got your survey — looks like you have some great potential. A couple items need a quick review, but that's totally normal. I'll reach out soon to discuss. In the meantime, here are 3 things most people don't know about the Guard: [FAQ link]"

**RED (not eligible):**
"Hey [name], this is SGT Andrews with the Texas Army National Guard. I received your survey responses. Even though some answers flagged, there may still be options for you — every situation is different. Feel free to reach out if you'd like to talk: 903-372-0877"

---

## QR CODE

The `qr-code-brazenrecruits-survey.png` file points to **https://brazenrecruits-survey.netlify.app** and is ready for flyers, business cards, posters, and booth materials.

---

## PAGES SUMMARY

| URL | Purpose |
|---|---|
| brazenrecruits-survey.netlify.app | Qualification survey (main tool) |
| brazenrecruits-survey.netlify.app/faq.html | "3 Things" page (linked from SMS) |
| brazenrecruits-survey.netlify.app/refer.html | Referral link generator |
| brazenrecruits.netlify.app | Lead capture tool (separate site) |
