# Upload Smoke-Test Checklist

Quick manual verification procedure for the three browser upload paths.  
Run this after any change to `api/client.ts`, `getUploadUrl`, CORS headers, or the Next.js proxy route.

---

## Prerequisites

- Production (or staging) build deployed.
- Browser DevTools open → **Network** tab, cleared, filter set to `v1/loops`.

---

## 1. Single-file upload

**Steps:**
1. Open the app and choose **single loop** mode.
2. Select one `.mp3` / `.wav` / `.flac` file.
3. Click **Upload**.

**Expected Network tab behaviour:**
- One `POST` request to `${NEXT_PUBLIC_API_URL}/api/v1/loops/with-file` — defaults to `https://web-production-3afc5.up.railway.app` when the env var is not set.
- **No** preflight `OPTIONS` request before it.
- Request **Content-Type** header: `multipart/form-data; boundary=…` — set automatically by the browser, **not** manually.
- Request **headers**: no `x-correlation-id`.
- FormData payload: `loop_in` (JSON) + `file` (the audio file).
- Response: `200 OK` with a JSON body containing `id`, `name`, `bpm`, `bars`.

---

## 2. Multi-stem upload (2 – 20 files)

**Steps:**
1. Choose **stem upload** mode.
2. Select 2–20 audio stems (`.wav` / `.mp3`, no ZIP).
3. Click **Upload**.

**Expected Network tab behaviour:**
- One `POST` to the same Railway origin (`/api/v1/loops/with-file`).
- **No** preflight `OPTIONS`.
- FormData payload: `loop_in` (JSON) + **multiple** `stem_files` entries (one per stem).
- No `file` or `stem_zip` field.
- Response: `200 OK` with JSON loop details.

---

## 3. Stem ZIP upload

**Steps:**
1. Choose **stem upload** mode.
2. Select exactly one `.zip` file containing the stems.
3. Click **Upload**.

**Expected Network tab behaviour:**
- One `POST` to the Railway origin (`/api/v1/loops/with-file`).
- **No** preflight `OPTIONS`.
- FormData payload: `loop_in` (JSON, name has `.zip` stripped) + `stem_zip` (the ZIP file).
- No `file` or `stem_files` field.
- Response: `200 OK` with JSON loop details.

---

## What to look for (failure signals)

| Symptom | Likely cause |
|---------|-------------|
| Upload goes to the **current origin** (`https://your-vercel-domain.vercel.app/api/v1/loops/with-file`) instead of the Railway origin | `getUploadUrl` was accidentally replaced with `apiUrl` (which returns a relative path that resolves to the Vercel frontend) |
| `OPTIONS` preflight before every upload | A custom header (`x-correlation-id`, etc.) was re-added, or `Content-Type` was set manually |
| `413 Request Entity Too Large` | Request is going through the Vercel proxy instead of Railway |
| `CORS` error in console | Origin misconfigured, or preflight was triggered and Railway rejected it |
| Wrong FormData key | Mode detection logic in `uploadLoop` changed |

---

## Automated regression coverage

All paths above are covered by unit tests in `src/__tests__/api/client.test.ts`.  
Run `npm test` before shipping any change to the upload flow.
