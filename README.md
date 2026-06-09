# AgencyFlow — Agency Automation Platform
### Mini Zapier for Digital Marketing Agencies

A fully client-side dashboard that automates lead management across Meta Ads,
Google Sheets, HubSpot CRM, WhatsApp Business API, and Email (SendGrid).

---

## 🚀 Quick Start

1. Download and unzip the project
2. Open `index.html` in any modern browser — **no server required**
3. Click **"+ Simulate Lead"** to watch the full automation pipeline run

---

## 📁 File Structure

```
agencyflow/
├── index.html          ← Main app (all pages)
├── css/
│   └── styles.css      ← Dark theme, components, responsive layout
├── js/
│   └── app.js          ← All logic, API stubs, data layer
└── README.md
```

---

## 🔌 Connecting Real APIs

Open `js/app.js` and fill in the `API_CONFIG` object at the top:

```js
const API_CONFIG = {
  meta: {
    pageId:      '1739144476403633',
    formId:      'YOUR_LEAD_FORM_ID',
    accessToken: 'YOUR_META_ACCESS_TOKEN',
  },
  googleSheets: {
    spreadsheetId: '1cY9rq6emczhlMWWcrt1IZnxSEvSfke4SngR3PtevuJY',
    sheetName:     'Sheet1',
  },
  hubspot: {
    apiKey:     'YOUR_HUBSPOT_API_KEY',
    pipelineId: 'YOUR_PIPELINE_ID',
  },
  whatsapp: {
    phoneNumberId: 'YOUR_WHATSAPP_PHONE_NUMBER_ID',
    accessToken:   'YOUR_WHATSAPP_ACCESS_TOKEN',
    templateName:  'lead_notification_v2',
    notifyNumbers: ['+919876543210'],
  },
  email: {
    provider:  'sendgrid',
    apiKey:    'YOUR_SENDGRID_API_KEY',
    fromEmail: 'noreply@youragency.com',
    fromName:  'Your Agency',
  },
};
```

Then in `simulateLead()`, uncomment the real API calls:

```js
await syncToGoogleSheets(l);
await pushToCRM(l);
await sendWhatsAppNotification(l);
await triggerEmailAutomation(l);
```

---

## 📱 Meta Lead Ads — Real Webhook Setup

For real-time lead capture (not polling), set up a Meta Webhook:

1. Go to **Meta for Developers → Your App → Webhooks**
2. Subscribe to the `leadgen` event on your Facebook Page
3. Point the callback URL to your server endpoint
4. In your server, call `simulateLead()` logic with real data from Meta's payload

Meta lead payload shape:
```json
{
  "entry": [{
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "123456",
        "page_id": "789",
        "form_id": "456",
        "created_time": 1718000000
      }
    }]
  }]
}
```

Then fetch full lead details:
```
GET https://graph.facebook.com/v18.0/{leadgen_id}?access_token={token}
```

---

## 📊 Google Sheets Integration

Requires OAuth2 (service account recommended for server-side):

1. Create a Google Cloud Project
2. Enable **Google Sheets API**
3. Create a Service Account → download JSON key
4. Share your spreadsheet with the service account email
5. Use the `googleapis` npm package or REST API directly

Sheet columns expected (Row 1 = headers):
```
ID | Name | Phone | Email | Source | Campaign | Timestamp
```

---

## 🗂️ HubSpot CRM

1. Go to **HubSpot → Settings → Integrations → API Key**
2. Copy your Private App token
3. Contacts are created via `POST /crm/v3/objects/contacts`

Custom properties to create in HubSpot:
- `lead_source` (single-line text)
- `ad_campaign` (single-line text)
- `meta_lead_id` (single-line text)

---

## 💬 WhatsApp Business API

1. Set up **Meta Business Suite → WhatsApp Business Platform**
2. Create a message template named `lead_notification_v2` (or your custom name)
3. Get your **Phone Number ID** and **Permanent Access Token**
4. Templates must be approved by Meta before sending

Template variable order:
```
{{1}} = Lead Name
{{2}} = Phone Number
{{3}} = Lead Source (Facebook / Instagram)
```

---

## ✉️ Email via SendGrid

1. Create a **SendGrid** account → **Settings → API Keys**
2. Generate a key with **Mail Send** permission
3. Verify your sender domain in SendGrid

To use SMTP instead, replace the fetch call in `triggerEmailAutomation()`
with your SMTP library (e.g. Nodemailer on a backend).

---

## 🛠️ Customization

### Add a new pipeline step
1. Add a toggle to `wfStates` in `app.js`
2. Add the WF box HTML in `index.html` (workflow page)
3. Add a `toggleWF('yourkey')` handler
4. Add the API stub function and call it in `simulateLead()`

### Change the agency name / theme color
- Agency name: update Settings page or `API_CONFIG`
- Accent color: change `--accent` and `--accent2` in `css/styles.css`

### Add more email templates
Push to the `TEMPLATES` array in `app.js`:
```js
TEMPLATES.push({
  name:    'Proposal Follow-up',
  subject: 'Your custom proposal is ready, {{name}}',
  to:      'Lead ({{email}})',
  body:    'Hi {{name}}, ...',
});
```

---

## 📦 Dependencies

- **Zero npm packages** — pure HTML/CSS/JS
- Google Fonts: DM Sans + DM Mono (loaded from CDN, works offline with fallback)
- No build step required

---

## 📋 Features

| Feature | Status |
|---|---|
| Meta Lead Ads fetch | ✅ Simulated / API stub ready |
| Google Sheets sync | ✅ Simulated / API stub ready |
| HubSpot CRM push | ✅ Simulated / API stub ready |
| WhatsApp notification | ✅ Simulated / API stub ready |
| Email automation | ✅ Simulated / API stub ready |
| Lead deduplication | ✅ By email+phone logic in stubs |
| Activity log | ✅ Real-time, last 200 events |
| CSV export | ✅ Fully functional |
| Email template editor | ✅ 3 built-in, fully editable |
| Analytics dashboard | ✅ Source breakdown + daily chart |
| Responsive layout | ✅ Mobile sidebar collapses |
| Dark mode | ✅ Default theme |

---

## 📝 License

MIT — free to use and modify for your agency.
