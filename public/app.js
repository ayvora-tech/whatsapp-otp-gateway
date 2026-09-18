// State
let currentStatus = null;
let currentKey = null;
let activeLang = 'curl';
let pollInterval = null;

// Elements
const connectionPill = document.getElementById('connectionPill');
const connectionPillText = document.getElementById('connectionPillText');
const btnRefresh = document.getElementById('btnRefresh');

const statStatus = document.getElementById('statStatus');
const statUserPhone = document.getElementById('statUserPhone');
const statActiveOtps = document.getElementById('statActiveOtps');
const statTotalSent = document.getElementById('statTotalSent');
const statUptime = document.getElementById('statUptime');

const qrSection = document.getElementById('qrSection');
const qrImage = document.getElementById('qrImage');
const qrLoadingSpinner = document.getElementById('qrLoadingSpinner');
const connectedSection = document.getElementById('connectedSection');
const connectedName = document.getElementById('connectedName');
const connectedPhone = document.getElementById('connectedPhone');
const deviceStateBadge = document.getElementById('deviceStateBadge');
const btnLogout = document.getElementById('btnLogout');

// Sandbox Tabs
const tabSendBtn = document.getElementById('tabSendBtn');
const tabVerifyBtn = document.getElementById('tabVerifyBtn');
const tabSend = document.getElementById('tabSend');
const tabVerify = document.getElementById('tabVerify');

const formSendOtp = document.getElementById('formSendOtp');
const inputTestPhone = document.getElementById('inputTestPhone');
const btnSubmitSendOtp = document.getElementById('btnSubmitSendOtp');
const sendResultBox = document.getElementById('sendResultBox');
const sendResultMessage = document.getElementById('sendResultMessage');
const previewOtpCode = document.getElementById('previewOtpCode');
const btnQuickVerify = document.getElementById('btnQuickVerify');

const formVerifyOtp = document.getElementById('formVerifyOtp');
const inputVerifyPhone = document.getElementById('inputVerifyPhone');
const inputVerifyCode = document.getElementById('inputVerifyCode');
const btnSubmitVerifyOtp = document.getElementById('btnSubmitVerifyOtp');
const verifyResultBox = document.getElementById('verifyResultBox');

// API Key & Snippets
const activeKeyText = document.getElementById('activeKeyText');
const btnCopyKey = document.getElementById('btnCopyKey');
const btnCreateKey = document.getElementById('btnCreateKey');
const snippetCode = document.getElementById('snippetCode');
const btnCopySnippet = document.getElementById('btnCopySnippet');
const snippetTabs = document.querySelectorAll('.snippet-tab');

// Logs
const logsContainer = document.getElementById('logsContainer');
const btnClearLogs = document.getElementById('btnClearLogs');
const toast = document.getElementById('toast');

