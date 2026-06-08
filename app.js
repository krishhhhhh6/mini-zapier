/**
 * AgencyFlow — Agency Automation Platform
 * Main Application Logic
 *
 * This file handles:
 *   - Lead data management & simulation
 *   - Pipeline automation state
 *   - Page navigation
 *   - Activity logging
 *   - Analytics rendering
 *   - Email template management
 *   - Toast notifications
 *   - CSV export
 *
 * To connect real APIs, see the API_CONFIG section below.
 */

'use strict';

/* =============================================================
   API CONFIGURATION
   Replace these with your actual credentials / endpoints.
   ============================================================= */
const API_CONFIG = {
  meta: {
    pageId:   'YOUR_FACEBOOK_PAGE_ID',
    formId:   'YOUR_LEAD_FORM_ID',
    accessToken: 'YOUR_META_ACCESS_TOKEN',
    // Real endpoint: https://graph.facebook.com/v18.0/{formId}/leads
  },
  googleSheets: {
    spreadsheetId: 'YOUR_SPREADSHEET_ID',
    sheetName:     'Leads',
    apiKey:        'YOUR_GOOGLE_API_KEY',
    // Or use OAuth2 service account for write access
  },
  hubspot: {
    apiKey:        'YOUR_HUBSPOT_API_KEY',
    pipelineId:    'YOUR_PIPELINE_ID',
    // Real endpoint: https://api.hubapi.com/crm/v3/objects/contacts
  },
  whatsapp: {
    phoneNumberId: 'YOUR_WHATSAPP_PHONE_NUMBER_ID',
    accessToken:   'YOUR_WHATSAPP_ACCESS_TOKEN',
    templateName:  'lead_notification_v2',
    notifyNumbers: [],
    // Real endpoint: https://graph.facebook.com/v18.0/{phoneNumberId}/messages
  },
  email: {
    provider:  'sendgrid', // or 'smtp'
    apiKey:    'YOUR_SENDGRID_API_KEY',
    fromEmail: 'noreply@youragency.com',
    fromName:  'Your Agency',
    // Real endpoint: https://api.sendgrid.com/v3/mail/send
  },
};


/* =============================================================
   DEMO DATA
   ============================================================= */
const NAMES = [
  'Priya Sharma','Raj Mehta','Ananya Patel','Vikram Singh','Sneha Joshi',
  'Rohan Kumar','Kavita Reddy','Arjun Nair','Pooja Gupta','Aditya Verma',
  'Meera Iyer','Sanjay Bose','Neha Khanna','Deepak Malhotra','Swati Rao',
  'Kiran Desai','Amit Tiwari','Ritu Jain','Suresh Pillai','Divya Chatterjee',
];
const PHONES = [
  '+91 98765 43210','+91 87654 32109','+91 76543 21098',
  '+91 95432 10987','+91 91234 56789','+91 80123 45678',
  '+91 92345 67890','+91 83456 78901','+91 74567 89012','+91 96789 01234',
];
const CAMPAIGNS = [
  'SEO Services Q2','Google Ads June','Meta Brand Awareness',
  'Lead Gen Summer','Instagram Promo','Digi Consult Free',
];
const SOURCES = ['Facebook', 'Instagram'];
const AVATAR_COLORS = ['#4f7aff','#22c77a','#f59e0b','#a78bfa','#06b6d4','#f0486a'];

const TEMPLATES = [
  {
    name: 'New Lead Welcome',
    subject: 'Thanks for reaching out, {{name}}! 🎯',
    to: 'Lead ({{email}})',
    body: `Hi {{name}},\n\nThank you for expressing interest in our digital marketing services!\n\nWe've received your inquiry and our team will reach out to you at {{phone}} within 24 hours.\n\nIn the meantime, feel free to explore our case studies and pricing at our website.\n\nBest regards,\nThe Agency Team`,
  },
  {
    name: 'Internal Lead Alert',
    subject: '🔔 New Lead: {{name}} from {{source}}',
    to: 'Sales Team',
    body: `Team,\n\nNew lead received!\n\nName: {{name}}\nPhone: {{phone}}\nEmail: {{email}}\nSource: {{source}}\nCampaign: {{campaign}}\nReceived: {{timestamp}}\n\nPlease follow up within 30 minutes.\n\n— AgencyFlow Automation`,
  },
  {
    name: 'Follow-up (24hr)',
    subject: 'Following up on your inquiry, {{name}}',
    to: 'Lead ({{email}})',
    body: `Hi {{name}},\n\nWe wanted to follow up on your inquiry from yesterday.\n\nOur team is ready to discuss how we can help grow your business. Would you be available for a quick 15-minute call?\n\nReply to this email to schedule a time that works for you.\n\nBest,\nThe Agency Team`,
  },
];


