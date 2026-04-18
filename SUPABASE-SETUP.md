# Supabase Setup Guide for BrazenRecruits Recruit Tracker

## 1. Create a Supabase Account & Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project**
3. Name it `brazenrecruits` (or whatever you want)
4. Set a database password (save it somewhere safe)
5. Choose the region closest to you (US East)
6. Click **Create new project** and wait ~2 minutes

## 2. Create the Recruits Table

Once the project is ready, go to **SQL Editor** in the left sidebar and paste this:

```sql
CREATE TABLE recruits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,

  -- Form completion tracking
  appointment_complete BOOLEAN DEFAULT FALSE,
  appointment_completed_at TIMESTAMPTZ,
  appointment_data JSONB,

  eligibility_complete BOOLEAN DEFAULT FALSE,
  eligibility_completed_at TIMESTAMPTZ,
  eligibility_data JSONB,

  application_complete BOOLEAN DEFAULT FALSE,
  application_completed_at TIMESTAMPTZ,
  application_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow the anon key to read and write to this table
ALTER TABLE recruits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon"
  ON recruits
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

Click **Run** to create the table.

## 3. Get Your API Keys

1. Go to **Settings** (gear icon) → **API**
2. Copy these two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (the long `eyJ...` string)

## 4. Add Environment Variables in Netlify

1. Go to your Netlify dashboard → **brazenrecruits-survey** site
2. Go to **Site configuration** → **Environment variables**
3. Add these:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJ...` (the anon key) |
| `ADMIN_PASSWORD` | Pick a password for Kara's dashboard (e.g. `BrazenRecruits2026!`) |

4. Click **Save**
5. Trigger a redeploy (push a new commit or click **Trigger deploy** in Netlify)

## 5. Add the admin.brazenrecruits.com Domain

In Netlify → **Domain management** → **Add domain alias** → enter `admin.brazenrecruits.com`

Then in your DNS (wherever brazenrecruits.com is managed), add a CNAME record:
- **Name**: `admin`
- **Value**: `brazenrecruits-survey.netlify.app`

## 6. Test It

1. Go to `admin.brazenrecruits.com` and enter your password
2. The dashboard should load (empty at first)
3. Fill out a test form on `form.brazenrecruits.com`
4. Refresh the dashboard — you should see the recruit appear
5. Fill out the eligibility survey and application — checkboxes should auto-update

## How It Works

Each time someone submits any form, the data is:
1. **Emailed to Kara** as a clean Q&A PDF (via Resend)
2. **Saved to Supabase** and linked by email address
3. **Visible on the dashboard** with checkmarks for each completed form

The dashboard shows all recruits, which forms they've completed, their eligibility result (GREEN/YELLOW/RED), and when they last submitted something.