// Format Uptime Seconds
function formatUptime(totalSeconds) {
  if (!totalSeconds) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Show Toast
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Fetch Status
async function fetchStatus() {
  try {
    const res = await fetch('/api/dashboard/status');
    if (!res.ok) throw new Error('Failed to fetch status');
    const data = await res.json();
    currentStatus = data;
    renderStatus(data);
  } catch (err) {
    console.error('Status fetch error:', err);
    connectionPill.className = 'status-pill status-disconnected';
    connectionPillText.textContent = 'Server Offline';
    statStatus.textContent = 'Offline';
    statStatus.className = 'stat-value text-yellow';
  }
}

// Render Status UI
function renderStatus(data) {
  // Stat values
  statActiveOtps.textContent = data.activeOtps || 0;
  statTotalSent.textContent = data.stats?.totalSent || 0;
  statUptime.textContent = formatUptime(data.stats?.uptimeSeconds);

  // Status Pill & Badge
  if (data.status === 'connected') {
    connectionPill.className = 'status-pill status-connected';
    connectionPillText.textContent = `Connected (+${data.user?.phone || 'WA'})`;
    statStatus.textContent = 'Active';
    statStatus.className = 'stat-value text-green';
    statUserPhone.textContent = `+${data.user?.phone || ''} (${data.user?.name || 'Linked'})`;
    deviceStateBadge.textContent = 'Online';
    deviceStateBadge.className = 'badge badge-success';

    qrSection.classList.add('hidden');
    connectedSection.classList.remove('hidden');
    connectedName.textContent = data.user?.name || 'WhatsApp Account';
    connectedPhone.textContent = `+${data.user?.phone || ''}`;
  } else if (data.status === 'qr_ready') {
    connectionPill.className = 'status-pill status-qr';
    connectionPillText.textContent = 'Scan QR Code';
    statStatus.textContent = 'Waiting Scan';
    statStatus.className = 'stat-value text-yellow';
    statUserPhone.textContent = 'Ready to link device';
    deviceStateBadge.textContent = 'Scan Required';
    deviceStateBadge.className = 'badge';

    connectedSection.classList.add('hidden');
    qrSection.classList.remove('hidden');

    if (data.qrCode) {
      qrLoadingSpinner.classList.add('hidden');
      qrImage.src = data.qrCode;
      qrImage.classList.remove('hidden');
    } else {
      qrLoadingSpinner.classList.remove('hidden');
      qrImage.classList.add('hidden');
    }
  } else if (data.status === 'connecting') {
    connectionPill.className = 'status-pill status-connecting';
    connectionPillText.textContent = 'Connecting...';
    statStatus.textContent = 'Connecting';
    statStatus.className = 'stat-value';
    deviceStateBadge.textContent = 'Connecting';

    connectedSection.classList.add('hidden');
    qrSection.classList.remove('hidden');
    qrLoadingSpinner.classList.remove('hidden');
    qrImage.classList.add('hidden');
  } else {
    connectionPill.className = 'status-pill status-disconnected';
    connectionPillText.textContent = 'Disconnected';
    statStatus.textContent = 'Disconnected';
    statStatus.className = 'stat-value text-yellow';
    deviceStateBadge.textContent = 'Offline';

    connectedSection.classList.add('hidden');
    qrSection.classList.remove('hidden');
  }
}

// Fetch API Keys
async function fetchKeys() {
  try {
    const res = await fetch('/api/dashboard/keys');
    if (!res.ok) throw new Error('Failed to fetch keys');
    const data = await res.json();
    if (data.keys && data.keys.length > 0) {
      currentKey = data.keys[0].key;
      activeKeyText.textContent = currentKey;
      renderSnippet();
    }
  } catch (err) {
    console.error('Keys fetch error:', err);
  }
}

// Fetch Activity Logs
async function fetchLogs() {
  try {
    const res = await fetch('/api/dashboard/logs');
    if (!res.ok) return;
    const data = await res.json();
    renderLogs(data.logs || []);
  } catch (err) {
    // Silent
  }
}

function renderLogs(logs) {
  if (!logs || logs.length === 0) {
    logsContainer.innerHTML = '<div class="log-empty">Waiting for activity events...</div>';
    return;
  }

  logsContainer.innerHTML = logs
    .map((log) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      let badgeClass = 'log-badge-info';
      if (log.type === 'sent') badgeClass = 'log-badge-sent';
      else if (log.type === 'qr') badgeClass = 'log-badge-qr';
      else if (log.type === 'connected') badgeClass = 'log-badge-connected';
      else if (log.type === 'error') badgeClass = 'log-badge-error';

      return `
        <div class="log-entry">
          <span class="log-time">${time}</span>
          <span class="log-badge ${badgeClass}">${log.type}</span>
          <span class="log-msg">${escapeHtml(log.message)}</span>
        </div>
      `;
    })
    .join('');
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Render Code Snippet
function renderSnippet() {
  const origin = window.location.origin;
  const key = currentKey || 'wotp_live_your_api_key_here';

  let code = '';
  if (activeLang === 'curl') {
    code = `# Send an OTP verification code via WhatsApp
curl -X POST "${origin}/api/otp/send" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '{
    "phone": "+1234567890",
    "length": 6,
    "expiryMinutes": 5
  }'

# Verify the OTP code entered by the user
curl -X POST "${origin}/api/otp/verify" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '{
    "phone": "+1234567890",
    "code": "648291"
  }'`;
  } else if (activeLang === 'javascript') {
    code = `// Send OTP verification code
async function sendWhatsAppOtp(phoneNumber) {
  const res = await fetch("${origin}/api/otp/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "${key}"
    },
    body: JSON.stringify({
      phone: phoneNumber,
      length: 6,
      expiryMinutes: 5
    })
  });
  return await res.json();
}

// Verify OTP entered by user
async function verifyWhatsAppOtp(phoneNumber, code) {
  const res = await fetch("${origin}/api/otp/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "${key}"
    },
    body: JSON.stringify({
      phone: phoneNumber,
      code: code
    })
  });
  return await res.json();
}`;
  } else if (activeLang === 'python') {
    code = `import requests

BASE_URL = "${origin}"
API_KEY = "${key}"

headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY
}

# 1. Send OTP
send_response = requests.post(
    f"{BASE_URL}/api/otp/send",
    headers=headers,
    json={"phone": "+1234567890", "length": 6, "expiryMinutes": 5}
)
print("Send result:", send_response.json())

# 2. Verify OTP
verify_response = requests.post(
    f"{BASE_URL}/api/otp/verify",
    headers=headers,
    json={"phone": "+1234567890", "code": "648291"}
)
print("Verify result:", verify_response.json())`;
  } else if (activeLang === 'nodejs') {
    code = `const axios = require('axios');

const client = axios.create({
  baseURL: '${origin}',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${key}'
  }
});

// 1. Send OTP
async function sendOtp(phone) {
  const { data } = await client.post('/api/otp/send', {
    phone,
    length: 6,
    expiryMinutes: 5
  });
  return data;
}

// 2. Verify OTP
async function verifyOtp(phone, code) {
  const { data } = await client.post('/api/otp/verify', {
    phone,
    code
  });
  return data;
}`;
  }

  snippetCode.textContent = code;
}

// Event Listeners
btnRefresh.addEventListener('click', () => {
  fetchStatus();
  fetchLogs();
  showToast('Refreshed status');
});

btnCopyKey.addEventListener('click', () => {
  if (currentKey) {
    navigator.clipboard.writeText(currentKey);
    showToast('API Key copied to clipboard!');
  }
});

btnCopySnippet.addEventListener('click', () => {
  navigator.clipboard.writeText(snippetCode.textContent);
  showToast('Code snippet copied!');
});

snippetTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    snippetTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeLang = tab.dataset.lang;
    renderSnippet();
  });
});