/* =============================================================
   STATE
   ============================================================= */
let leads = [];
let logs  = [];
let logIdCounter = 0;
let activeFilter = 'all';
let selectedTemplateIndex = 0;

const wfStates = { sheets: true, crm: true, wa: true, email: true };

// Pipeline display counters (mirrors the sidebar)
const pipeCounters = {
  total:  0,
  synced: 0,
  crm:    0,
  wa:     0,
  email:  0,
  fail:   0,
};


/* =============================================================
   HELPERS
   ============================================================= */
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function timeNow() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function interpolate(template, lead) {
  return template
    .replace(/{{name}}/g,      lead.name)
    .replace(/{{phone}}/g,     lead.phone)
    .replace(/{{email}}/g,     lead.email)
    .replace(/{{source}}/g,    lead.source)
    .replace(/{{campaign}}/g,  lead.campaign)
    .replace(/{{timestamp}}/g, lead.time);
}


/* =============================================================
   LEAD FACTORY
   ============================================================= */
function makeLead() {
  const name = rnd(NAMES);
  return {
    id:          'L' + (1000 + leads.length + 1),
    name,
    phone:       rnd(PHONES),
    email:       name.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 99) + '@gmail.com',
    source:      rnd(SOURCES),
    campaign:    rnd(CAMPAIGNS),
    sheets:      Math.random() > 0.07,
    crm:         Math.random() > 0.10,
    wa:          Math.random() > 0.13,
    emailSent:   Math.random() > 0.09,
    time:        timeNow(),
    ts:          Date.now(),
    status:      'new',
    avatarColor: avatarColor(name),
  };
}




/* =============================================================
   SIMULATE NEW LEAD (main interactive action)
   ============================================================= */
function simulateLead() {
  showNotif('Simulation disabled', 'Use addRealLead() for real webhook-driven leads', '⚠️');
}

function refreshDashboardCounters() {
  pipeCounters.total = leads.length;
  pipeCounters.synced = leads.filter(l => l.sheets).length;
  pipeCounters.crm = leads.filter(l => l.crm).length;
  pipeCounters.wa = leads.filter(l => l.wa).length;
  pipeCounters.email = leads.filter(l => l.emailSent).length;
  pipeCounters.fail = leads.filter(l => l.status === 'failed').length;

  const totalEl = document.getElementById('s-total');
  if (totalEl) totalEl.textContent = pipeCounters.total;
  const syncedEl = document.getElementById('s-synced');
  if (syncedEl) syncedEl.textContent = pipeCounters.synced;
  const waEl = document.getElementById('s-wa');
  if (waEl) waEl.textContent = pipeCounters.wa;
  const failEl = document.getElementById('s-fail');
  if (failEl) failEl.textContent = pipeCounters.fail;

  const navEl = document.getElementById('nav-badge');
  if (navEl) navEl.textContent = leads.length;
  const p1 = document.getElementById('p1');
  if (p1) p1.textContent = pipeCounters.total + ' fetched';
  const p2 = document.getElementById('p2');
  if (p2) p2.textContent = pipeCounters.synced + ' saved';
  const p3 = document.getElementById('p3');
  if (p3) p3.textContent = pipeCounters.crm + ' pushed';
  const p4 = document.getElementById('p4');
  if (p4) p4.textContent = pipeCounters.wa + ' notified';
  const p5 = document.getElementById('p5');
  if (p5) p5.textContent = pipeCounters.email + ' sent';
}

function addRealLead(data) {
  const lead = {
    id: data.id || 'L' + (1000 + leads.length + 1),
    name: data.name || 'Unknown',
    phone: data.phone || '',
    email: data.email || '',
    source: data.source || 'Unknown',
    campaign: data.campaign || '',
    sheets: Boolean(data.sheets),
    crm: Boolean(data.crm),
    wa: Boolean(data.wa),
    emailSent: Boolean(data.emailSent),
    time: data.time || timeNow(),
    ts: data.ts || Date.now(),
    status: data.status || 'new',
    avatarColor: avatarColor(data.name || 'Unknown'),
  };
  leads.unshift(lead);
  refreshDashboardCounters();
  renderRecentLeads();
  renderLeadsTable(activeFilter);
  showNotif('New lead added', `Lead ${lead.name} is now live in the pipeline`, '✅');
}


/* =============================================================
   ACTIVITY LOG
   ============================================================= */