// Tab Switcher
tabSendBtn.addEventListener('click', () => {
  tabSendBtn.classList.add('active');
  tabVerifyBtn.classList.remove('active');
  tabSend.classList.add('active');
  tabVerify.classList.remove('active');
});

tabVerifyBtn.addEventListener('click', () => {
  tabVerifyBtn.classList.add('active');
  tabSendBtn.classList.remove('active');
  tabVerify.classList.add('active');
  tabSend.classList.remove('active');
});

// Form: Send Test OTP
formSendOtp.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = inputTestPhone.value.trim();
  if (!phone) return;

  btnSubmitSendOtp.disabled = true;
  btnSubmitSendOtp.querySelector('span').textContent = 'Sending...';

  try {
    const res = await fetch('/api/dashboard/test-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();
    sendResultBox.classList.remove('hidden');

    if (data.success) {
      sendResultMessage.textContent = data.message;
      previewOtpCode.textContent = data.code;
      inputVerifyPhone.value = data.phone;
      inputVerifyCode.value = data.code;
      showToast('OTP delivered to WhatsApp!');
    } else {
      sendResultMessage.innerHTML = `<span style="color: var(--rose);">${data.error || 'Failed to send OTP'}</span>`;
      previewOtpCode.textContent = '------';
    }

    fetchStatus();
    fetchLogs();
  } catch (err) {
    sendResultBox.classList.remove('hidden');
    sendResultMessage.innerHTML = `<span style="color: var(--rose);">${err.message}</span>`;
  } finally {
    btnSubmitSendOtp.disabled = false;
    btnSubmitSendOtp.querySelector('span').textContent = 'Send OTP via WhatsApp';
  }
});

// Quick fill verify tab
btnQuickVerify.addEventListener('click', () => {
  tabVerifyBtn.click();
});

// Form: Verify OTP
formVerifyOtp.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = inputVerifyPhone.value.trim();
  const code = inputVerifyCode.value.trim();

  btnSubmitVerifyOtp.disabled = true;
  btnSubmitVerifyOtp.querySelector('span').textContent = 'Verifying...';

  try {
    const res = await fetch('/api/dashboard/test-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });

    const data = await res.json();
    verifyResultBox.classList.remove('hidden');

    if (data.success && data.valid) {
      verifyResultBox.innerHTML = `
        <div class="result-header">
          <span class="badge badge-success">Valid Code</span>
        </div>
        <p class="result-msg" style="color: #34d399;">✅ ${data.message}</p>
      `;
      showToast('OTP Verified Successfully!');
    } else {
      verifyResultBox.innerHTML = `
        <div class="result-header">
          <span class="badge badge-error">Verification Failed</span>
        </div>
        <p class="result-msg" style="color: #f87171;">❌ ${data.error || 'Invalid code'}</p>
      `;
    }

    fetchStatus();
    fetchLogs();
  } catch (err) {
    verifyResultBox.classList.remove('hidden');
    verifyResultBox.innerHTML = `<p class="result-msg" style="color: #f87171;">❌ ${err.message}</p>`;
  } finally {
    btnSubmitVerifyOtp.disabled = false;
    btnSubmitVerifyOtp.querySelector('span').textContent = 'Verify Code';
  }
});

// Create new API key
btnCreateKey.addEventListener('click', async () => {
  const name = prompt('Enter a label for this API key (e.g. "Production Mobile App"):');
  if (!name) return;

  try {
    const res = await fetch('/api/dashboard/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.success && data.key) {
      currentKey = data.key.key;
      activeKeyText.textContent = currentKey;
      renderSnippet();
      showToast(`Created new key: ${data.key.name}`);
    }
  } catch (err) {
    showToast('Failed to create key');
  }
});

// Logout
btnLogout.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to disconnect and log out of WhatsApp? You will need to scan the QR code again.')) {
    return;
  }

  try {
    await fetch('/api/dashboard/logout', { method: 'POST' });
    showToast('Logged out. Reloading session...');
    fetchStatus();
  } catch (err) {
    showToast('Logout failed');
  }
});

// Clear Logs
btnClearLogs.addEventListener('click', () => {
  logsContainer.innerHTML = '<div class="log-empty">Logs cleared.</div>';
});

// Initial boot & periodic polling
fetchStatus();
fetchKeys();
fetchLogs();
pollInterval = setInterval(() => {
  fetchStatus();
  fetchLogs();
}, 3000);