function addLog(msg, color) {
  logs.unshift({ id: logIdCounter++, msg, color, time: timeNow() });
  if (logs.length > 200) logs.pop();
  renderDashLog();
  renderFullLog();
}

function logRow(entry) {
  return `<div class="log-item">
    <div class="log-dot" style="background:${entry.color}"></div>
    <div style="flex:1">
      <div class="log-text">${entry.msg}</div>
      <div class="log-time">${entry.time}</div>
    </div>
  </div>`;
}

function renderDashLog() {
  const el = document.getElementById('dash-log');
  if (el) el.innerHTML = logs.slice(0, 8).map(logRow).join('');
}

function renderFullLog() {
  const el = document.getElementById('full-log');
  if (el) el.innerHTML = logs.map(logRow).join('');
}

function clearLogs() {
  logs = [];
  renderDashLog();
  renderFullLog();
}




/* =============================================================
   LEAD TABLE RENDERERS
   ============================================================= */
function statusBadge(l) {
  const map = {
    new:       '<span class="badge badge-accent">New</span>',
    contacted: '<span class="badge badge-teal">Contacted</span>',
    synced:    '<span class="badge badge-green">Synced</span>',
    failed:    '<span class="badge badge-red">Failed</span>',
  };
  return map[l.status] || '<span class="badge badge-orange">Pending</span>';
}

function renderRecentLeads() {
  const el = document.getElementById('recent-leads');
  if (!el) return;
  el.innerHTML = leads.slice(0, 6).map(l => `
    <tr onclick="goPage('leads')">
      <td style="padding-left:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="background:${l.avatarColor}20;color:${l.avatarColor}">${initials(l.name)}</div>
          <span style="color:var(--text)">${l.name}</span>
        </div>
      </td>
      <td>
        <span class="source-tag" style="background:${l.source==='Facebook'?'#1877f215':'#e1306c15'};color:${l.source==='Facebook'?'#7aa7e0':'#e1a0b8'}">
          ${l.source === 'Facebook' ? '📘' : '📷'} ${l.source}
        </span>
      </td>
      <td>${statusBadge(l)}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${l.time}</td>
    </tr>`).join('');
}

function renderLeadsTable(filter) {
  const el = document.getElementById('leads-table');
  if (!el) return;
  const filtered = (filter && filter !== 'all') ? leads.filter(l => l.status === filter) : leads;

  el.innerHTML = filtered.map(l => `
    <tr>
      <td style="padding-left:20px">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="background:${l.avatarColor}20;color:${l.avatarColor}">${initials(l.name)}</div>
          <div>
            <div style="color:var(--text);font-weight:500">${l.name}</div>
            <div style="font-size:10px;color:var(--text3)">${l.id}</div>
          </div>
        </div>
      </td>
      <td style="font-family:var(--mono);font-size:11px">${l.phone}</td>
      <td style="font-size:11px;color:var(--text3)">${l.email}</td>
      <td>
        <span class="source-tag" style="background:${l.source==='Facebook'?'#1877f215':'#e1306c15'};color:${l.source==='Facebook'?'#7aa7e0':'#e1a0b8'}">
          ${l.source === 'Facebook' ? '📘' : '📷'} ${l.source}
        </span>
      </td>
      <td style="font-size:11px;color:var(--text2)">${l.campaign}</td>
      <td>${l.sheets    ? '<span class="badge badge-green">✓</span>'   : '<span class="badge badge-red">✗</span>'}</td>
      <td>${l.crm       ? '<span class="badge badge-green">✓</span>'   : '<span class="badge badge-orange">Retry</span>'}</td>
      <td>${l.wa        ? '<span class="badge badge-teal">Sent</span>' : '<span class="badge badge-orange">Pending</span>'}</td>
      <td>${l.emailSent ? '<span class="badge badge-purple">Sent</span>': '<span class="badge badge-orange">Pending</span>'}</td>
      <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${l.time}</td>
    </tr>`).join('');
}

function filterLeads(filter, tabEl) {
  activeFilter = filter;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  renderLeadsTable(filter);
}


/* =============================================================
   WORKFLOW BUILDER
   ============================================================= */
function toggleWF(key) {
  wfStates[key] = !wfStates[key];
  const el = document.getElementById('wf-' + key);
  el.style.opacity          = wfStates[key] ? '1' : '0.35';
  el.style.textDecoration   = wfStates[key] ? 'none' : 'line-through';
  el.style.borderColor      = wfStates[key] ? '' : 'var(--border)';
  showNotif(
    key.charAt(0).toUpperCase() + key.slice(1),
    wfStates[key] ? 'Step enabled in pipeline' : 'Step disabled — will be skipped',
    wfStates[key] ? '✅' : '⛔'
  );
}

function saveWorkflow() {
  // In a real app: POST workflow config to your backend
  showNotif('Workflow Saved', 'Changes applied to automation pipeline', '⚡');
}


/* =============================================================
   EMAIL TEMPLATES
   ============================================================= */
function renderTemplates() {
  const el = document.getElementById('tpl-list');
  if (!el) return;
  el.innerHTML = TEMPLATES.map((t, i) => `
    <div onclick="selectTemplate(${i})"
         style="padding:9px 10px;border-radius:var(--r);cursor:pointer;margin-bottom:4px;
                background:${i === selectedTemplateIndex ? 'var(--accentglow)' : 'var(--bg2)'};
                border:1px solid ${i === selectedTemplateIndex ? '#4f7aff30' : 'var(--border)'};
                font-size:12.5px;color:${i === selectedTemplateIndex ? 'var(--accent)' : 'var(--text2)'}">
      ${t.name}
    </div>`).join('');
}

function selectTemplate(i) {
  selectedTemplateIndex = i;
  const t = TEMPLATES[i];
  document.getElementById('tpl-name').value    = t.name;
  document.getElementById('tpl-subject').value = t.subject;
  document.getElementById('tpl-body').value    = t.body;
  renderTemplates();
}

function saveTemplate() {
  // Persist changes back to array
  TEMPLATES[selectedTemplateIndex] = {
    name:    document.getElementById('tpl-name').value,
    subject: document.getElementById('tpl-subject').value,
    to:      document.getElementById('tpl-to').value,
    body:    document.getElementById('tpl-body').value,
  };
  renderTemplates();
  showNotif('Template Saved', 'Email template updated successfully', '✉️');
}


/* =============================================================
   ANALYTICS
   ============================================================= */
function renderAnalytics() {
  renderSourceChart();
  renderDailyChart();
}

function renderSourceChart() {
  const el = document.getElementById('source-chart');
  if (!el) return;
  const total = leads.length;
  const fb = leads.filter(l => l.source === 'Facebook').length;
  const ig = leads.filter(l => l.source === 'Instagram').length;
  const sources = [['Facebook', fb, '📘', '#4f7aff'], ['Instagram', ig, '📷', '#f0486a']];
  el.innerHTML = sources.map(([name, count, icon, color]) => {
    const pct = total ? Math.round(count / total * 100) : 0;
    return `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
        <span style="color:var(--text2)">${icon} ${name}</span>
        <span style="color:var(--text);font-weight:500">${count} <span style="color:var(--text3)">(${pct}%)</span></span>
      </div>
      <div style="background:var(--bg3);border-radius:4px;height:8px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:.6s"></div>
      </div>
    </div>`;
  }).join('') +
    `<div style="border-top:1px solid var(--border);padding-top:10px;font-size:11px;color:var(--text3)">Total: ${total} leads this month</div>`;
}

function renderDailyChart() {
  const dc = document.getElementById('daily-chart');
  const dl = document.getElementById('daily-labels');
  if (!dc || !dl) return;

  const days = Array(14).fill(0);
  const labels = ['M','T','W','T','F','S','S','M','T','W','T','F','S','S'];
  const max = 1;

  dc.innerHTML = days.map((v, i) => `
    <div style="flex:1;background:${i===13?'var(--accent)':'var(--accentglow)'};border-radius:3px 3px 0 0;
                height:${Math.round(v/max*100)}%;min-width:0;cursor:default;position:relative" title="${v} leads">
      <div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--text3);white-space:nowrap"></div>
    </div>`).join('');

  dl.innerHTML = labels.map(l =>
    `<div style="flex:1;text-align:center;font-size:10px;color:var(--text3)">${l}</div>`
  ).join('');
}


/* =============================================================
   CSV EXPORT
   ============================================================= */
function exportLeads() {
  const headers = ['ID','Name','Phone','Email','Source','Campaign','Sheets','CRM','WhatsApp','Email','Time','Status'];
  const rows = leads.map(l => [
    l.id, l.name, l.phone, l.email, l.source, l.campaign,
    l.sheets ? 'Yes' : 'No',
    l.crm    ? 'Yes' : 'No',
    l.wa     ? 'Yes' : 'No',
    l.emailSent ? 'Yes' : 'No',
    l.time, l.status,
  ]);

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `agency-leads-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showNotif('CSV Exported', `${leads.length} leads exported successfully`, '⬇️');
}


/* =============================================================
   TOAST NOTIFICATION
   ============================================================= */
let notifTimer = null;
function showNotif(title, sub, icon = '✅') {
  document.getElementById('notif-title').textContent = title;
  document.getElementById('notif-sub').textContent   = sub;
  document.getElementById('notif-icon').textContent  = icon;
  const el = document.getElementById('notif');
  el.classList.add('show');
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('show'), 3500);
}


/* =============================================================
   PAGE NAVIGATION
   ============================================================= */
function goPage(page) {
  // Hide all pages & deactivate nav items
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  // Show requested page
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  // Mark matching nav item active
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(`'${page}'`)) {
      el.classList.add('active');
    }
  });

  // Per-page init
  switch (page) {
    case 'dashboard':
      renderRecentLeads();
      renderDashLog();
      break;
    case 'leads':
      renderLeadsTable(activeFilter);
      break;
    case 'analytics':
      renderAnalytics();
      break;
    case 'templates':
      renderTemplates();
      selectTemplate(selectedTemplateIndex);
      break;
    case 'logs':
      renderFullLog();
      break;
  }
}


/* =============================================================
   AUTO-SIMULATE (every 20 seconds)
   ============================================================= */
// Auto-simulated lead generation disabled to avoid demo activity logs and fake counts.


/* =============================================================
   REAL API STUBS
   Implement these to connect live services.
   ============================================================= */

/**
 * Push a lead row into Google Sheets
 * @param {Object} lead
 */
async function syncToGoogleSheets(lead) {
  // Requires OAuth2 token with Sheets write scope.
  // Use the Google Sheets API v4:
  // POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}:append
  const values = [[
    lead.id, lead.name, lead.phone, lead.email,
    lead.source, lead.campaign, lead.time,
  ]];
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${API_CONFIG.googleSheets.spreadsheetId}/values/${API_CONFIG.googleSheets.sheetName}!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer YOUR_OAUTH_TOKEN` },
        body: JSON.stringify({ values }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    addLog(`Sheets synced: <strong>${lead.name}</strong>`, '#4f7aff');
  } catch (err) {
    addLog(`Sheets sync FAILED for <strong>${lead.name}</strong>: ${err.message}`, '#f0486a');
  }
}

/**
 * Create a HubSpot contact from a lead
 * @param {Object} lead
 */
async function pushToCRM(lead) {
  try {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_CONFIG.hubspot.apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          firstname:   lead.name.split(' ')[0],
          lastname:    lead.name.split(' ').slice(1).join(' '),
          email:       lead.email,
          phone:       lead.phone,
          lead_source: lead.source,
          hs_lead_status: 'NEW',
        },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    addLog(`CRM contact created: <strong>${lead.name}</strong>`, '#a78bfa');
  } catch (err) {
    addLog(`CRM push FAILED for <strong>${lead.name}</strong>: ${err.message}`, '#f0486a');
  }
}

/**
 * Send a WhatsApp message via Meta Cloud API
 * @param {Object} lead
 */
async function sendWhatsAppNotification(lead) {
  const { phoneNumberId, accessToken, templateName, notifyNumbers } = API_CONFIG.whatsapp;
  for (const to of notifyNumbers) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'en' },
              components: [{
                type: 'body',
                parameters: [
                  { type: 'text', text: lead.name },
                  { type: 'text', text: lead.phone },
                  { type: 'text', text: lead.source },
                ],
              }],
            },
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      addLog(`WhatsApp sent → ${to}`, '#22c77a');
    } catch (err) {
      addLog(`WhatsApp FAILED → ${to}: ${err.message}`, '#f0486a');
    }
  }
}

/**
 * Send automated email via SendGrid
 * @param {Object} lead
 */
async function triggerEmailAutomation(lead) {
  const tpl  = TEMPLATES[0]; // Welcome template
  const body = interpolate(tpl.body, lead);
  const subj = interpolate(tpl.subject, lead);
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_CONFIG.email.apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: lead.email, name: lead.name }] }],
        from: { email: API_CONFIG.email.fromEmail, name: API_CONFIG.email.fromName },
        subject: subj,
        content: [{ type: 'text/plain', value: body }],
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    addLog(`Email sent to <strong>${lead.name}</strong> (${lead.email})`, '#06b6d4');
  } catch (err) {
    addLog(`Email FAILED for <strong>${lead.name}</strong>: ${err.message}`, '#f0486a');
  }
}


/* =============================================================
   INIT
   ============================================================= */
(function init() {
  renderRecentLeads();
  renderDashLog();
  refreshDashboardCounters();
  // Ensure dashboard nav item is active
  document.querySelector('.nav-item[onclick="goPage(\'dashboard\')"]')
    ?.classList.add('active');
})();
