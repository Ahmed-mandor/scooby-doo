/**
 * ملاهي سكوبي دوو - نظام إدارة الحجوزات المتكامل
 * Scooby Doo Play Center Booking Management
 */

// Storage Keys
const STORAGE_ACTIVE_BOOKINGS = 'scooby_active_bookings_v2';
const STORAGE_ARCHIVE_BOOKINGS = 'scooby_archive_bookings_v2';
const STORAGE_QUICK_SALES = 'scooby_quick_sales_v2';
const STORAGE_APP_SETTINGS = 'scooby_app_settings_v2';
const STORAGE_USERS = 'scooby_users_v2';
const STORAGE_CURRENT_USER = 'scooby_current_user_v2';
const STORAGE_VAULTS = 'scooby_vaults_v1';
const STORAGE_CURRENT_SHIFT = 'scooby_current_shift_v1';
const STORAGE_MONEY_TRANSACTIONS = 'scooby_money_transactions_v1';
const STORAGE_SHIFTS_HISTORY = 'scooby_shifts_history_v1';
const STORAGE_REFUNDS = 'scooby_refunds_v1';

// State
let activeBookings = [];
let archiveBookings = [];
let quickSales = [];
let refundsList = [];
let activeRefundTarget = null;
let pendingClearSection = null;
let refundFilterState = {
  preset: 'all',
  dateFrom: '',
  dateTo: '',
  section: 'all',
  search: ''
};

// 3-Vault Cash System State
let vaults = {
  drawer: 0,       // خزنة الدرج (الكاشير - الوردية الحالية)
  sub_safe: 0,     // الخزنة الفرعية (حصيلة الورديات المقفلة)
  main_safe: 0     // الخزنة العمومية (الرئيسية)
};

// Daily Shift State
let currentShift = {
  id: 'shift_1',
  shiftNumber: 1,
  openedBy: 'مدير النظام',
  openedAt: Date.now(),
  totalRevenue: 0,
  breakdown: {
    kids: 0,
    trampoline: 0,
    arcade: 0,
    playstation: 0,
    art: 0
  },
  status: 'active'
};

// Money Flow Audit Ledger & Shifts History
let moneyTransactions = [];
let shiftsHistory = [];
let currentMoneyFlowFilter = 'all';

// App Dynamic Settings
let appSettings = {
  kidsHourlyRate: 50,
  psHourlyRate: 50,
  trampolineGamePrice: 30,
  trampolineGameDuration: 10
};

// Users & Permissions
let usersList = [
  {
    id: 'usr_admin',
    username: 'مدير النظام',
    password: '123',
    role: 'admin',
    permissions: {
      kids: true,
      trampoline: true,
      arcade: true,
      playstation: true,
      art: true
    }
  },
  {
    id: 'usr_employee',
    username: 'أحمد (موظف)',
    password: '123',
    role: 'user',
    permissions: {
      kids: true,
      trampoline: true,
      arcade: true,
      playstation: true,
      art: true
    }
  }
];

let currentUser = usersList[0];

// Form selection state
let formState = {
  kids: {
    count: 1,
    durationMinutes: 30,
    durationLabel: 'نصف ساعة'
  },
  trampoline: {
    count: 1,
    durationMinutes: 10,
    durationLabel: '10 دقائق'
  },
  playstation: {
    device: 'جهاز 1 (PS5)',
    durationMinutes: 30,
    durationLabel: 'نصف ساعة'
  }
};

// Pending Confirmation & Details Target
let pendingConfirmation = null;
let activeDetailsBookingId = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupNavigation();
  setupKidsAreaForm();
  setupTrampolineForm();
  setupArcade();
  setupPlaystationForm();
  setupArt();
  setupModals();
  setupReports();
  setupReportsSection();
  setupRefundsSection();
  setupAdminSection();
  setupVaultsAndShifts();
  startLiveClock();
  
  // Apply saved settings & user permissions to UI
  applySettingsToUI();
  applyUserPermissions();

  // Calculate initial pricing summaries
  calculateKidsPrice();
  calculateTrampolinePrice();
  calculatePlaystationPrice();

  // Render tables & ledger
  renderAllTables();
  renderAdminUsersTable();
  renderVaultsUI();
  renderMoneyFlowTable();
  renderShiftsHistoryTable();
  renderReportsDashboard();
  renderRefundsTable();
  updateSectionBadges();

  // Real-time timer ticker every second
  setInterval(tickTimers, 1000);

  // Initialize Supabase Cloud Sync & Realtime Channel
  if (typeof initCloudSync === 'function') {
    initCloudSync();
  }
});

/* ==========================================================================
   Data Persistence (LocalStorage)
   ========================================================================== */
function loadData() {
  try {
    // One-time complete wipe of all operations requested by user
    const WIPE_FLAG = 'scooby_clean_all_tables_user_req_2026';
    if (!localStorage.getItem(WIPE_FLAG)) {
      localStorage.setItem(STORAGE_ACTIVE_BOOKINGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_ARCHIVE_BOOKINGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_QUICK_SALES, JSON.stringify([]));
      localStorage.setItem(STORAGE_REFUNDS, JSON.stringify([]));
      localStorage.setItem(STORAGE_MONEY_TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_SHIFTS_HISTORY, JSON.stringify([]));
      localStorage.setItem(STORAGE_VAULTS, JSON.stringify({ drawer: 0, sub_safe: 0, main_safe: 0 }));
      const curShift = JSON.parse(localStorage.getItem(STORAGE_CURRENT_SHIFT)) || {};
      curShift.totalRevenue = 0;
      curShift.breakdown = { kids: 0, trampoline: 0, arcade: 0, playstation: 0, art: 0 };
      localStorage.setItem(STORAGE_CURRENT_SHIFT, JSON.stringify(curShift));
      localStorage.setItem(WIPE_FLAG, 'true');
      if (typeof openShiftVideosDB === 'function') {
        openShiftVideosDB().then(db => {
          if (db) db.transaction('shiftVideos', 'readwrite').objectStore('shiftVideos').clear();
        }).catch(() => {});
      }
    }

    activeBookings = JSON.parse(localStorage.getItem(STORAGE_ACTIVE_BOOKINGS)) || [];
    archiveBookings = JSON.parse(localStorage.getItem(STORAGE_ARCHIVE_BOOKINGS)) || [];
    quickSales = JSON.parse(localStorage.getItem(STORAGE_QUICK_SALES)) || [];
    refundsList = JSON.parse(localStorage.getItem(STORAGE_REFUNDS)) || [];

    const storedSettings = JSON.parse(localStorage.getItem(STORAGE_APP_SETTINGS));
    if (storedSettings) {
      appSettings = { ...appSettings, ...storedSettings };
    }

    const storedUsers = JSON.parse(localStorage.getItem(STORAGE_USERS));
    if (storedUsers && Array.isArray(storedUsers) && storedUsers.length > 0) {
      usersList = storedUsers;
      if (!usersList.some(u => u.role === 'user')) {
        usersList.push({
          id: 'usr_employee',
          username: 'أحمد (موظف)',
          password: '123',
          role: 'user',
          permissions: {
            kids: true,
            trampoline: true,
            arcade: true,
            playstation: true,
            art: true
          }
        });
        localStorage.setItem(STORAGE_USERS, JSON.stringify(usersList));
      }
    }

    const storedCurUser = JSON.parse(localStorage.getItem(STORAGE_CURRENT_USER));
    if (storedCurUser && usersList.some(u => u.id === storedCurUser.id)) {
      currentUser = usersList.find(u => u.id === storedCurUser.id);
    } else {
      currentUser = usersList[0];
    }

    // Load 3-Vaults data
    const storedVaults = JSON.parse(localStorage.getItem(STORAGE_VAULTS));
    if (storedVaults) {
      vaults = {
        drawer: parseFloat(storedVaults.drawer) || 0,
        sub_safe: parseFloat(storedVaults.sub_safe) || 0,
        main_safe: parseFloat(storedVaults.main_safe) || 0
      };
    }

    // Load Active Shift data
    const storedShift = JSON.parse(localStorage.getItem(STORAGE_CURRENT_SHIFT));
    if (storedShift) {
      currentShift = {
        id: storedShift.id || 'shift_1',
        shiftNumber: parseInt(storedShift.shiftNumber) || 1,
        openedBy: storedShift.openedBy || (currentUser ? currentUser.username : 'مدير النظام'),
        openedAt: storedShift.openedAt || Date.now(),
        totalRevenue: parseFloat(storedShift.totalRevenue) || 0,
        breakdown: storedShift.breakdown || { kids: 0, trampoline: 0, arcade: 0, playstation: 0, art: 0 },
        status: storedShift.status || 'active'
      };
    } else {
      currentShift.openedBy = currentUser ? currentUser.username : 'مدير النظام';
    }

    // Load Money Ledger & Shifts Archive
    moneyTransactions = JSON.parse(localStorage.getItem(STORAGE_MONEY_TRANSACTIONS)) || [];
    shiftsHistory = JSON.parse(localStorage.getItem(STORAGE_SHIFTS_HISTORY)) || [];

  } catch (e) {
    console.error('Error loading stored data:', e);
    activeBookings = [];
    archiveBookings = [];
    quickSales = [];
    refundsList = [];
  }
}

function saveActiveBookings() {
  localStorage.setItem(STORAGE_ACTIVE_BOOKINGS, JSON.stringify(activeBookings));
  updateSectionBadges();
}

function saveArchiveBookings() {
  localStorage.setItem(STORAGE_ARCHIVE_BOOKINGS, JSON.stringify(archiveBookings));
  updateArchiveBadge();
}

function saveQuickSales() {
  localStorage.setItem(STORAGE_QUICK_SALES, JSON.stringify(quickSales));
  updateSectionBadges();
}

function saveAppSettings() {
  localStorage.setItem(STORAGE_APP_SETTINGS, JSON.stringify(appSettings));
  applySettingsToUI();
  calculateKidsPrice();
  calculateTrampolinePrice();
  calculatePlaystationPrice();
  if (window.dbSyncAppSettings) window.dbSyncAppSettings(appSettings);
}

function saveUsersList() {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(usersList));
  renderAdminUsersTable();
  updateSwitchUserDropdown();
}

function saveCurrentUser() {
  localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(currentUser));
  applyUserPermissions();
  if (currentShift && (!currentShift.openedBy || currentShift.openedBy === 'مدير النظام')) {
    renderVaultsUI();
  }
}

function saveVaults() {
  localStorage.setItem(STORAGE_VAULTS, JSON.stringify(vaults));
  renderVaultsUI();
  if (window.dbSyncVaults) window.dbSyncVaults(vaults);
}

function saveCurrentShift() {
  localStorage.setItem(STORAGE_CURRENT_SHIFT, JSON.stringify(currentShift));
  renderVaultsUI();
  if (window.dbUpsertShift) window.dbUpsertShift(currentShift);
}

function saveMoneyTransactions() {
  localStorage.setItem(STORAGE_MONEY_TRANSACTIONS, JSON.stringify(moneyTransactions));
  renderMoneyFlowTable();
}

function saveShiftsHistory() {
  localStorage.setItem(STORAGE_SHIFTS_HISTORY, JSON.stringify(shiftsHistory));
  renderShiftsHistoryTable();
}

function saveRefunds() {
  localStorage.setItem(STORAGE_REFUNDS, JSON.stringify(refundsList));
  updateSectionBadges();
  renderRefundsTable();
}

/* ==========================================================================
   Live Clock & Helpers
   ========================================================================== */
function startLiveClock() {
  const clockEl = document.getElementById('liveClock');
  function update() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }
  update();
  setInterval(update, 1000);
}

function formatTime(dateObj) {
  const d = new Date(dateObj);
  return d.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDate(dateObj) {
  const d = new Date(dateObj);
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
}

function generateId() {
  return '#' + Math.floor(1000 + Math.random() * 9000);
}

/* ==========================================================================
   Navigation Tabs
   ========================================================================== */
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // If clicking admin tab, vaults tab or reports tab but not admin, prevent access
      if ((tab.dataset.tab === 'admin' || tab.dataset.tab === 'vaults' || tab.dataset.tab === 'reports') && currentUser && currentUser.role !== 'admin') {
        showToast('عذراً، هذا القسم مخصص للمدير فقط ⚠️', 'warning');
        return;
      }

      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = 'section-' + tab.dataset.tab;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
        if (tab.dataset.tab === 'vaults') {
          renderVaultsUI();
          renderMoneyFlowTable();
          renderShiftsHistoryTable();
        } else if (tab.dataset.tab === 'reports') {
          renderReportsDashboard();
        } else if (tab.dataset.tab === 'refunds') {
          renderRefundsTable();
        }
      }

      // Smooth horizontal scroll into view on mobile
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });
}

function updateSectionBadges() {
  const kidsCount = activeBookings.filter(b => b.section === 'kids').length;
  const trampCount = activeBookings.filter(b => b.section === 'trampoline').length;
  const psCount = activeBookings.filter(b => b.section === 'playstation').length;
  const arcadeCount = quickSales.filter(s => s.section === 'arcade' && !s.clearedFromTable).length;
  const artCount = quickSales.filter(s => s.section === 'art' && !s.clearedFromTable).length;

  document.getElementById('badgeKids').textContent = kidsCount;
  document.getElementById('badgeTrampoline').textContent = trampCount;
  document.getElementById('badgePlaystation').textContent = psCount;
  document.getElementById('badgeArcade').textContent = arcadeCount;
  document.getElementById('badgeArt').textContent = artCount;

  const badgeRefunds = document.getElementById('badgeRefunds');
  if (badgeRefunds) {
    badgeRefunds.textContent = refundsList.length;
  }

  updateArchiveBadge();
}

function updateArchiveBadge() {
  const totalArchived = archiveBookings.length;
  const badge = document.getElementById('archiveCountBadge');
  if (badge) badge.textContent = totalArchived;
}

/* ==========================================================================
   Audio & Notifications
   ========================================================================== */
function playBeep(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (err) {
    // Ignore audio autoplay restrictions
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✨';
  if (type === 'warning') icon = '⚠️';
  if (type === 'info') icon = 'ℹ️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

/* ==========================================================================
   Financial Dynamic Pricing Calculations
   ========================================================================== */
function calculateKidsPrice() {
  const count = formState.kids.count || 1;
  const durationMin = formState.kids.durationMinutes || 30;
  const discount = parseFloat(document.getElementById('kidsDiscount').value) || 0;

  // Rate from appSettings (default 50 LE/hr per child)
  const hourlyRate = appSettings.kidsHourlyRate || 50;
  const ratePerChild = (durationMin / 60) * hourlyRate;
  const subtotal = Math.round(count * ratePerChild);
  const net = Math.max(0, subtotal - discount);

  const elBefore = document.getElementById('kidsTotalBefore');
  const elDisc = document.getElementById('kidsDiscountVal');
  const elAfter = document.getElementById('kidsTotalAfter');

  if (elBefore) elBefore.textContent = `${subtotal} ج`;
  if (elDisc) elDisc.textContent = `${discount} ج`;
  if (elAfter) elAfter.textContent = `${net} ج`;

  return { subtotal, discount, net };
}

function calculateTrampolinePrice() {
  const count = formState.trampoline.count || 1;
  const discount = parseFloat(document.getElementById('trampolineDiscount').value) || 0;

  // Game price from appSettings (default 30 LE per child)
  const gamePrice = appSettings.trampolineGamePrice || 30;
  const subtotal = count * gamePrice;
  const net = Math.max(0, subtotal - discount);

  const elBefore = document.getElementById('trampolineTotalBefore');
  const elDisc = document.getElementById('trampolineDiscountVal');
  const elAfter = document.getElementById('trampolineTotalAfter');

  if (elBefore) elBefore.textContent = `${subtotal} ج`;
  if (elDisc) elDisc.textContent = `${discount} ج`;
  if (elAfter) elAfter.textContent = `${net} ج`;

  return { subtotal, discount, net };
}

function calculatePlaystationPrice() {
  const device = formState.playstation.device || 'جهاز 1 (PS5)';
  const durationMin = formState.playstation.durationMinutes || 30;
  const discount = parseFloat(document.getElementById('psDiscount').value) || 0;

  // Rate from appSettings (default 50 LE/hr. VIP has 60% boost)
  const baseRate = appSettings.psHourlyRate || 50;
  const isVip = device.includes('VIP');
  const hourlyRate = isVip ? Math.round(baseRate * 1.6) : baseRate;
  const subtotal = Math.round((durationMin / 60) * hourlyRate);
  const net = Math.max(0, subtotal - discount);

  const elBefore = document.getElementById('psTotalBefore');
  const elDisc = document.getElementById('psDiscountVal');
  const elAfter = document.getElementById('psTotalAfter');

  if (elBefore) elBefore.textContent = `${subtotal} ج`;
  if (elDisc) elDisc.textContent = `${discount} ج`;
  if (elAfter) elAfter.textContent = `${net} ج`;

  return { subtotal, discount, net };
}

/* ==========================================================================
   1. قسم كيدز اريا (Kids Area)
   ========================================================================== */
function setupKidsAreaForm() {
  const countButtons = document.querySelectorAll('#kidsCountButtons .btn-option');
  const countDisplay = document.getElementById('kidsCountDisplay');
  const durationButtons = document.querySelectorAll('#kidsDurationButtons .duration-btn');
  const durationDisplay = document.getElementById('kidsDurationDisplay');
  const btnSubmit = document.getElementById('btnSubmitKidsBooking');
  const discountInput = document.getElementById('kidsDiscount');

  // Kids Count selection (1-8)
  countButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      countButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formState.kids.count = parseInt(btn.dataset.value);
      countDisplay.textContent = `${formState.kids.count} ${formState.kids.count === 1 ? 'طفل' : formState.kids.count === 2 ? 'طفلين' : 'أطفال'}`;
      calculateKidsPrice();
    });
  });

  // Duration selection
  durationButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      durationButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formState.kids.durationMinutes = parseInt(btn.dataset.minutes);
      formState.kids.durationLabel = btn.dataset.label;
      durationDisplay.textContent = formState.kids.durationLabel;
      calculateKidsPrice();
    });
  });

  // Discount input change
  if (discountInput) {
    discountInput.addEventListener('input', calculateKidsPrice);
  }

  // Submit button -> triggers confirmation modal
  btnSubmit.addEventListener('click', () => {
    const calc = calculateKidsPrice();
    const notes = document.getElementById('kidsNotes').value.trim();

    openBookingConfirmModal({
      section: 'kids',
      sectionTitle: 'كيدز اريا 🏰',
      icon: '🏰',
      count: formState.kids.count,
      durationMinutes: formState.kids.durationMinutes,
      durationLabel: formState.kids.durationLabel,
      subtotal: calc.subtotal,
      discount: calc.discount,
      net: calc.net,
      notes: notes,
      targetName: `${formState.kids.count} أطفال`
    });
  });

  // Clear Kids Table button
  const btnClearKids = document.getElementById('btnClearKidsTable');
  if (btnClearKids) {
    btnClearKids.addEventListener('click', () => {
      const active = activeBookings.filter(b => b.section === 'kids');
      if (active.length === 0) {
        showToast('جدول كيدز اريا فارغ بالفعل!', 'info');
        return;
      }
      openClearTableConfirmModal('kids');
    });
  }
}

/* ==========================================================================
   2. قسم ترامبولين (Trampoline)
   ========================================================================== */
function setupTrampolineForm() {
  const countButtons = document.querySelectorAll('#trampolineCountButtons .btn-option');
  const countDisplay = document.getElementById('trampolineCountDisplay');
  const btnSubmit = document.getElementById('btnSubmitTrampolineBooking');
  const discountInput = document.getElementById('trampolineDiscount');

  // Count selection
  countButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      countButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formState.trampoline.count = parseInt(btn.dataset.value);
      countDisplay.textContent = `${formState.trampoline.count} ${formState.trampoline.count === 1 ? 'طفل' : formState.trampoline.count === 2 ? 'طفلين' : 'أطفال'}`;
      calculateTrampolinePrice();
    });
  });

  // Discount input change
  if (discountInput) {
    discountInput.addEventListener('input', calculateTrampolinePrice);
  }

  // Submit button -> uses configured game duration
  btnSubmit.addEventListener('click', () => {
    const calc = calculateTrampolinePrice();
    const notes = document.getElementById('trampolineNotes').value.trim();
    const durMin = appSettings.trampolineGameDuration || 10;

    openBookingConfirmModal({
      section: 'trampoline',
      sectionTitle: 'ترامبولين 🤸‍♂️',
      icon: '🤸‍♂️',
      count: formState.trampoline.count,
      durationMinutes: durMin,
      durationLabel: `${durMin} دقائق`,
      subtotal: calc.subtotal,
      discount: calc.discount,
      net: calc.net,
      notes: notes,
      targetName: `${formState.trampoline.count} أطفال / مشتركين`
    });
  });

  // Clear Trampoline Table button
  const btnClearTrampoline = document.getElementById('btnClearTrampolineTable');
  if (btnClearTrampoline) {
    btnClearTrampoline.addEventListener('click', () => {
      const active = activeBookings.filter(b => b.section === 'trampoline');
      if (active.length === 0) {
        showToast('جدول الترامبولين فارغ بالفعل!', 'info');
        return;
      }
      openClearTableConfirmModal('trampoline');
    });
  }
}

/* ==========================================================================
   3. قسم الألعاب الإلكترونية (Arcade)
   ========================================================================== */
function setupArcade() {
  const priceButtons = document.querySelectorAll('#section-arcade .btn-price-action');
  const noteInput = document.getElementById('arcadeQuickNote');

  priceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      const note = noteInput.value.trim();

      openPriceConfirmModal({
        section: 'arcade',
        title: 'تأكيد عملية ألعاب إلكترونية 🕹️',
        icon: '🕹️',
        amount: amount,
        note: note
      });
    });
  });

  // Clear Arcade Table button
  const btnClearTable = document.getElementById('btnClearArcadeTable');
  if (btnClearTable) {
    btnClearTable.addEventListener('click', () => {
      const activeArcade = quickSales.filter(s => s.section === 'arcade' && !s.clearedFromTable);
      if (activeArcade.length === 0) {
        showToast('جدول الألعاب الإلكترونية فارغ بالفعل!', 'info');
        return;
      }
      openClearTableConfirmModal('arcade');
    });
  }
}

/* ==========================================================================
   4. قسم بلاستيشن (PlayStation)
   ========================================================================== */
function setupPlaystationForm() {
  const deviceButtons = document.querySelectorAll('#psDeviceButtons .btn-option');
  const deviceDisplay = document.getElementById('psDeviceDisplay');
  const durationButtons = document.querySelectorAll('#psDurationButtons .duration-btn');
  const durationDisplay = document.getElementById('psDurationDisplay');
  const btnSubmit = document.getElementById('btnSubmitPsBooking');
  const discountInput = document.getElementById('psDiscount');

  // Device selection
  deviceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      deviceButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formState.playstation.device = btn.dataset.device;
      deviceDisplay.textContent = formState.playstation.device;
      calculatePlaystationPrice();
    });
  });

  // Duration selection
  durationButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      durationButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formState.playstation.durationMinutes = parseInt(btn.dataset.minutes);
      formState.playstation.durationLabel = btn.dataset.label;
      durationDisplay.textContent = formState.playstation.durationLabel;
      calculatePlaystationPrice();
    });
  });

  // Discount input change
  if (discountInput) {
    discountInput.addEventListener('input', calculatePlaystationPrice);
  }

  // Submit button
  btnSubmit.addEventListener('click', () => {
    const calc = calculatePlaystationPrice();
    const notes = document.getElementById('psNotes').value.trim();

    openBookingConfirmModal({
      section: 'playstation',
      sectionTitle: 'بلاستيشن 🎮',
      icon: '🎮',
      device: formState.playstation.device,
      count: 1,
      durationMinutes: formState.playstation.durationMinutes,
      durationLabel: formState.playstation.durationLabel,
      subtotal: calc.subtotal,
      discount: calc.discount,
      net: calc.net,
      notes: notes,
      targetName: formState.playstation.device
    });
  });

  // Clear PS Table button
  const btnClearPs = document.getElementById('btnClearPsTable');
  if (btnClearPs) {
    btnClearPs.addEventListener('click', () => {
      const active = activeBookings.filter(b => b.section === 'playstation');
      if (active.length === 0) {
        showToast('جدول البلاستيشن فارغ بالفعل!', 'info');
        return;
      }
      openClearTableConfirmModal('playstation');
    });
  }
}

/* ==========================================================================
   5. قسم رسم (Art & Face Painting)
   ========================================================================== */
function setupArt() {
  const priceButtons = document.querySelectorAll('#section-art .btn-price-action');
  const noteInput = document.getElementById('artQuickNote');

  priceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      const note = noteInput.value.trim();

      openPriceConfirmModal({
        section: 'art',
        title: 'تأكيد تذكرة قسم الرسم 🎨',
        icon: '🎨',
        amount: amount,
        note: note
      });
    });
  });

  // Clear Art Table button
  const btnClearTable = document.getElementById('btnClearArtTable');
  if (btnClearTable) {
    btnClearTable.addEventListener('click', () => {
      const activeArt = quickSales.filter(s => s.section === 'art' && !s.clearedFromTable);
      if (activeArt.length === 0) {
        showToast('جدول قسم الرسم فارغ بالفعل!', 'info');
        return;
      }
      openClearTableConfirmModal('art');
    });
  }
}

/* ==========================================================================
   Modals Logic
   ========================================================================== */
function setupModals() {
  // Booking confirmation modal buttons
  document.getElementById('btnModalConfirmYes').addEventListener('click', () => {
    if (pendingConfirmation && pendingConfirmation.type === 'booking') {
      finalizeBooking(pendingConfirmation.data);
    }
    closeAllModals();
  });

  document.getElementById('btnModalConfirmNo').addEventListener('click', closeAllModals);

  // Price confirmation modal buttons
  document.getElementById('btnPriceConfirmYes').addEventListener('click', () => {
    if (pendingConfirmation && pendingConfirmation.type === 'price') {
      finalizePriceSale(pendingConfirmation.data);
    }
    closeAllModals();
  });

  document.getElementById('btnPriceConfirmNo').addEventListener('click', closeAllModals);

  // Details Modal close
  document.getElementById('btnCloseDetailsModal').addEventListener('click', closeAllModals);
  document.getElementById('btnDoneDetailsModal').addEventListener('click', closeAllModals);

  // Modal checkout button inside Details Modal
  const btnCheckoutModal = document.getElementById('btnModalCheckoutAction');
  if (btnCheckoutModal) {
    btnCheckoutModal.addEventListener('click', () => {
      if (activeDetailsBookingId) {
        checkoutBooking(activeDetailsBookingId);
        closeAllModals();
      }
    });
  }

  // Modal refund button inside Details Modal
  const btnRefundModal = document.getElementById('btnModalRefundAction');
  if (btnRefundModal) {
    btnRefundModal.addEventListener('click', () => {
      if (!activeDetailsBookingId) return;

      const booking = activeBookings.find(b => b.id === activeDetailsBookingId);
      const sale = quickSales.find(s => s.id === activeDetailsBookingId);

      if (booking) {
        activeRefundTarget = { type: 'booking', item: booking };
        openConfirmRefundModal(activeRefundTarget);
      } else if (sale) {
        activeRefundTarget = { type: 'sale', item: sale };
        openConfirmRefundModal(activeRefundTarget);
      } else {
        showToast('تعذر استرجاع هذا الحجز (قد يكون منتهياً أو غير نشط)', 'warning');
      }
    });
  }

  // Confirm Refund Modal actions
  const btnConfirmRefundYes = document.getElementById('btnConfirmRefundYes');
  if (btnConfirmRefundYes) {
    btnConfirmRefundYes.addEventListener('click', () => {
      if (activeRefundTarget) {
        const reasonInput = document.getElementById('refundReasonInput');
        const reason = reasonInput ? reasonInput.value : 'طلب العميل';
        executeRefund(activeRefundTarget, reason);
      }
    });
  }

  const btnConfirmRefundNo = document.getElementById('btnConfirmRefundNo');
  if (btnConfirmRefundNo) {
    btnConfirmRefundNo.addEventListener('click', () => {
      const confirmModal = document.getElementById('modalConfirmRefund');
      if (confirmModal) confirmModal.classList.remove('show');
      const detailsModal = document.getElementById('modalBookingDetails');
      if (detailsModal) detailsModal.classList.add('show');
    });
  }

  // Clear Table confirmation modal actions
  const btnConfirmClearTableYes = document.getElementById('btnConfirmClearTableYes');
  if (btnConfirmClearTableYes) {
    btnConfirmClearTableYes.addEventListener('click', () => {
      if (pendingClearSection) {
        executeClearTable(pendingClearSection);
      }
      closeAllModals();
    });
  }

  const btnConfirmClearTableNo = document.getElementById('btnConfirmClearTableNo');
  if (btnConfirmClearTableNo) {
    btnConfirmClearTableNo.addEventListener('click', closeAllModals);
  }

  // Reports Modal close
  document.getElementById('btnCloseReportsModal').addEventListener('click', closeAllModals);
  document.getElementById('btnDoneReportsModal').addEventListener('click', closeAllModals);

  // Open Reports button in header
  document.getElementById('btnOpenReports').addEventListener('click', () => {
    const repTab = document.getElementById('tabBtnReports');
    if (repTab && repTab.style.display !== 'none') {
      repTab.click();
    } else {
      openReportsModal();
    }
  });

  // Close modal when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAllModals();
      }
    });
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.classList.remove('show');
  });
  pendingConfirmation = null;
  activeRefundTarget = null;
  pendingClearSection = null;
}

// 1. Open Booking Confirmation
function openBookingConfirmModal(data) {
  pendingConfirmation = { type: 'booking', data };

  const modal = document.getElementById('modalConfirmBooking');
  document.getElementById('confirmModalIcon').textContent = data.icon || '✨';
  document.getElementById('confirmModalTitle').textContent = `تأكيد حجز ${data.sectionTitle}`;

  const detailsContainer = document.getElementById('confirmModalDetails');
  
  let targetRow = '';
  if (data.section === 'playstation') {
    targetRow = `
      <div class="summary-row">
        <span class="s-lbl">اسم الجهاز:</span>
        <span class="s-val">${data.device}</span>
      </div>`;
  } else {
    targetRow = `
      <div class="summary-row">
        <span class="s-lbl">عدد الأطفال:</span>
        <span class="s-val">${data.count} أطفال</span>
      </div>`;
  }

  detailsContainer.innerHTML = `
    ${targetRow}
    <div class="summary-row">
      <span class="s-lbl">المدة المحددة:</span>
      <span class="s-val">${data.durationLabel} (${data.durationMinutes} دقيقة)</span>
    </div>
    <div class="summary-row">
      <span class="s-lbl">الإجمالي:</span>
      <span class="s-val">${data.subtotal || 0} جنيه</span>
    </div>
    <div class="summary-row">
      <span class="s-lbl">الخصم المطبق:</span>
      <span class="s-val" style="color: var(--amber);">${data.discount > 0 ? data.discount + ' جنيه' : 'لا يوجد خصم'}</span>
    </div>
    <div class="summary-row" style="border-top: 1px solid rgba(255,255,255,0.15); padding-top: 10px; margin-top: 4px;">
      <span class="s-lbl" style="color: #a7f3d0; font-weight: 800;">الإجمالي بعد الخصم (المطلوب):</span>
      <span class="s-val" style="color: var(--emerald); font-size: 1.25rem;">${data.net || 0} جنيه</span>
    </div>
    <div class="summary-note-block" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 12px 14px; margin-top: 10px; display: flex; flex-direction: column; gap: 6px; text-align: right;">
      <span class="s-lbl" style="font-weight: 700; color: #94a3b8; font-size: 0.9rem;">📝 الملاحظات:</span>
      <div class="s-val-note" style="color: #fef08a; font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${data.notes ? data.notes : 'لا توجد'}</div>
    </div>
  `;

  modal.classList.add('show');
}

// 2. Open Price Confirmation (Arcade & Art)
function openPriceConfirmModal(data) {
  pendingConfirmation = { type: 'price', data };

  const modal = document.getElementById('modalConfirmPrice');
  document.getElementById('priceModalIcon').textContent = data.icon || '💵';
  document.getElementById('priceModalTitle').textContent = data.title;
  document.getElementById('priceModalAmount').textContent = data.amount;

  const noteEl = document.getElementById('priceModalNoteDisplay');
  if (data.note) {
    noteEl.textContent = `الملاحظة: ${data.note}`;
  } else {
    noteEl.textContent = 'هل أنت متأكد من تسجيل هذه الفئة؟';
  }

  modal.classList.add('show');
}

// 3. Open Details Modal
function openDetailsModal(bookingId) {
  const booking = activeBookings.find(b => b.id === bookingId) || archiveBookings.find(b => b.id === bookingId);
  if (!booking) return;

  activeDetailsBookingId = bookingId;

  // Manage visibility of checkout and refund buttons
  const btnCheckoutModal = document.getElementById('btnModalCheckoutAction');
  if (btnCheckoutModal) {
    if (booking.status === 'checked_out') {
      btnCheckoutModal.style.display = 'none';
    } else {
      btnCheckoutModal.style.display = 'inline-block';
    }
  }

  const btnRefundModal = document.getElementById('btnModalRefundAction');
  if (btnRefundModal) {
    const isActive = activeBookings.some(b => b.id === bookingId);
    btnRefundModal.style.display = isActive ? 'inline-block' : 'none';
  }

  const modal = document.getElementById('modalBookingDetails');
  const content = document.getElementById('detailsModalContent');

  let sectionArabic = 'قسم ترفيهي';
  if (booking.section === 'kids') sectionArabic = '🏰 كيدز اريا';
  else if (booking.section === 'trampoline') sectionArabic = '🤸‍♂️ ترامبولين';
  else if (booking.section === 'playstation') sectionArabic = '🎮 بلاستيشن';

  const startTimeStr = formatTime(booking.startTime);
  const endTimeStr = formatTime(booking.endTime);
  const startDateStr = formatDate(booking.startTime);

  const isKids = (booking.section === 'kids');

  content.innerHTML = `
    <div class="summary-details-list" style="margin-bottom: 0;">
      ${!isKids ? `
      <div class="summary-row">
        <span class="s-lbl">رقم الحجز:</span>
        <span class="s-val" style="color: var(--teal); font-size: 1.1rem;">${booking.id}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">القسم:</span>
        <span class="s-val">${sectionArabic}</span>
      </div>
      ` : ''}
      <div class="summary-row">
        <span class="s-lbl">${booking.section === 'playstation' ? 'الجهاز' : 'عدد الأطفال'}:</span>
        <span class="s-val">${booking.section === 'playstation' ? booking.device : booking.count + ' أطفال'}</span>
      </div>
      ${!isKids ? `
      <div class="summary-row">
        <span class="s-lbl">المدة:</span>
        <span class="s-val">${booking.durationLabel} (${booking.durationMinutes} دقيقة)</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">تاريخ الحجز:</span>
        <span class="s-val">${startDateStr}</span>
      </div>
      ` : ''}
      <div class="summary-row">
        <span class="s-lbl">وقت الدخول / البدء:</span>
        <span class="s-val">${startTimeStr}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">وقت الخروج / الانتهاء:</span>
        <span class="s-val">${endTimeStr}</span>
      </div>
      ${!isKids ? `
      <div class="summary-row">
        <span class="s-lbl">الإجمالي:</span>
        <span class="s-val">${booking.subtotal !== undefined ? booking.subtotal + ' جنيه' : '-'}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">الخصم:</span>
        <span class="s-val" style="color: var(--amber);">${booking.discount ? booking.discount + ' جنيه' : 'بدون خصم'}</span>
      </div>
      ` : ''}
      <div class="summary-row">
        <span class="s-lbl">الإجمالي بعد الخصم:</span>
        <span class="s-val" style="color: var(--emerald); font-size: 1.15rem;">${booking.net !== undefined ? booking.net + ' جنيه' : '-'}</span>
      </div>
      <div class="summary-note-block" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 12px 14px; margin-top: 10px; display: flex; flex-direction: column; gap: 6px; text-align: right;">
        <span class="s-lbl" style="font-weight: 700; color: #94a3b8; font-size: 0.9rem;">📝 الملاحظات:</span>
        <div class="s-val-note" style="color: #fef08a; font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${booking.notes ? booking.notes : 'لا توجد ملاحظات مدونة'}</div>
      </div>
      ${booking.checkedOutAt ? `
        <div class="summary-row" style="color: var(--rose); margin-top: 6px;">
          <span class="s-lbl">تم تسجيل الخروج في:</span>
          <span class="s-val">${formatTime(booking.checkedOutAt)}</span>
        </div>
      ` : ''}
    </div>
  `;

  modal.classList.add('show');
}

// 3.2 Open Quick Sale Details Modal (Arcade & Art)
function openQuickSaleDetailsModal(saleId) {
  const item = quickSales.find(s => s.id === saleId);
  if (!item) return;

  activeDetailsBookingId = saleId;

  // Hide checkout button (quick sales don't have duration / checkout)
  const btnCheckoutModal = document.getElementById('btnModalCheckoutAction');
  if (btnCheckoutModal) btnCheckoutModal.style.display = 'none';

  // Show refund button
  const btnRefundModal = document.getElementById('btnModalRefundAction');
  if (btnRefundModal) btnRefundModal.style.display = 'inline-block';

  const modal = document.getElementById('modalBookingDetails');
  const content = document.getElementById('detailsModalContent');

  const secTitle = item.section === 'arcade' ? '🕹️ ألعاب إلكترونية' : '🎨 رسم وتلوين';
  const timeStr = formatTime(item.timestamp);
  const dateStr = formatDate(item.timestamp);

  content.innerHTML = `
    <div class="summary-details-list" style="margin-bottom: 0;">
      <div class="summary-row">
        <span class="s-lbl">رقم العملية:</span>
        <span class="s-val" style="color: var(--teal); font-size: 1.1rem; font-weight: 800;">${item.id}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">القسم:</span>
        <span class="s-val">${secTitle}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">تاريخ وتوقيت التسجيل:</span>
        <span class="s-val">${dateStr} - ${timeStr}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">المسؤول / الكاشير:</span>
        <span class="s-val">${item.user || (currentUser ? currentUser.username : 'مدير النظام')}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">المبلغ المدفوع:</span>
        <span class="s-val" style="color: var(--emerald); font-size: 1.25rem; font-weight: 800;">${item.amount} جنيه</span>
      </div>
      <div class="summary-note-block" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 12px 14px; margin-top: 10px; display: flex; flex-direction: column; gap: 6px; text-align: right;">
        <span class="s-lbl" style="font-weight: 700; color: #94a3b8; font-size: 0.9rem;">📝 الملاحظات:</span>
        <div class="s-val-note" style="color: #fef08a; font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${item.note ? item.note : 'لا توجد ملاحظات مدونة'}</div>
      </div>
    </div>
  `;

  modal.classList.add('show');
}

// 3.3 Open Confirm Refund Modal
function openConfirmRefundModal(target) {
  if (!target || !target.item) return;
  const item = target.item;
  const isBooking = (target.type === 'booking');

  const refundAmt = isBooking ? (item.net !== undefined ? item.net : (item.subtotal || 0)) : (item.amount || 0);

  const secTitles = {
    kids: '🏰 كيدز اريا',
    trampoline: '🤸‍♂️ ترامبولين',
    playstation: '🎮 بلاستيشن',
    arcade: '🕹️ ألعاب إلكترونية',
    art: '🎨 رسم وتلوين'
  };
  const secName = secTitles[item.section] || item.section;

  // Close details modal first
  const detailsModal = document.getElementById('modalBookingDetails');
  if (detailsModal) detailsModal.classList.remove('show');

  const confirmModal = document.getElementById('modalConfirmRefund');
  const amountEl = document.getElementById('refundModalAmount');
  const detailsEl = document.getElementById('refundModalDetails');
  const reasonInput = document.getElementById('refundReasonInput');

  if (amountEl) amountEl.textContent = refundAmt;
  if (reasonInput) reasonInput.value = 'طلب العميل';

  let itemInfo = '';
  if (isBooking) {
    if (item.section === 'playstation') {
      itemInfo = `جهاز: ${item.device} | المدة: ${item.durationLabel || item.durationMinutes + ' د'}`;
    } else {
      itemInfo = `عدد الأطفال: ${item.count} | المدة: ${item.durationLabel || item.durationMinutes + ' د'}`;
    }
  } else {
    itemInfo = `مبيعات سريعة (${secName})`;
  }

  if (detailsEl) {
    detailsEl.innerHTML = `
      <div class="summary-row">
        <span class="s-lbl">رقم الحجز / العملية:</span>
        <span class="s-val" style="color: var(--teal); font-weight: 800;">${item.id}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">القسم:</span>
        <span class="s-val">${secName}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">البيان:</span>
        <span class="s-val">${itemInfo}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">المسؤول / الكاشير:</span>
        <span class="s-val">${item.user || (currentUser ? currentUser.username : 'مدير النظام')}</span>
      </div>
    `;
  }

  if (confirmModal) confirmModal.classList.add('show');
}

// 3.4 Execute Refund & Remove from Active Tables
function executeRefund(target, reason) {
  if (!target || !target.item) return;
  const item = target.item;
  const isBooking = (target.type === 'booking');

  const refundAmount = parseFloat(isBooking ? (item.net !== undefined ? item.net : item.subtotal) : item.amount) || 0;
  const secKey = item.section;
  const secTitles = {
    kids: 'كيدز اريا 🏰',
    trampoline: 'ترامبولين 🤸‍♂️',
    playstation: 'بلاستيشن 🎮',
    arcade: 'ألعاب إلكترونية 🕹️',
    art: 'رسم وتلوين 🎨'
  };
  const secTitle = secTitles[secKey] || secKey;
  const cleanReason = (reason && reason.trim()) ? reason.trim() : 'طلب العميل / إلغاء حجز';

  let detailsSummary = '';
  if (isBooking) {
    if (item.section === 'playstation') {
      detailsSummary = `جهاز: ${item.device} (${item.durationLabel || item.durationMinutes + ' دقيقة'})`;
    } else {
      detailsSummary = `${item.count} أطفال (${item.durationLabel || item.durationMinutes + ' دقيقة'})`;
    }
  } else {
    detailsSummary = `عملية بيع سريعة (${secTitle})`;
  }

  // 1. Deduct from Drawer Vault & Current Shift
  if (refundAmount > 0) {
    vaults.drawer = Math.max(0, (parseFloat(vaults.drawer) || 0) - refundAmount);
    if (currentShift) {
      currentShift.totalRevenue = Math.max(0, (parseFloat(currentShift.totalRevenue) || 0) - refundAmount);
      if (currentShift.breakdown && currentShift.breakdown[secKey] !== undefined) {
        currentShift.breakdown[secKey] = Math.max(0, (parseFloat(currentShift.breakdown[secKey]) || 0) - refundAmount);
      }
    }
  }

  // 2. Log in Money Flow Ledger
  const moneyTx = {
    id: generateId(),
    timestamp: Date.now(),
    type: 'refund',
    title: `استرجاع حجز ${secTitle} (${item.id})`,
    from: 'خزنة الدرج 💵',
    to: 'استرجاع نقدي للعميل ↩️',
    amount: refundAmount,
    user: currentUser ? currentUser.username : 'مدير النظام',
    shiftNumber: currentShift ? currentShift.shiftNumber : 1,
    notes: `تم رد المبلغ وإلغاء الحجز - السبب: ${cleanReason}`,
    refId: item.id
  };
  moneyTransactions.unshift(moneyTx);

  // 3. Log in Refunds System
  const refundRecord = {
    id: generateId(),
    refId: item.id,
    section: secKey,
    sectionTitle: secTitle,
    details: detailsSummary,
    amount: refundAmount,
    subtotal: isBooking ? (item.subtotal || refundAmount) : refundAmount,
    discount: isBooking ? (item.discount || 0) : 0,
    refundReason: cleanReason,
    timestamp: Date.now(),
    bookingTime: isBooking ? (item.startTime || Date.now()) : (item.timestamp || Date.now()),
    user: currentUser ? currentUser.username : 'مدير النظام',
    shiftNumber: currentShift ? currentShift.shiftNumber : 1,
    notes: isBooking ? (item.notes || '') : (item.note || '')
  };
  refundsList.unshift(refundRecord);

  // 4. Remove from active tables
  if (isBooking) {
    const bIdx = activeBookings.findIndex(b => b.id === item.id);
    if (bIdx !== -1) {
      activeBookings.splice(bIdx, 1);
    }
  } else {
    const sIdx = quickSales.findIndex(s => s.id === item.id);
    if (sIdx !== -1) {
      quickSales.splice(sIdx, 1);
    }
  }

  // 5. Save everything to localStorage and Supabase
  saveRefunds();
  saveActiveBookings();
  saveQuickSales();
  saveVaults();
  saveCurrentShift();
  saveMoneyTransactions();

  if (window.dbInsertRefund) window.dbInsertRefund(refundRecord);
  if (isBooking && window.dbDeleteBooking) window.dbDeleteBooking(item.id);
  if (!isBooking && window.dbDeleteQuickSale) window.dbDeleteQuickSale(item.id);

  // 6. Refresh UI across the system
  renderAllTables();
  renderVaultsUI();
  renderMoneyFlowTable();
  renderReportsDashboard();
  renderRefundsTable();
  updateSectionBadges();

  closeAllModals();
  activeRefundTarget = null;
  activeDetailsBookingId = null;

  showToast(`تم رد مبلغ ${refundAmount} ج وإلغاء الحجز ${item.id} بنجاح ↩️`, 'success');
  playBeep('success');
}

// 3.5 Open Clear Table Confirmation Modal
function openClearTableConfirmModal(section) {
  pendingClearSection = section;

  let secTitle = '';
  let secIcon = '🧹';
  let itemCount = 0;
  let totalAmt = 0;

  if (section === 'all') {
    secTitle = 'كافة الجداول والعمليات بالكامل';
    secIcon = '⚠️';
    itemCount = activeBookings.length + quickSales.filter(s => !s.clearedFromTable).length + refundsList.length + moneyTransactions.length + shiftsHistory.length;
    totalAmt = activeBookings.reduce((sum, b) => sum + (parseFloat(b.net) || 0), 0) +
               quickSales.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  } else if (section === 'kids') {
    secTitle = 'كيدز اريا';
    secIcon = '🏰';
    const items = activeBookings.filter(b => b.section === 'kids');
    itemCount = items.length;
    totalAmt = items.reduce((sum, b) => sum + (parseFloat(b.net) || 0), 0);
  } else if (section === 'trampoline') {
    secTitle = 'الترامبولين';
    secIcon = '🤸‍♂️';
    const items = activeBookings.filter(b => b.section === 'trampoline');
    itemCount = items.length;
    totalAmt = items.reduce((sum, b) => sum + (parseFloat(b.net) || 0), 0);
  } else if (section === 'playstation') {
    secTitle = 'البلاستيشن';
    secIcon = '🎮';
    const items = activeBookings.filter(b => b.section === 'playstation');
    itemCount = items.length;
    totalAmt = items.reduce((sum, b) => sum + (parseFloat(b.net) || 0), 0);
  } else if (section === 'arcade') {
    secTitle = 'الألعاب الإلكترونية';
    secIcon = '🕹️';
    const items = quickSales.filter(s => s.section === 'arcade' && !s.clearedFromTable);
    itemCount = items.length;
    totalAmt = items.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  } else if (section === 'art') {
    secTitle = 'الرسم والتلوين';
    secIcon = '🎨';
    const items = quickSales.filter(s => s.section === 'art' && !s.clearedFromTable);
    itemCount = items.length;
    totalAmt = items.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  } else if (section === 'money_flow') {
    secTitle = 'سجل مسار الأموال';
    secIcon = '💵';
    itemCount = moneyTransactions.length;
    totalAmt = moneyTransactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
  } else if (section === 'shifts_history') {
    secTitle = 'سجل الورديات السابقة';
    secIcon = '📑';
    itemCount = shiftsHistory.length;
    totalAmt = shiftsHistory.reduce((sum, s) => sum + (parseFloat(s.transferredAmount) || 0), 0);
  }

  if (itemCount === 0 && section !== 'all') {
    showToast('الجدول فارغ بالفعل ولا توجد به عمليات!', 'info');
    return;
  }

  const modal = document.getElementById('modalConfirmClearTable');
  const iconEl = document.getElementById('clearTableModalIcon');
  const titleEl = document.getElementById('clearTableModalTitle');
  const countEl = document.getElementById('clearTableModalCount');
  const countLabelEl = document.getElementById('clearTableModalCountLabel');
  const detailsEl = document.getElementById('clearTableModalDetails');

  if (iconEl) iconEl.textContent = secIcon;
  if (titleEl) titleEl.textContent = (section === 'all') ? 'تأكيد تصفير وحذف جميع العمليات في الجداول' : `تأكيد تصفير جدول ${secTitle}`;
  if (countEl) countEl.textContent = itemCount;
  if (countLabelEl) countLabelEl.textContent = (itemCount === 1) ? 'عملية سيتم تصفيرها' : 'عمليات سيتم تصفيرها من الجدول';

  if (detailsEl) {
    detailsEl.innerHTML = `
      <div class="summary-row">
        <span class="s-lbl">الهدف:</span>
        <span class="s-val">${secIcon} ${secTitle}</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">عدد العمليات:</span>
        <span class="s-val" style="color: #fbbf24; font-weight: 800;">${itemCount} عملية</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">إجمالي القيمة المالية:</span>
        <span class="s-val" style="color: var(--emerald); font-weight: 800;">${totalAmt.toLocaleString()} جنيه</span>
      </div>
      <div class="summary-row">
        <span class="s-lbl">حسابات الإدارة:</span>
        <span class="s-val" style="color: #34d399; font-weight: 700;">حسابات المستخدمين والصلاحيات والأسعار محفوظة 100% 🔒</span>
      </div>
    `;
  }

  if (modal) modal.classList.add('show');
}

// 3.6 Execute Clear Table
function executeClearTable(section) {
  if (!section) return;

  if (section === 'all') {
    clearAllTablesOperations(true);
    const modal = document.getElementById('modalConfirmClearTable');
    if (modal) modal.classList.remove('show');
    pendingClearSection = null;
    return;
  }

  let secTitle = '';
  if (section === 'kids' || section === 'trampoline' || section === 'playstation') {
    const toRemove = activeBookings.filter(b => b.section === section);
    toRemove.forEach(b => {
      b.status = 'ended';
      archiveBookings.unshift(b);
    });
    activeBookings = activeBookings.filter(b => b.section !== section);
    saveActiveBookings();
    saveArchiveBookings();
    renderActiveBookingsTables();
    updateSectionBadges();
    secTitle = (section === 'kids') ? 'كيدز اريا' : (section === 'trampoline' ? 'الترامبولين' : 'البلاستيشن');
  } else if (section === 'arcade' || section === 'art') {
    const items = quickSales.filter(s => s.section === section && !s.clearedFromTable);
    items.forEach(s => {
      s.clearedFromTable = true;
      s.clearedAt = Date.now();
    });
    saveQuickSales();
    renderQuickSalesTables();
    updateSectionBadges();
    secTitle = (section === 'arcade') ? 'الألعاب الإلكترونية' : 'الرسم والتلوين';
  } else if (section === 'money_flow') {
    moneyTransactions = [];
    saveMoneyTransactions();
    renderVaultTransactionsTable();
    secTitle = 'سجل مسار الأموال';
  } else if (section === 'shifts_history') {
    shiftsHistory = [];
    saveShiftsHistory();
    renderShiftsHistoryTable();
    secTitle = 'سجل الورديات السابقة';
  }

  const modal = document.getElementById('modalConfirmClearTable');
  if (modal) modal.classList.remove('show');

  playBeep('success');
  showToast(`تم تصفير جدول ${secTitle} بنجاح 🧹`, 'success');
  pendingClearSection = null;
}

/**
 * Clears and deletes all operations across all tables in the entire application
 */
async function clearAllTablesOperations(showAlert = true) {
  // 1. Reset Arrays in memory
  activeBookings = [];
  archiveBookings = [];
  quickSales = [];
  refundsList = [];
  moneyTransactions = [];
  shiftsHistory = [];

  // 2. Reset Vaults
  vaults = {
    drawer: 0,
    sub_safe: 0,
    main_safe: 0
  };

  // 3. Reset Shift revenue
  if (currentShift) {
    currentShift.totalRevenue = 0;
    currentShift.breakdown = { kids: 0, trampoline: 0, arcade: 0, playstation: 0, art: 0 };
  }

  // 4. Save clean state to localStorage
  saveActiveBookings();
  saveArchiveBookings();
  saveQuickSales();
  saveRefunds();
  saveMoneyTransactions();
  saveShiftsHistory();
  saveVaults();
  saveCurrentShift();
  if (window.dbClearAllOperations) window.dbClearAllOperations();

  // 5. Clean up any recorded shift videos from IndexedDB
  try {
    const db = await openShiftVideosDB();
    if (db) {
      const tx = db.transaction('shiftVideos', 'readwrite');
      tx.objectStore('shiftVideos').clear();
    }
  } catch (e) {
    console.warn('Could not clear IndexedDB videos:', e);
  }

  // 6. Re-render all tables and UI
  renderActiveBookingsTables();
  renderQuickSalesTables();
  renderRefundsTable();
  renderVaultTransactionsTable();
  renderShiftsHistoryTable();
  updateSectionBadges();
  updateArchiveBadge();
  updateVaultDisplays();
  updateActiveShiftUI();

  if (showAlert) {
    playChime('confirm');
    showToast('تم حذف وتصفير جميع العمليات في كافة الجداول بنجاح! 🧹✨', 'success');
  }
}
window.clearAllTablesOperations = clearAllTablesOperations;
window.openClearTableConfirmModal = openClearTableConfirmModal;
window.executeClearTable = executeClearTable;

/* ==========================================================================
   Booking Actions & Checkout
   ========================================================================== */
function finalizeBooking(data) {
  if (!currentShift || currentShift.status === 'closed') {
    showToast('تنبيه: يجب بدء وردية العمل أولاً قبل تسجيل الحجوزات 🚀', 'warning');
    openStartShiftModal();
    return;
  }

  const now = new Date();
  const startTime = now.getTime();
  const endTime = startTime + (data.durationMinutes * 60 * 1000);

  const newBooking = {
    id: generateId(),
    section: data.section,
    device: data.device || null,
    count: data.count || 1,
    durationMinutes: data.durationMinutes,
    durationLabel: data.durationLabel,
    subtotal: data.subtotal || 0,
    discount: data.discount || 0,
    net: data.net || 0,
    notes: data.notes || '',
    startTime: startTime,
    endTime: endTime,
    status: 'active',
    hasAlertedWarning: false,
    hasAlertedEnded: false,
    user: currentUser ? currentUser.username : 'مدير النظام'
  };

  activeBookings.unshift(newBooking);
  saveActiveBookings();
  if (window.dbUpsertBooking) window.dbUpsertBooking(newBooking);

  // Record Cash Inflow into Drawer Vault & Money Flow Ledger
  if (newBooking.net && newBooking.net > 0) {
    recordCashInflow(newBooking.net, data.section, newBooking.id, data.notes || `حجز ${data.sectionTitle}`);
  }

  renderAllTables();
  playBeep('success');
  showToast(`تم تسجيل حجز ${data.sectionTitle} بنجاح!`, 'success');

  // Reset form selections & inputs to default (1 kid, نصف ساعة)
  if (data.section === 'kids') {
    // Reset state
    formState.kids.count = 1;
    formState.kids.durationMinutes = 30;
    formState.kids.durationLabel = 'نصف ساعة';

    // Reset button active states
    const countBtns = document.querySelectorAll('#kidsCountButtons .btn-option');
    countBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === '1');
    });

    const durationBtns = document.querySelectorAll('#kidsDurationButtons .duration-btn');
    durationBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.minutes === '30');
    });

    // Reset text displays
    const countDisplay = document.getElementById('kidsCountDisplay');
    if (countDisplay) countDisplay.textContent = '1 طفل';

    const durationDisplay = document.getElementById('kidsDurationDisplay');
    if (durationDisplay) durationDisplay.textContent = 'نصف ساعة';

    // Reset inputs
    document.getElementById('kidsNotes').value = '';
    document.getElementById('kidsDiscount').value = '0';
    calculateKidsPrice();
  } else if (data.section === 'trampoline') {
    // Reset state
    formState.trampoline.count = 1;

    const countBtns = document.querySelectorAll('#trampolineCountButtons .btn-option');
    countBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === '1');
    });

    const countDisplay = document.getElementById('trampolineCountDisplay');
    if (countDisplay) countDisplay.textContent = '1 طفل';

    document.getElementById('trampolineNotes').value = '';
    document.getElementById('trampolineDiscount').value = '0';
    calculateTrampolinePrice();
  } else if (data.section === 'playstation') {
    // Reset state
    formState.playstation.device = 'جهاز 1 (PS5)';
    formState.playstation.durationMinutes = 30;
    formState.playstation.durationLabel = 'نصف ساعة';

    const deviceBtns = document.querySelectorAll('#psDeviceButtons .btn-option');
    deviceBtns.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === 0);
    });

    const durationBtns = document.querySelectorAll('#psDurationButtons .duration-btn');
    durationBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.minutes === '30');
    });

    const deviceDisplay = document.getElementById('psDeviceDisplay');
    if (deviceDisplay) deviceDisplay.textContent = 'جهاز 1 (PS5)';

    const durationDisplay = document.getElementById('psDurationDisplay');
    if (durationDisplay) durationDisplay.textContent = 'نصف ساعة';

    document.getElementById('psNotes').value = '';
    document.getElementById('psDiscount').value = '0';
    calculatePlaystationPrice();
  }
}

function checkoutBooking(bookingId) {
  const index = activeBookings.findIndex(b => b.id === bookingId);
  if (index === -1) return;

  const [booking] = activeBookings.splice(index, 1);
  booking.checkedOutAt = Date.now();
  booking.status = 'checked_out';

  archiveBookings.unshift(booking);

  saveActiveBookings();
  saveArchiveBookings();
  if (window.dbUpsertBooking) window.dbUpsertBooking(booking);
  renderAllTables();
  playBeep('success');
  showToast(`تم تسجيل خروج الحجز ${booking.id} وحفظه في التقارير والأرشيف!`, 'info');
}

function finalizePriceSale(data) {
  if (!currentShift || currentShift.status === 'closed') {
    showToast('تنبيه: يجب بدء وردية العمل أولاً قبل تسجيل المبيعات 🚀', 'warning');
    openStartShiftModal();
    return;
  }

  const saleItem = {
    id: generateId(),
    section: data.section,
    amount: data.amount,
    note: data.note || '',
    timestamp: Date.now(),
    user: currentUser ? currentUser.username : 'مدير النظام'
  };

  quickSales.unshift(saleItem);
  saveQuickSales();
  if (window.dbUpsertQuickSale) window.dbUpsertQuickSale(saleItem);

  // Record Cash Inflow into Drawer Vault & Money Flow Ledger
  if (saleItem.amount && saleItem.amount > 0) {
    const sectionName = data.section === 'arcade' ? 'ألعاب إلكترونية 🕹️' : 'رسم 🎨';
    recordCashInflow(saleItem.amount, data.section, saleItem.id, data.note || `مبيعات ${sectionName}`);
  }

  renderQuickSalesTables();
  playBeep('success');
  showToast(`تم تسجيل ${data.amount} جنيه بنجاح!`, 'success');

  if (data.section === 'arcade') {
    document.getElementById('arcadeQuickNote').value = '';
  } else if (data.section === 'art') {
    document.getElementById('artQuickNote').value = '';
  }
}

function deleteQuickSale(saleId) {
  const index = quickSales.findIndex(s => s.id === saleId);
  if (index === -1) return;

  const [removed] = quickSales.splice(index, 1);
  saveQuickSales();
  if (window.dbDeleteQuickSale) window.dbDeleteQuickSale(saleId);
  renderQuickSalesTables();
  renderReportsDashboard();

  // Adjust Drawer and Shift if cash was in drawer
  if (removed && removed.amount > 0 && (vaults.drawer || 0) >= removed.amount) {
    vaults.drawer -= removed.amount;
    currentShift.totalRevenue = Math.max(0, (currentShift.totalRevenue || 0) - removed.amount);
    if (currentShift.breakdown && currentShift.breakdown[removed.section]) {
      currentShift.breakdown[removed.section] = Math.max(0, currentShift.breakdown[removed.section] - removed.amount);
    }
    const tx = {
      id: generateId(),
      timestamp: Date.now(),
      type: 'general_withdraw',
      title: `إلغاء عملية ${removed.section === 'arcade' ? 'ألعاب' : 'رسم'} #${removed.id}`,
      from: 'خزنة الدرج 💵',
      to: 'إلغاء مبيعات ❌',
      amount: removed.amount,
      user: currentUser ? currentUser.username : 'مدير النظام',
      shiftNumber: currentShift.shiftNumber,
      notes: `تم حذف العملية واسترجاع المبلغ من الدرج`,
      refId: removed.id
    };
    moneyTransactions.unshift(tx);
    saveVaults();
    saveCurrentShift();
    saveMoneyTransactions();
  }

  showToast('تم حذف العملية وتحديث الخزنة', 'info');
}

/* ==========================================================================
   Timer Calculation & Status Computation
   ========================================================================== */
function tickTimers() {
  if (activeBookings.length === 0) return;

  const now = Date.now();
  let stateChanged = false;

  activeBookings.forEach(booking => {
    const diffMs = booking.endTime - now;
    const diffMin = diffMs / (1000 * 60);

    // Criteria:
    // Kids / PS: Warning threshold is 10 minutes before duration end.
    // Trampoline: Duration is 10 min, so warning is 2 min.
    const warningThreshold = booking.section === 'trampoline' ? 2 : 10;

    let newStatus = 'active';
    if (diffMs <= 0) {
      newStatus = 'ended';
      if (!booking.hasAlertedEnded) {
        booking.hasAlertedEnded = true;
        playBeep('alert');
        showToast(`انتهى وقت الحجز ${booking.id} (${booking.section === 'playstation' ? booking.device : 'أطفال'})!`, 'warning');
      }
    } else if (diffMin <= warningThreshold) {
      newStatus = 'warning';
      if (!booking.hasAlertedWarning) {
        booking.hasAlertedWarning = true;
        playBeep('alert');
        showToast(`الحجز ${booking.id} قارب على الانتهاء (أقل من ${warningThreshold} دقائق)!`, 'warning');
      }
    }

    if (booking.status !== newStatus) {
      booking.status = newStatus;
      stateChanged = true;
    }
  });

  // Re-render active rows countdown and badges
  updateTimerUI();

  if (stateChanged) {
    saveActiveBookings();
    renderKidsTable();
    renderTrampolineTable();
    renderPlaystationTable();
  }
}

/**
 * Calculates priority weight for sorting bookings by status:
 * 1 = Ended (المنتهي - أول العرض)
 * 2 = Warning (قارب على الانتهاء)
 * 3 = Active (ساري / نشط)
 */
function getBookingStatusWeight(booking, now = Date.now()) {
  const diffMs = booking.endTime - now;
  if (diffMs <= 0 || booking.status === 'ended') return 1;
  const diffMin = diffMs / (1000 * 60);
  const warningThreshold = booking.section === 'trampoline' ? 2 : 10;
  if (diffMin <= warningThreshold || booking.status === 'warning') return 2;
  return 3;
}

function updateTimerUI() {
  const now = Date.now();

  activeBookings.forEach(booking => {
    const diffMs = booking.endTime - now;

    // Elements
    const countdownEl = document.getElementById(`countdown-${booking.id.replace('#', '')}`);
    const badgeEl = document.getElementById(`badge-status-${booking.id.replace('#', '')}`);

    if (countdownEl && badgeEl) {
      let statusText = 'نشط';
      let statusClass = 'status-active';

      if (diffMs <= 0) {
        statusText = 'انتهى 🔴';
        statusClass = 'status-ended';
        countdownEl.textContent = '00:00';
        countdownEl.style.color = 'var(--rose)';
      } else {
        const totalSec = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        countdownEl.textContent = formatted;

        const warningThreshold = booking.section === 'trampoline' ? 2 : 10;
        if (mins < warningThreshold) {
          statusText = 'قرب الانتهاء 🟠';
          statusClass = 'status-warning';
          countdownEl.style.color = 'var(--amber)';
        } else {
          statusText = 'نشط 🟢';
          statusClass = 'status-active';
          countdownEl.style.color = 'var(--emerald)';
        }
      }

      badgeEl.className = `status-badge ${statusClass}`;
      badgeEl.textContent = statusText;
    }
  });
}

/* ==========================================================================
   Table Renderers
   ========================================================================== */
function renderAllTables() {
  renderKidsTable();
  renderTrampolineTable();
  renderPlaystationTable();
  renderQuickSalesTables();
  updateSectionBadges();
  renderReportsDashboard();
}

// 1. Kids Area Table (Sorted from Ended to Active: أول العرض المنتهي ثم النشط)
function renderKidsTable() {
  const tbody = document.getElementById('tbodyKidsArea');
  const empty = document.getElementById('emptyKidsArea');
  const bookings = activeBookings.filter(b => b.section === 'kids');

  tbody.innerHTML = '';
  if (bookings.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const now = Date.now();
  // Sort from ended (المنتهي أولاً) down to active (النشط)
  bookings.sort((a, b) => {
    const weightA = getBookingStatusWeight(a, now);
    const weightB = getBookingStatusWeight(b, now);
    if (weightA !== weightB) {
      return weightA - weightB; // 1 (انتهى) -> 2 (قارب على الانتهاء) -> 3 (نشط)
    }
    // Within same status: sort by endTime ascending (closest to ending / earliest ended)
    return a.endTime - b.endTime;
  });

  bookings.forEach(b => {
    const tr = document.createElement('tr');
    const cleanId = b.id.replace('#', '');
    const diffMs = b.endTime - now;

    if (diffMs <= 0 || b.status === 'ended') {
      tr.classList.add('row-status-ended');
    } else if (diffMs / (1000 * 60) <= 10 || b.status === 'warning') {
      tr.classList.add('row-status-warning');
    }

    tr.innerHTML = `
      <td><strong>👶 ${b.count}</strong> أطفال</td>
      <td>${formatTime(b.startTime)}</td>
      <td>${formatTime(b.endTime)}</td>
      <td><span id="countdown-${cleanId}" class="time-countdown">--:--</span></td>
      <td><span id="badge-status-${cleanId}" class="status-badge status-active">نشط 🟢</span></td>
      <td>
        <div class="table-actions-cell">
          <button type="button" class="btn-tbl-action btn-details" onclick="openDetailsModal('${b.id}')">
            <span>ℹ️</span> تفاصيل
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateTimerUI();
}

// 2. Trampoline Table (Sorted from Ended to Active)
function renderTrampolineTable() {
  const tbody = document.getElementById('tbodyTrampoline');
  const empty = document.getElementById('emptyTrampoline');
  const bookings = activeBookings.filter(b => b.section === 'trampoline');

  tbody.innerHTML = '';
  if (bookings.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const now = Date.now();
  bookings.sort((a, b) => {
    const weightA = getBookingStatusWeight(a, now);
    const weightB = getBookingStatusWeight(b, now);
    if (weightA !== weightB) return weightA - weightB;
    return a.endTime - b.endTime;
  });

  bookings.forEach(b => {
    const tr = document.createElement('tr');
    const cleanId = b.id.replace('#', '');
    const diffMs = b.endTime - now;

    if (diffMs <= 0 || b.status === 'ended') {
      tr.classList.add('row-status-ended');
    } else if (diffMs / (1000 * 60) <= 2 || b.status === 'warning') {
      tr.classList.add('row-status-warning');
    }

    tr.innerHTML = `
      <td><strong>🤸‍♂️ ${b.count}</strong> أطفال</td>
      <td>${formatTime(b.startTime)}</td>
      <td>${formatTime(b.endTime)}</td>
      <td><span id="countdown-${cleanId}" class="time-countdown">--:--</span></td>
      <td><span id="badge-status-${cleanId}" class="status-badge status-active">نشط 🟢</span></td>
      <td>
        <div class="table-actions-cell">
          <button type="button" class="btn-tbl-action btn-details" onclick="openDetailsModal('${b.id}')">
            <span>ℹ️</span> تفاصيل
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateTimerUI();
}

// 3. PlayStation Table (Sorted from Ended to Active)
function renderPlaystationTable() {
  const tbody = document.getElementById('tbodyPlaystation');
  const empty = document.getElementById('emptyPlaystation');
  const bookings = activeBookings.filter(b => b.section === 'playstation');

  tbody.innerHTML = '';
  if (bookings.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const now = Date.now();
  bookings.sort((a, b) => {
    const weightA = getBookingStatusWeight(a, now);
    const weightB = getBookingStatusWeight(b, now);
    if (weightA !== weightB) return weightA - weightB;
    return a.endTime - b.endTime;
  });

  bookings.forEach(b => {
    const tr = document.createElement('tr');
    const cleanId = b.id.replace('#', '');
    const diffMs = b.endTime - now;

    if (diffMs <= 0 || b.status === 'ended') {
      tr.classList.add('row-status-ended');
    } else if (diffMs / (1000 * 60) <= 10 || b.status === 'warning') {
      tr.classList.add('row-status-warning');
    }

    tr.innerHTML = `
      <td><strong>🎮 ${b.device}</strong></td>
      <td>${formatTime(b.startTime)}</td>
      <td>${formatTime(b.endTime)}</td>
      <td><span id="countdown-${cleanId}" class="time-countdown">--:--</span></td>
      <td><span id="badge-status-${cleanId}" class="status-badge status-active">نشط 🟢</span></td>
      <td>
        <div class="table-actions-cell">
          <button type="button" class="btn-tbl-action btn-details" onclick="openDetailsModal('${b.id}')">
            <span>ℹ️</span> تفاصيل
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateTimerUI();
}

// 4 & 5. Quick Sales Tables (Arcade & Art)
function renderQuickSalesTables() {
  // Arcade
  const tbodyArcade = document.getElementById('tbodyArcade');
  const emptyArcade = document.getElementById('emptyArcade');
  const arcadeItems = quickSales.filter(s => s.section === 'arcade' && !s.clearedFromTable);

  tbodyArcade.innerHTML = '';
  let totalArcade = 0;

  if (arcadeItems.length === 0) {
    emptyArcade.classList.remove('hidden');
  } else {
    emptyArcade.classList.add('hidden');
    arcadeItems.forEach((item, idx) => {
      totalArcade += item.amount;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${formatTime(item.timestamp)}</td>
        <td><strong style="color: var(--teal); font-size: 1.05rem;">${item.amount} ج</strong></td>
        <td>${item.note || '<span style="color: var(--text-muted);">-</span>'}</td>
        <td>
          <div class="table-actions-cell">
            <button type="button" class="btn-tbl-action btn-details" onclick="openQuickSaleDetailsModal('${item.id}')">
              <span>ℹ️</span> تفاصيل
            </button>
          </div>
        </td>
      `;
      tbodyArcade.appendChild(tr);
    });
  }
  document.getElementById('totalArcadeAmount').textContent = `الإجمالي: ${totalArcade} ج`;

  // Art
  const tbodyArt = document.getElementById('tbodyArt');
  const emptyArt = document.getElementById('emptyArt');
  const artItems = quickSales.filter(s => s.section === 'art' && !s.clearedFromTable);

  tbodyArt.innerHTML = '';
  let totalArt = 0;

  if (artItems.length === 0) {
    emptyArt.classList.remove('hidden');
  } else {
    emptyArt.classList.add('hidden');
    artItems.forEach((item, idx) => {
      totalArt += item.amount;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${formatTime(item.timestamp)}</td>
        <td><strong style="color: var(--rose); font-size: 1.05rem;">${item.amount} ج</strong></td>
        <td>${item.note || '<span style="color: var(--text-muted);">-</span>'}</td>
        <td>
          <div class="table-actions-cell">
            <button type="button" class="btn-tbl-action btn-details" onclick="openQuickSaleDetailsModal('${item.id}')">
              <span>ℹ️</span> تفاصيل
            </button>
          </div>
        </td>
      `;
      tbodyArt.appendChild(tr);
    });
  }
  document.getElementById('totalArtAmount').textContent = `الإجمالي: ${totalArt} ج`;
}

/* ==========================================================================
   Reports & Archived Data Logic
   ========================================================================== */
let currentReportFilter = 'all';

function setupReports() {
  const filterButtons = document.querySelectorAll('#reportFilterTabs .btn-filter');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentReportFilter = btn.dataset.filter;
      renderReportsTable();
    });
  });

  // Print Report
  document.getElementById('btnPrintReport').addEventListener('click', () => {
    window.print();
  });

  // Clear Archive
  document.getElementById('btnClearArchive').addEventListener('click', () => {
    if (confirm('هل أنت متأكد من تصفير سجل الأرشيف والتقارير؟ لا يمكن التراجع عن هذا الإجراء.')) {
      archiveBookings = [];
      quickSales = [];
      saveArchiveBookings();
      saveQuickSales();
      renderReportsTable();
      renderQuickSalesTables();
      updateSectionBadges();
      showToast('تم تصفير الأرشيف بنجاح', 'info');
    }
  });
}

function openReportsModal() {
  if (currentUser && currentUser.role !== 'admin') {
    showToast('عذراً، التقارير والأرشيف مخصصة للمدير فقط ⚠️', 'warning');
    return;
  }
  renderReportsSummary();
  renderReportsTable();
  document.getElementById('modalReportsArchive').classList.add('show');
}

function renderReportsSummary() {
  // Aggregate stats
  let totalRevenue = 0;
  let totalKids = 0;
  let totalPsCount = 0;
  let totalQuick = 0;

  // From quick sales
  quickSales.forEach(s => {
    totalRevenue += s.amount;
    totalQuick += s.amount;
  });

  // From archived bookings
  archiveBookings.forEach(b => {
    if (b.section === 'kids') {
      totalKids += (b.count || 1);
      // standard estimated rate: 50 EGP per hour per child minus discount
      const ratePerHour = appSettings.kidsHourlyRate || 50;
      const hours = (b.durationMinutes || 60) / 60;
      const subtotal = (b.count || 1) * ratePerHour * hours;
      const net = Math.max(0, subtotal - (b.discount || 0));
      totalRevenue += net;
    } else if (b.section === 'trampoline') {
      totalKids += (b.count || 1);
      const ratePerGame = appSettings.trampolineGamePrice || 30;
      const subtotal = (b.count || 1) * ratePerGame;
      const net = Math.max(0, subtotal - (b.discount || 0));
      totalRevenue += net;
    } else if (b.section === 'playstation') {
      totalPsCount += 1;
      const ratePerHour = appSettings.psHourlyRate || 50;
      const hours = (b.durationMinutes || 60) / 60;
      const subtotal = ratePerHour * hours;
      const net = Math.max(0, subtotal - (b.discount || 0));
      totalRevenue += net;
    }
  });

  document.getElementById('statTotalRevenue').textContent = `${Math.round(totalRevenue)} ج`;
  document.getElementById('statTotalKids').textContent = totalKids;
  document.getElementById('statTotalPs').textContent = totalPsCount;
  document.getElementById('statTotalQuick').textContent = `${totalQuick} ج`;
}

function renderReportsTable() {
  const tbody = document.getElementById('tbodyReportsArchive');
  const empty = document.getElementById('emptyReportsArchive');
  tbody.innerHTML = '';

  // Combine archived bookings and quick sales
  let records = [];

  archiveBookings.forEach(b => {
    records.push({
      type: 'booking',
      section: b.section,
      sectionName: b.section === 'kids' ? '🏰 كيدز اريا' : b.section === 'trampoline' ? '🤸‍♂️ ترامبولين' : '🎮 بلاستيشن',
      name: b.section === 'playstation' ? b.device : `${b.count} أطفال (${b.id})`,
      startTime: b.startTime,
      endTime: b.endTime,
      checkoutTime: b.checkedOutAt || b.endTime,
      duration: `${b.durationMinutes} دقيقة`,
      discount: b.discount ? `${b.discount} ج` : 'بدون',
      notes: b.notes || '-'
    });
  });

  quickSales.forEach(s => {
    records.push({
      type: 'sale',
      section: s.section,
      sectionName: s.section === 'arcade' ? '🕹️ ألعاب إلكترونية' : '🎨 رسم',
      name: `عملية دفع ${s.amount} جنيه`,
      startTime: s.timestamp,
      endTime: s.timestamp,
      checkoutTime: s.timestamp,
      duration: 'فوري',
      discount: '-',
      notes: s.note || '-'
    });
  });

  // Filter
  if (currentReportFilter !== 'all') {
    records = records.filter(r => r.section === currentReportFilter);
  }

  // Sort by latest first
  records.sort((a, b) => b.checkoutTime - a.checkoutTime);

  if (records.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

    records.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.sectionName}</strong></td>
      <td>${r.name}</td>
      <td>${formatTime(r.startTime)}</td>
      <td>${formatTime(r.checkoutTime)}</td>
      <td>${r.duration}</td>
      <td>${r.discount}</td>
      <td>${r.notes}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==========================================================================
   Admin Dashboard, User Permissions & Pricing Settings
   ========================================================================== */
function applyUserPermissions() {
  const user = currentUser || usersList[0];
  const isAdmin = (user.role === 'admin');

  // Update header name display with role badge
  const nameDisplay = document.getElementById('currentUserNameDisplay');
  if (nameDisplay) {
    nameDisplay.innerHTML = `${user.username} <span class="badge-role-tag">${isAdmin ? 'مدير' : 'مستخدم عادي'}</span>`;
  }

  const sections = [
    { key: 'kids', tab: document.getElementById('tabBtnKids'), panel: document.getElementById('section-kids-area') },
    { key: 'trampoline', tab: document.getElementById('tabBtnTrampoline'), panel: document.getElementById('section-trampoline') },
    { key: 'arcade', tab: document.getElementById('tabBtnArcade'), panel: document.getElementById('section-arcade') },
    { key: 'playstation', tab: document.getElementById('tabBtnPlaystation'), panel: document.getElementById('section-playstation') },
    { key: 'art', tab: document.getElementById('tabBtnArt'), panel: document.getElementById('section-art') }
  ];

  const adminTab = document.getElementById('tabBtnAdmin');
  const adminPanel = document.getElementById('section-admin');

  let firstVisibleTab = null;

  sections.forEach(sec => {
    if (!sec.tab || !sec.panel) return;
    // Admin has access to all sections. Regular user checks permissions.
    const isAllowed = isAdmin || (user.permissions && user.permissions[sec.key] === true);
    if (isAllowed) {
      sec.tab.style.display = '';
      if (!firstVisibleTab) firstVisibleTab = sec.tab;
    } else {
      sec.tab.style.display = 'none';
      sec.panel.classList.remove('active');
    }
  });

  // Admin tab and section are STRICTLY visible ONLY for the Admin!
  if (adminTab) {
    if (isAdmin) {
      adminTab.style.display = '';
      if (!firstVisibleTab) firstVisibleTab = adminTab;
    } else {
      adminTab.style.display = 'none';
      if (adminPanel) adminPanel.classList.remove('active');
    }
  }

  // Reports button: Hidden from header
  const btnReports = document.getElementById('btnOpenReports');
  if (btnReports) {
    btnReports.style.display = 'none';
  }

  // Vaults tab & section: STRICTLY visible ONLY for the Admin!
  const vaultsTab = document.getElementById('tabBtnVaults');
  const vaultsPanel = document.getElementById('section-vaults');

  if (vaultsTab) {
    if (isAdmin) {
      vaultsTab.style.display = '';
      if (!firstVisibleTab) firstVisibleTab = vaultsTab;
    } else {
      vaultsTab.style.display = 'none';
      if (vaultsPanel) vaultsPanel.classList.remove('active');
    }
  }

  // Reports tab & section: STRICTLY visible ONLY for the Admin!
  const reportsTab = document.getElementById('tabBtnReports');
  const reportsPanel = document.getElementById('section-reports');

  if (reportsTab) {
    if (isAdmin) {
      reportsTab.style.display = '';
      if (!firstVisibleTab) firstVisibleTab = reportsTab;
    } else {
      reportsTab.style.display = 'none';
      if (reportsPanel) reportsPanel.classList.remove('active');
    }
  }

  // Refunds tab & section: Visible for audit & review
  const refundsTab = document.getElementById('tabBtnRefunds');
  if (refundsTab) {
    refundsTab.style.display = '';
    if (!firstVisibleTab) firstVisibleTab = refundsTab;
  }

  // Shift Badge in Header is visible for BOTH Employee & Admin (so employee can start/close shift)
  const headerShiftBadge = document.getElementById('headerShiftBadge');
  if (headerShiftBadge) {
    headerShiftBadge.style.display = 'flex';
  }

  // Drawer cash balance in header is visible ONLY for the Admin!
  const drawerWrapper = document.getElementById('headerDrawerBalanceWrapper');
  const drawerSep = document.getElementById('headerDrawerSep');
  if (drawerWrapper) drawerWrapper.style.display = 'none';
  if (drawerSep) drawerSep.style.display = 'none';

  // Ensure an active tab is selected that is visible and allowed
  const activeTab = document.querySelector('.nav-tab.active');
  if (!activeTab || activeTab.style.display === 'none' || (!isAdmin && (activeTab === adminTab || activeTab === vaultsTab || activeTab === reportsTab))) {
    if (firstVisibleTab) {
      firstVisibleTab.click();
    }
  }
}

function applySettingsToUI() {
  // Update badges & text in sections
  const kidsHint = document.getElementById('kidsPriceHintBadge');
  if (kidsHint) kidsHint.textContent = `سعر الطفل التقديري: ${appSettings.kidsHourlyRate} ج/ساعة`;

  const trampHint = document.getElementById('trampolineSubHint');
  if (trampHint) trampHint.textContent = `مدة الجيم ثابتة: ${appSettings.trampolineGameDuration} دقائق لكل حجز`;

  const trampFixed = document.getElementById('trampolineFixedBadge');
  if (trampFixed) trampFixed.textContent = `⚡ مدة الجيم: ${appSettings.trampolineGameDuration} دقائق`;

  const trampBanner = document.getElementById('trampolineDurationBannerText');
  if (trampBanner) {
    trampBanner.innerHTML = `<strong>مدة الترامبولين محددة تلقائياً:</strong> ${appSettings.trampolineGameDuration} دقائق للجيم (يبدأ التوقيت فور تأكيد الحجز).`;
  }

  const psHint = document.getElementById('psPriceHintBadge');
  if (psHint) psHint.textContent = `سعر الساعة: ${appSettings.psHourlyRate} ج`;

  // Update admin previews
  const prevKids = document.getElementById('previewKidsPrice');
  if (prevKids) prevKids.textContent = `${appSettings.kidsHourlyRate} ج`;

  const prevPs = document.getElementById('previewPsPrice');
  if (prevPs) prevPs.textContent = `${appSettings.psHourlyRate} ج`;

  const prevTrampP = document.getElementById('previewTrampolinePrice');
  if (prevTrampP) prevTrampP.textContent = `${appSettings.trampolineGamePrice} ج`;

  const prevTrampD = document.getElementById('previewTrampolineDuration');
  if (prevTrampD) prevTrampD.textContent = `${appSettings.trampolineGameDuration} دقائق`;

  // Update input values in modal
  const inpKids = document.getElementById('inputKidsHourly');
  if (inpKids) inpKids.value = appSettings.kidsHourlyRate;

  const inpPs = document.getElementById('inputPsHourly');
  if (inpPs) inpPs.value = appSettings.psHourlyRate;

  const inpTrampP = document.getElementById('inputTrampolinePrice');
  if (inpTrampP) inpTrampP.value = appSettings.trampolineGamePrice;

  const inpTrampD = document.getElementById('inputTrampolineDuration');
  if (inpTrampD) inpTrampD.value = appSettings.trampolineGameDuration;

  // Update form state
  formState.trampoline.durationMinutes = appSettings.trampolineGameDuration;
  formState.trampoline.durationLabel = `${appSettings.trampolineGameDuration} دقائق`;
}

function renderAdminUsersTable() {
  const tbodyAdmin = document.getElementById('tbodyAdminUsers');
  const tbodyModal = document.getElementById('tbodyModalUsers');
  const badgeAdmin = document.getElementById('adminUsersCountBadge');
  const badgeModal = document.getElementById('modalUsersCountBadge');

  if (badgeAdmin) badgeAdmin.textContent = `${usersList.length} مستخدم`;
  if (badgeModal) badgeModal.textContent = `${usersList.length} مستخدم`;

  const sectionNames = {
    kids: '🏰 كيدز اريا',
    trampoline: '🤸‍♂️ ترامبولين',
    arcade: '🕹️ العاب',
    playstation: '🎮 بلاستيشن',
    art: '🎨 رسم'
  };

  const generateRowsHtml = () => {
    return usersList.map(u => {
      // Build permissions pills
      let permBadges = '';
      if (u.role === 'admin') {
        permBadges = '<span class="perm-pill" style="background: rgba(245, 158, 11, 0.2); color: #fde047; border-color: rgba(245, 158, 11, 0.4);">⭐ كامل الصلاحيات (مدير)</span>';
      } else {
        const perms = u.permissions || {};
        const activeList = Object.keys(perms).filter(k => perms[k] === true);
        if (activeList.length === 0) {
          permBadges = '<span class="perm-pill" style="color: #ef4444;">لا توجد أقسام مسموحة</span>';
        } else {
          permBadges = activeList.map(k => `<span class="perm-pill">${sectionNames[k] || k}</span>`).join(' ');
        }
      }

      const isCurrent = currentUser && currentUser.id === u.id;
      const currentTag = isCurrent ? ' <span style="color: var(--teal); font-size: 0.8rem; font-weight: 800;">(الحالي 🟢)</span>' : '';

      const actionsHtml = `
        <div class="table-actions-cell">
          <button type="button" class="btn-tbl-action btn-tbl-edit" onclick="editUser('${u.id}')" title="تعديل هذا المستخدم">
            ✏️ تعديل
          </button>
          ${u.id === 'usr_admin' ? '' : `
            <button type="button" class="btn-tbl-action btn-tbl-delete" onclick="deleteUser('${u.id}')" title="حذف هذا المستخدم">
              🗑️ حذف
            </button>
          `}
        </div>
      `;

      return `
        <tr>
          <td><strong>${u.username}</strong>${currentTag}</td>
          <td>${u.role === 'admin' ? '<span style="color: #fde047; font-weight: 800;">مدير</span>' : '<span style="color: #cbd5e1; font-weight: 700;">مستخدم عادي</span>'}</td>
          <td>${permBadges}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  };

  const rows = generateRowsHtml();
  if (tbodyAdmin) tbodyAdmin.innerHTML = rows;
  if (tbodyModal) tbodyModal.innerHTML = rows;
}

window.editUser = function(userId) {
  const user = usersList.find(u => u.id === userId);
  if (!user) return;

  const modalUsers = document.getElementById('modalUsersManagement');
  if (modalUsers) modalUsers.classList.add('show');

  document.getElementById('editUserId').value = user.id;
  document.getElementById('newUsername').value = user.username;
  document.getElementById('newPassword').value = user.password || '';
  document.getElementById('newUserRole').value = user.role || 'user';

  const perms = user.permissions || {};
  document.getElementById('permKids').checked = perms.kids !== false;
  document.getElementById('permTrampoline').checked = perms.trampoline !== false;
  document.getElementById('permArcade').checked = perms.arcade !== false;
  document.getElementById('permPlaystation').checked = perms.playstation !== false;
  document.getElementById('permArt').checked = perms.art !== false;

  document.getElementById('userFormTitle').textContent = `✏️ تعديل بيانات: ${user.username}`;
  document.getElementById('btnSaveNewUser').textContent = '💾 تحديث بيانات المستخدم';
  const btnCancel = document.getElementById('btnCancelEditUser');
  if (btnCancel) btnCancel.classList.remove('hidden');

  document.getElementById('formNewUser').scrollIntoView({ behavior: 'smooth' });
};

window.cancelEditUser = function() {
  document.getElementById('editUserId').value = '';
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newUserRole').value = 'user';

  document.getElementById('permKids').checked = true;
  document.getElementById('permTrampoline').checked = true;
  document.getElementById('permArcade').checked = true;
  document.getElementById('permPlaystation').checked = true;
  document.getElementById('permArt').checked = true;

  document.getElementById('userFormTitle').textContent = '➕ إضافة مستخدم جديد';
  document.getElementById('btnSaveNewUser').textContent = '💾 حفظ المستخدم والصلاحيات';
  const btnCancel = document.getElementById('btnCancelEditUser');
  if (btnCancel) btnCancel.classList.add('hidden');
};

window.deleteUser = function(userId) {
  if (userId === 'usr_admin') {
    alert('لا يمكن حذف حساب مدير النظام الرئيسي!');
    return;
  }
  if (currentUser && currentUser.id === userId) {
    alert('لا يمكن حذف المستخدم النشط حالياً! يرجى التبديل لحساب آخر أولاً.');
    return;
  }

  const targetUser = usersList.find(u => u.id === userId);
  if (!targetUser) return;

  if (targetUser.role === 'admin') {
    const adminCount = usersList.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      alert('يجب أن يبقى مدير واحد على الأقل في النظام!');
      return;
    }
  }

  if (!confirm(`هل أنت متأكد من حذف المستخدم "${targetUser.username}" نهائياً؟`)) {
    return;
  }

  usersList = usersList.filter(u => u.id !== userId);
  saveUsersList();
  if (window.dbDeleteUser) window.dbDeleteUser(userId);
  showToast(`تم حذف المستخدم "${targetUser.username}" بنجاح`, 'info');
};

function setupAdminSection() {
  // Modal toggles: Users Management
  const btnOpenUsers = document.getElementById('btnOpenUsersModal');
  const modalUsers = document.getElementById('modalUsersManagement');
  const btnCloseUsers = document.getElementById('btnCloseUsersModal');
  const btnDoneUsers = document.getElementById('btnDoneUsersModal');

  if (btnOpenUsers && modalUsers) {
    btnOpenUsers.addEventListener('click', () => {
      cancelEditUser();
      modalUsers.classList.add('show');
    });
  }
  if (btnCloseUsers && modalUsers) {
    btnCloseUsers.addEventListener('click', () => {
      cancelEditUser();
      modalUsers.classList.remove('show');
    });
  }
  if (btnDoneUsers && modalUsers) {
    btnDoneUsers.addEventListener('click', () => {
      cancelEditUser();
      modalUsers.classList.remove('show');
    });
  }

  // Role select changes
  const roleSelect = document.getElementById('newUserRole');
  if (roleSelect) {
    roleSelect.addEventListener('change', () => {
      const isAdm = (roleSelect.value === 'admin');
      const hint = document.getElementById('permNoteHint');
      if (isAdm) {
        document.getElementById('permKids').checked = true;
        document.getElementById('permTrampoline').checked = true;
        document.getElementById('permArcade').checked = true;
        document.getElementById('permPlaystation').checked = true;
        document.getElementById('permArt').checked = true;
        if (hint) hint.textContent = '🛡️ تنبيه: المدير يملك صلاحية كاملة على جميع الأقسام وصفحة الإدارة تلقائياً.';
      } else {
        if (hint) hint.textContent = '⚠️ تنبيه: أي قسم لا يتم اختياره هنا، سيتم إخفاؤه تماماً عند دخول هذا المستخدم. صفحة الإدارة تظهر للمدير فقط.';
      }
    });
  }

  // Modal toggles: Pricing Settings
  const btnOpenPricing = document.getElementById('btnOpenPricingModal');
  const modalPricing = document.getElementById('modalPricingSettings');
  const btnClosePricing = document.getElementById('btnClosePricingModal');
  const btnDonePricing = document.getElementById('btnDonePricingModal');

  if (btnOpenPricing && modalPricing) {
    btnOpenPricing.addEventListener('click', () => {
      document.getElementById('inputKidsHourly').value = appSettings.kidsHourlyRate;
      document.getElementById('inputPsHourly').value = appSettings.psHourlyRate;
      document.getElementById('inputTrampolinePrice').value = appSettings.trampolineGamePrice;
      document.getElementById('inputTrampolineDuration').value = appSettings.trampolineGameDuration;
      modalPricing.classList.add('show');
    });
  }
  if (btnClosePricing && modalPricing) {
    btnClosePricing.addEventListener('click', () => modalPricing.classList.remove('show'));
  }
  if (btnDonePricing && modalPricing) {
    btnDonePricing.addEventListener('click', () => modalPricing.classList.remove('show'));
  }

  // Save Pricing Settings
  const btnSavePricing = document.getElementById('btnSavePricingSettings');
  if (btnSavePricing) {
    btnSavePricing.addEventListener('click', () => {
      const kidsRate = parseInt(document.getElementById('inputKidsHourly').value);
      const psRate = parseInt(document.getElementById('inputPsHourly').value);
      const trampPrice = parseInt(document.getElementById('inputTrampolinePrice').value);
      const trampDur = parseInt(document.getElementById('inputTrampolineDuration').value);

      if (!kidsRate || kidsRate <= 0 || !psRate || psRate <= 0 || !trampPrice || trampPrice <= 0 || !trampDur || trampDur <= 0) {
        showToast('يرجى كتابة أرقام صحيحة أكبر من صفر لجميع الأسعار والمدد', 'warning');
        return;
      }

      appSettings.kidsHourlyRate = kidsRate;
      appSettings.psHourlyRate = psRate;
      appSettings.trampolineGamePrice = trampPrice;
      appSettings.trampolineGameDuration = trampDur;

      saveAppSettings();
      modalPricing.classList.remove('show');
      showToast('تم حفظ وتحديث الأسعار والمدد بنجاح ✅', 'success');
      playChime('confirm');
    });
  }

  // Save / Update User
  const btnSaveUser = document.getElementById('btnSaveNewUser');
  if (btnSaveUser) {
    btnSaveUser.addEventListener('click', () => {
      const editId = document.getElementById('editUserId').value.trim();
      const usernameInput = document.getElementById('newUsername');
      const passwordInput = document.getElementById('newPassword');
      const roleSelect = document.getElementById('newUserRole');
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      const role = roleSelect ? roleSelect.value : 'user';

      if (!username || !password) {
        showToast('يرجى كتابة اسم المستخدم وكلمة المرور', 'warning');
        return;
      }

      // Check unique username
      const existingSameName = usersList.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== editId);
      if (existingSameName) {
        showToast('اسم المستخدم مسجل بالفعل! اختر اسماً آخر', 'warning');
        return;
      }

      const permissions = {
        kids: role === 'admin' ? true : document.getElementById('permKids').checked,
        trampoline: role === 'admin' ? true : document.getElementById('permTrampoline').checked,
        arcade: role === 'admin' ? true : document.getElementById('permArcade').checked,
        playstation: role === 'admin' ? true : document.getElementById('permPlaystation').checked,
        art: role === 'admin' ? true : document.getElementById('permArt').checked
      };

      if (editId) {
        // Edit existing user
        const userToUpdate = usersList.find(u => u.id === editId);
        if (!userToUpdate) return;

        userToUpdate.username = username;
        userToUpdate.password = password;
        // Keep main admin always admin
        userToUpdate.role = (userToUpdate.id === 'usr_admin') ? 'admin' : role;
        userToUpdate.permissions = permissions;

        // If editing active user, update currentUser
        if (currentUser && currentUser.id === editId) {
          currentUser = userToUpdate;
          saveCurrentUser();
        }

        saveUsersList();
        if (window.dbUpsertUser) window.dbUpsertUser(userToUpdate);
        cancelEditUser();
        showToast(`تم تحديث بيانات المستخدم "${username}" بنجاح ✅`, 'success');
        playChime('confirm');
      } else {
        // Add new user
        const newUser = {
          id: 'usr_' + Date.now(),
          username: username,
          password: password,
          role: role,
          permissions: permissions
        };

        usersList.push(newUser);
        saveUsersList();
        if (window.dbUpsertUser) window.dbUpsertUser(newUser);
        cancelEditUser();
        showToast(`تم تسجيل المستخدم "${username}" بنجاح ✅`, 'success');
        playChime('confirm');
      }
    });
  }

  // Switch User Modal
  const modalSwitch = document.getElementById('modalSwitchUser');
  const btnSwitchTop = document.getElementById('btnSwitchUserTop');
  const btnQuickSwitch = document.getElementById('btnQuickSwitchUser');
  const btnCancelSwitch = document.getElementById('btnCancelSwitchUser');
  const btnConfirmSwitch = document.getElementById('btnConfirmSwitchUser');

  function openSwitchModal() {
    updateSwitchUserDropdown();
    document.getElementById('modalCurrentActiveUserName').textContent = currentUser.username;
    document.getElementById('inputSwitchPassword').value = '';
    modalSwitch.classList.add('show');
  }

  if (btnSwitchTop) btnSwitchTop.addEventListener('click', openSwitchModal);
  if (btnQuickSwitch) btnQuickSwitch.addEventListener('click', openSwitchModal);
  if (btnCancelSwitch) btnCancelSwitch.addEventListener('click', () => modalSwitch.classList.remove('show'));

  if (btnConfirmSwitch) {
    btnConfirmSwitch.addEventListener('click', () => {
      const select = document.getElementById('selectSwitchUser');
      const password = document.getElementById('inputSwitchPassword').value.trim();
      const targetUser = usersList.find(u => u.id === select.value);

      if (!targetUser) {
        showToast('المستخدم غير موجود', 'warning');
        return;
      }

      if (targetUser.password !== password) {
        showToast('كلمة المرور غير صحيحة! ❌', 'warning');
        playChime('alert');
        return;
      }

      currentUser = targetUser;
      saveCurrentUser();
      modalSwitch.classList.remove('show');
      showToast(`تم تسجيل الدخول بنجاح كـ "${currentUser.username}" (${currentUser.role === 'admin' ? 'مدير' : 'مستخدم عادي'}) ✅`, 'success');
      playChime('confirm');
    });
  }

  // Clear All Tables Button (Admin card)
  const btnClearAll = document.getElementById('btnOpenClearAllModal');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      openClearTableConfirmModal('all');
    });
  }
}

function updateSwitchUserDropdown() {
  const select = document.getElementById('selectSwitchUser');
  if (!select) return;
  select.innerHTML = '';
  usersList.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.username} (${u.role === 'admin' ? 'مدير' : 'مستخدم عادي'})`;
    if (currentUser && currentUser.id === u.id) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

/* ==========================================================================
   Vaults, Daily Shifts & Money Flow Ledger
   ========================================================================== */

/**
 * Centralized cash inflow recorder
 * Automatically deposits revenue into the drawer safe of the active shift
 */
function recordCashInflow(amount, section, refId, note) {
  const numAmount = parseFloat(amount) || 0;
  if (numAmount <= 0) return;

  // 1. Credit Drawer Vault
  vaults.drawer = (parseFloat(vaults.drawer) || 0) + numAmount;

  // 2. Accumulate in Active Shift
  if (!currentShift.breakdown) {
    currentShift.breakdown = { kids: 0, trampoline: 0, arcade: 0, playstation: 0, art: 0 };
  }
  currentShift.totalRevenue = (parseFloat(currentShift.totalRevenue) || 0) + numAmount;
  currentShift.breakdown[section] = (parseFloat(currentShift.breakdown[section]) || 0) + numAmount;

  const sectionTitles = {
    kids: 'كيدز اريا 🏰',
    trampoline: 'ترامبولين 🤸‍♂️',
    arcade: 'العاب الكترونية 🕹️',
    playstation: 'بلاستيشن 🎮',
    art: 'رسم وتلوين 🎨'
  };

  const secTitle = sectionTitles[section] || section;

  // 3. Log Movement in Money Flow Audit Ledger
  const tx = {
    id: generateId(),
    timestamp: Date.now(),
    type: 'sale',
    title: `إيراد حجز / مبيعات ${secTitle}`,
    from: secTitle,
    to: 'خزنة الدرج 💵',
    amount: numAmount,
    user: currentUser ? currentUser.username : 'مدير النظام',
    shiftNumber: currentShift.shiftNumber || 1,
    notes: note || `إيراد ${secTitle} رقم ${refId}`,
    refId: refId
  };

  moneyTransactions.unshift(tx);

  saveVaults();
  saveCurrentShift();
  saveMoneyTransactions();
  if (window.dbInsertTransaction) window.dbInsertTransaction(tx);
}

/**
 * Updates real-time balance numbers in header, cards, and hero banner
 */
function renderVaultsUI() {
  const drawerBal = Math.round((parseFloat(vaults.drawer) || 0) * 100) / 100;
  const subBal = Math.round((parseFloat(vaults.sub_safe) || 0) * 100) / 100;
  const mainBal = Math.round((parseFloat(vaults.main_safe) || 0) * 100) / 100;
  const totalLiq = Math.round((drawerBal + subBal + mainBal) * 100) / 100;

  const isShiftActive = currentShift && currentShift.status === 'active';

  // Header active/closed shift status
  const activeContent = document.getElementById('headerShiftActiveContent');
  const closedContent = document.getElementById('headerShiftClosedContent');

  if (activeContent && closedContent) {
    if (isShiftActive) {
      activeContent.style.display = 'flex';
      closedContent.style.display = 'none';

      const headerShiftNum = document.getElementById('headerShiftNum');
      if (headerShiftNum) headerShiftNum.textContent = currentShift.shiftNumber || 1;

      const headerDrawerBalance = document.getElementById('headerDrawerBalance');
      if (headerDrawerBalance) headerDrawerBalance.textContent = `${drawerBal} ج`;
    } else {
      activeContent.style.display = 'none';
      closedContent.style.display = 'flex';
    }
  }

  // Drawer cash balance in header is visible ONLY for the Admin!
  const isAdmin = (currentUser && currentUser.role === 'admin');
  const drawerWrapper = document.getElementById('headerDrawerBalanceWrapper');
  const drawerSep = document.getElementById('headerDrawerSep');
  if (drawerWrapper) drawerWrapper.style.display = 'none';
  if (drawerSep) drawerSep.style.display = 'none';

  // Hero banner status (inside Admin vaults tab)
  const heroCurrentShiftNum = document.getElementById('heroCurrentShiftNum');
  if (heroCurrentShiftNum) {
    heroCurrentShiftNum.textContent = isShiftActive ? `#${currentShift.shiftNumber || 1}` : 'مغلقة';
  }

  const heroCurrentCashier = document.getElementById('heroCurrentCashier');
  if (heroCurrentCashier) {
    heroCurrentCashier.textContent = isShiftActive ? (currentShift.openedBy || 'الموظف') : 'لا توجد وردية مفتوحة';
  }

  const btnHeroClose = document.getElementById('btnHeroCloseShift');
  if (btnHeroClose) {
    btnHeroClose.innerHTML = isShiftActive 
      ? '<span>🚪</span><span>تقفيل الوردية وترحيل النقدية</span>'
      : '<span>🚀</span><span>بدء وردية عمل جديدة</span>';
  }

  const btnDrawerClose = document.getElementById('btnDrawerCloseShift');
  if (btnDrawerClose) {
    btnDrawerClose.innerHTML = isShiftActive 
      ? '<span>🚪</span> تقفيل الوردية' 
      : '<span>🚀</span> بدء وردية جديدة';
  }

  // Vault cards
  const elDrawer = document.getElementById('vaultDrawerBalance');
  if (elDrawer) elDrawer.textContent = `${drawerBal} ج`;

  const elSub = document.getElementById('vaultSubBalance');
  if (elSub) elSub.textContent = `${subBal} ج`;

  const elMain = document.getElementById('vaultMainBalance');
  if (elMain) elMain.textContent = `${mainBal} ج`;

  const elTotal = document.getElementById('vaultTotalLiquidity');
  if (elTotal) elTotal.textContent = `${totalLiq} ج`;
}

/**
 * Renders the Money Flow Ledger Table with filter support
 */
function renderMoneyFlowTable() {
  const tbody = document.getElementById('tbodyMoneyFlow');
  const emptyState = document.getElementById('emptyMoneyFlow');
  const countBadge = document.getElementById('moneyFlowTxCount');

  if (!tbody) return;

  let filtered = moneyTransactions;
  if (currentMoneyFlowFilter === 'sale') {
    filtered = moneyTransactions.filter(t => t.type === 'sale');
  } else if (currentMoneyFlowFilter === 'shift_close') {
    filtered = moneyTransactions.filter(t => t.type === 'shift_close' || t.type === 'shift_start');
  } else if (currentMoneyFlowFilter === 'vault_transfer') {
    filtered = moneyTransactions.filter(t => t.type === 'vault_transfer' || t.type === 'general_deposit' || t.type === 'general_withdraw');
  }

  if (countBadge) countBadge.textContent = `${filtered.length} حركة مالية`;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const badgeMap = {
    sale: { class: 'tx-badge-sale', text: 'إيراد مبيعات 💵' },
    shift_start: { class: 'tx-badge-shift', text: 'بدء وردية 🚀' },
    shift_close: { class: 'tx-badge-shift', text: 'تقفيل وردية 🚪' },
    vault_transfer: { class: 'tx-badge-transfer', text: 'تحويل خزن ←' },
    general_deposit: { class: 'tx-badge-deposit', text: 'إيداع خارجي ➕' },
    general_withdraw: { class: 'tx-badge-withdraw', text: 'سحب مصروفات ➖' }
  };

  tbody.innerHTML = filtered.map((tx, idx) => {
    const bInfo = badgeMap[tx.type] || { class: 'tx-badge-sale', text: tx.type };
    const dateObj = new Date(tx.timestamp);
    const dateStr = formatDate(dateObj);
    const timeStr = formatTime(dateObj);

    let amountClass = 'tx-amount-in';
    let sign = '+';
    if (tx.type === 'general_withdraw') {
      amountClass = 'tx-amount-out';
      sign = '-';
    } else if (tx.type === 'vault_transfer' || tx.type === 'shift_close' || tx.type === 'shift_start') {
      amountClass = 'tx-amount-neutral';
      sign = '';
    }

    return `
      <tr>
        <td><strong>#${filtered.length - idx}</strong></td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 700;">${timeStr}</div>
          <div style="font-size: 0.74rem; color: var(--text-muted);">${dateStr}</div>
        </td>
        <td><span class="tx-badge ${bInfo.class}">${bInfo.text}</span></td>
        <td><span class="tx-vault-pill">${tx.from}</span></td>
        <td style="text-align: center;"><span class="tx-path-arrow">←</span></td>
        <td><span class="tx-vault-pill">${tx.to}</span></td>
        <td><span class="${amountClass}">${sign}${tx.amount} ج</span></td>
        <td><strong>${tx.user || 'مدير'}</strong></td>
        <td><span style="color: var(--teal); font-weight: 800;">#${tx.shiftNumber || 1}</span></td>
        <td style="max-width: 220px; font-size: 0.82rem; color: #cbd5e1;">${tx.notes || tx.title || '-'}</td>
      </tr>
    `;
  }).join('');
}
const renderVaultTransactionsTable = renderMoneyFlowTable;

/**
 * Renders the Closed Shifts History Table
 */
function renderShiftsHistoryTable() {
  const tbody = document.getElementById('tbodyShiftsHistory');
  const emptyState = document.getElementById('emptyShiftsHistory');
  const badge = document.getElementById('shiftsCountBadge');

  if (!tbody) return;

  if (badge) badge.textContent = `${shiftsHistory.length} وردية`;

  if (shiftsHistory.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = shiftsHistory.map(s => {
    const openDate = new Date(s.openedAt);
    const closeDate = new Date(s.closedAt);
    const hasVideos = (s.hasVideos || s.video1Saved || s.video2Saved) && !s.videosDeleted;
    const videoCell = hasVideos
      ? `
        <div class="shift-video-actions-cell">
          <button type="button" class="btn-table-view-videos" onclick="openViewShiftVideosModal('${s.id}')" title="معاينة وتشغيل الفيديوهات">🎬 عرض</button>
          <button type="button" class="btn-table-delete-video" onclick="promptDeleteShiftVideos('${s.id}')" title="حذف الفيديوهات نهائياً من البرنامج">🗑️ حذف</button>
        </div>
      `
      : (s.videosDeleted
          ? `<span class="deleted-videos-pill" title="تم مسح الفيديو نهائياً من البرنامج">🗑️ تم الحذف</span>`
          : `<span style="color: #64748b; font-size: 0.78rem;">⚪ لا توجد فيديوهات</span>`
        );

    return `
      <tr>
        <td><strong style="color: var(--amber); font-size: 1.05rem;">وردية #${s.shiftNumber}</strong></td>
        <td><strong>${s.closedBy || s.openedBy || '---'}</strong></td>
        <td style="font-size: 0.82rem;">${formatDate(openDate)} - ${formatTime(openDate)}</td>
        <td style="font-size: 0.82rem;">${formatDate(closeDate)} - ${formatTime(closeDate)}</td>
        <td><strong style="color: var(--emerald); font-size: 1.15rem;">${s.transferredAmount || 0} ج</strong></td>
        <td>${videoCell}</td>
        <td style="font-size: 0.84rem; color: #cbd5e1;">${s.notes ? s.notes : 'تم التقفيل والترحيل بالكامل'}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Opens Start Shift modal for employee or admin
 */
function openStartShiftModal() {
  if (currentShift && currentShift.status === 'active') {
    showToast(`الوردية #${currentShift.shiftNumber} نشطة ومفتوحة حالياً باسم (${currentShift.openedBy}) 🟢`, 'info');
    return;
  }

  const modal = document.getElementById('modalStartShift');
  if (!modal) return;

  let nextNum = 1;
  if (shiftsHistory && shiftsHistory.length > 0) {
    const nums = shiftsHistory.map(s => parseInt(s.shiftNumber) || 0);
    nextNum = Math.max(...nums) + 1;
  } else if (currentShift && currentShift.shiftNumber) {
    nextNum = currentShift.shiftNumber;
  }

  const cashierName = currentUser ? currentUser.username : 'الموظف';
  const nameEl = document.getElementById('startShiftCashierDisplay');
  if (nameEl) nameEl.textContent = cashierName;

  const numEl = document.getElementById('startShiftNumDisplay');
  if (numEl) numEl.textContent = `وردية #${nextNum}`;

  const now = new Date();
  const timeEl = document.getElementById('startShiftTimeDisplay');
  if (timeEl) timeEl.textContent = `${formatDate(now)} - ${formatTime(now)}`;

  const notesEl = document.getElementById('startShiftNotes');
  if (notesEl) notesEl.value = '';

  modal.classList.add('show');
}

/**
 * Confirms Start Shift:
 * Sets active shift state and logs shift start in the audit ledger
 */
function confirmStartShift() {
  let nextNum = 1;
  if (shiftsHistory && shiftsHistory.length > 0) {
    const nums = shiftsHistory.map(s => parseInt(s.shiftNumber) || 0);
    nextNum = Math.max(...nums) + 1;
  } else if (currentShift && currentShift.shiftNumber) {
    nextNum = currentShift.shiftNumber;
  }

  const notesInput = document.getElementById('startShiftNotes');
  const startNotes = notesInput ? notesInput.value.trim() : '';
  const cashierName = currentUser ? currentUser.username : 'الموظف';

  currentShift = {
    id: 'shift_' + nextNum,
    shiftNumber: nextNum,
    openedBy: cashierName,
    openedAt: Date.now(),
    totalRevenue: 0,
    breakdown: { kids: 0, trampoline: 0, arcade: 0, playstation: 0, art: 0 },
    status: 'active',
    startNotes: startNotes
  };

  // Log shift start in audit ledger
  const tx = {
    id: generateId(),
    timestamp: Date.now(),
    type: 'shift_start',
    title: `بدء وردية جديدة #${nextNum}`,
    from: cashierName,
    to: 'خزنة الدرج 💵',
    amount: 0,
    user: cashierName,
    shiftNumber: nextNum,
    notes: startNotes ? `بدء الوردية: ${startNotes}` : 'بدء وردية عمل جديدة واستلام العهدة',
    refId: currentShift.id
  };
  moneyTransactions.unshift(tx);

  saveCurrentShift();
  saveMoneyTransactions();
  if (window.dbUpsertShift) window.dbUpsertShift(currentShift);
  if (window.dbInsertTransaction) window.dbInsertTransaction(tx);

  const modal = document.getElementById('modalStartShift');
  if (modal) modal.classList.remove('show');

  playChime('confirm');
  showToast(`تم بدء وردية عمل جديدة (#${nextNum}) بنجاح! بالتوفيق في عملك اليوم 🚀`, 'success');
}

/* ==========================================================================
   Shift Camera Video Verification & IndexedDB Storage
   ========================================================================== */
const recordedShiftVideos = { video1: null, video2: null };
const shiftMediaStreams = { video1: null, video2: null };
const shiftMediaRecorders = { video1: null, video2: null };
const shiftRecordedChunks = { video1: [], video2: [] };
const shiftTimerIntervals = { video1: null, video2: null };
const shiftRecordingSeconds = { video1: 0, video2: 0 };
const shiftVideoObjectUrls = { video1: null, video2: null };
let activeViewModalUrls = [];
let pendingDeleteShiftId = null;
let currentViewingShiftId = null;

/**
 * Initializes and opens the IndexedDB for storing shift verification videos
 */
function openShiftVideosDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB is not supported on this browser.');
      resolve(null);
      return;
    }
    const request = indexedDB.open('ClubShiftVideosDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('shiftVideos')) {
        db.createObjectStore('shiftVideos', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => {
      console.error('IndexedDB open error:', e);
      resolve(null);
    };
  });
}

/**
 * Saves recorded video blobs for a closed shift into IndexedDB
 */
async function saveShiftVideosToDB(shiftId, blob1, blob2) {
  try {
    const db = await openShiftVideosDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction('shiftVideos', 'readwrite');
      const store = tx.objectStore('shiftVideos');
      if (blob1) {
        store.put({ id: `${shiftId}_v1`, shiftId: shiftId, slot: 1, blob: blob1, date: Date.now() });
      }
      if (blob2) {
        store.put({ id: `${shiftId}_v2`, shiftId: shiftId, slot: 2, blob: blob2, date: Date.now() });
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => {
        console.error('Error saving shift videos in IndexedDB:', err);
        resolve(false);
      };
    });
  } catch (err) {
    console.error('saveShiftVideosToDB exception:', err);
    return false;
  }
}

/**
 * Retrieves shift video blobs from IndexedDB by shift ID
 */
async function getShiftVideosFromDB(shiftId) {
  try {
    const db = await openShiftVideosDB();
    if (!db) return { video1: null, video2: null };
    return new Promise((resolve) => {
      const tx = db.transaction('shiftVideos', 'readonly');
      const store = tx.objectStore('shiftVideos');
      const req1 = store.get(`${shiftId}_v1`);
      const req2 = store.get(`${shiftId}_v2`);
      let v1 = null;
      let v2 = null;
      let count = 0;
      const checkDone = () => {
        count++;
        if (count === 2) resolve({ video1: v1 ? v1.blob : null, video2: v2 ? v2.blob : null });
      };
      req1.onsuccess = () => { v1 = req1.result; checkDone(); };
      req1.onerror = () => { checkDone(); };
      req2.onsuccess = () => { v2 = req2.result; checkDone(); };
      req2.onerror = () => { checkDone(); };
    });
  } catch (err) {
    console.error('getShiftVideosFromDB exception:', err);
    return { video1: null, video2: null };
  }
}

/**
 * Permanently deletes shift video blobs from IndexedDB by shift ID
 */
async function deleteShiftVideosFromDB(shiftId) {
  try {
    const db = await openShiftVideosDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction('shiftVideos', 'readwrite');
      const store = tx.objectStore('shiftVideos');
      store.delete(`${shiftId}_v1`);
      store.delete(`${shiftId}_v2`);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => {
        console.error('Error deleting shift videos from IndexedDB:', err);
        resolve(false);
      };
    });
  } catch (err) {
    console.error('deleteShiftVideosFromDB exception:', err);
    return false;
  }
}

/**
 * Prompts user to confirm permanent deletion of shift videos
 */
function promptDeleteShiftVideos(shiftId) {
  const shift = shiftsHistory.find(s => s.id === shiftId);
  if (!shift) return;

  pendingDeleteShiftId = shiftId;
  const modal = document.getElementById('modalConfirmDeleteShiftVideos');
  const shiftNumEl = document.getElementById('deleteVideoModalShiftNum');

  if (shiftNumEl) {
    shiftNumEl.textContent = `وردية #${shift.shiftNumber || 1}`;
  }

  if (modal) {
    modal.classList.add('show');
  } else {
    if (confirm(`هل أنت متأكد من حذف فيديوهات توثيق وردية #${shift.shiftNumber} نهائياً من البرنامج؟`)) {
      executeDeleteShiftVideos(shiftId);
    }
  }
}

/**
 * Permanently deletes shift videos from IndexedDB and updates records
 */
async function executeDeleteShiftVideos(shiftId) {
  const targetId = shiftId || pendingDeleteShiftId;
  if (!targetId) return;

  const shift = shiftsHistory.find(s => s.id === targetId);
  if (!shift) return;

  // 1. Delete blobs from IndexedDB
  await deleteShiftVideosFromDB(targetId);

  // 2. Mark shift as videos deleted in history
  shift.hasVideos = false;
  shift.video1Saved = false;
  shift.video2Saved = false;
  shift.videosDeleted = true;
  shift.videosDeletedAt = Date.now();
  saveShiftsHistory();

  // 3. Update related transactions in audit ledger
  moneyTransactions.forEach(tx => {
    if (tx.refId === targetId || (tx.type === 'shift_close' && String(tx.shiftNumber) === String(shift.shiftNumber))) {
      tx.hasVideos = false;
      tx.videosDeleted = true;
    }
  });
  saveMoneyTransactions();

  // 4. Close preview modal if it was open for this shift
  if (currentViewingShiftId === targetId) {
    closeViewShiftVideosModal();
  }

  // 5. Close confirmation modal
  const confirmModal = document.getElementById('modalConfirmDeleteShiftVideos');
  if (confirmModal) confirmModal.classList.remove('show');
  pendingDeleteShiftId = null;

  // 6. Refresh UI tables
  renderShiftsHistoryTable();
  if (typeof renderVaultTransactionsTable === 'function') {
    renderVaultTransactionsTable();
  }

  playChime('confirm');
  showToast(`تم حذف فيديوهات توثيق وردية #${shift.shiftNumber} نهائياً من البرنامج بنجاح! 🗑️`, 'success');
}

window.promptDeleteShiftVideos = promptDeleteShiftVideos;
window.executeDeleteShiftVideos = executeDeleteShiftVideos;

/**
 * Returns the best supported video mime type
 */
function getSupportedVideoMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
}

/**
 * Starts live camera recording for a specific video slot ('video1' or 'video2')
 */
async function startShiftVideoRecording(slotKey) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('عذراً، المتصفح أو الجهاز لا يدعم تشغيل وتسجيل الكاميرا المباشرة ⚠️', 'danger');
    return;
  }

  const slotNum = slotKey === 'video1' ? '1' : '2';
  const card = document.getElementById(`slotCardVideo${slotNum}`);
  const placeholder = document.getElementById(`placeholderVideo${slotNum}`);
  const liveVideo = document.getElementById(`liveVideo${slotNum}`);
  const playbackVideo = document.getElementById(`playbackVideo${slotNum}`);
  const recOverlay = document.getElementById(`recOverlayVideo${slotNum}`);
  const timerDisplay = document.getElementById(`timerVideo${slotNum}`);
  const statusBadge = document.getElementById(`statusBadgeVideo${slotNum}`);
  const btnStart = document.getElementById(`btnStartRecVideo${slotNum}`);
  const btnStop = document.getElementById(`btnStopRecVideo${slotNum}`);
  const btnRerec = document.getElementById(`btnRerecVideo${slotNum}`);

  // Clean any previous stream on this slot
  if (shiftMediaStreams[slotKey]) {
    shiftMediaStreams[slotKey].getTracks().forEach(t => t.stop());
    shiftMediaStreams[slotKey] = null;
  }

  let stream = null;
  try {
    // Attempt video + audio
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: true
    });
  } catch (audioErr) {
    console.warn('Audio or mic denied, falling back to video only:', audioErr);
    try {
      // Fallback: video only
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
    } catch (videoErr) {
      console.error('Camera access error:', videoErr);
      let errorMsg = 'تعذر الوصول إلى الكاميرا! يرجى التأكد من توصيل الكاميرا ومنح إذن الوصول للمتصفح 📹';
      if (videoErr.name === 'NotAllowedError' || videoErr.name === 'PermissionDeniedError') {
        errorMsg = 'تم رفض إذن الكاميرا! يرجى السماح بالوصول للكاميرا من إعدادات المتصفح لإتمام التقفيل ⚠️';
      } else if (videoErr.name === 'NotFoundError' || videoErr.name === 'DevicesNotFoundError') {
        errorMsg = 'لم يتم العثور على كاميرا متصلة بالجهاز! 📹';
      }
      showToast(errorMsg, 'danger');
      return;
    }
  }

  shiftMediaStreams[slotKey] = stream;
  if (liveVideo) {
    liveVideo.srcObject = stream;
    liveVideo.style.display = 'block';
  }
  if (placeholder) placeholder.style.display = 'none';
  if (playbackVideo) {
    playbackVideo.pause();
    playbackVideo.src = '';
    playbackVideo.style.display = 'none';
  }

  // Set up MediaRecorder
  const mimeType = getSupportedVideoMimeType();
  const options = mimeType ? { mimeType } : undefined;
  let recorder;
  try {
    recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
  } catch (e) {
    recorder = new MediaRecorder(stream);
  }

  shiftRecordedChunks[slotKey] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      shiftRecordedChunks[slotKey].push(event.data);
    }
  };

  recorder.onstop = () => {
    const mime = recorder.mimeType || mimeType || 'video/webm';
    const blob = new Blob(shiftRecordedChunks[slotKey], { type: mime });
    recordedShiftVideos[slotKey] = blob;

    if (shiftVideoObjectUrls[slotKey]) {
      URL.revokeObjectURL(shiftVideoObjectUrls[slotKey]);
    }
    const videoUrl = URL.createObjectURL(blob);
    shiftVideoObjectUrls[slotKey] = videoUrl;

    if (liveVideo) {
      liveVideo.srcObject = null;
      liveVideo.style.display = 'none';
    }
    if (playbackVideo) {
      playbackVideo.src = videoUrl;
      playbackVideo.style.display = 'block';
    }
    if (recOverlay) recOverlay.style.display = 'none';

    if (card) {
      card.classList.remove('is-recording');
      card.classList.add('is-recorded');
    }

    if (statusBadge) {
      statusBadge.className = 'slot-status-pill status-ready';
      statusBadge.textContent = '🟢 تم تسجيل الفيديو بنجاح';
    }

    if (btnStart) btnStart.style.display = 'none';
    if (btnStop) btnStop.style.display = 'none';
    if (btnRerec) btnRerec.style.display = 'inline-flex';

    showToast(`تم حفظ وتوثيق ${slotKey === 'video1' ? 'الفيديو الأول (جرد الدرج)' : 'الفيديو الثاني (ترحيل النقدية)'} بنجاح! ✅`, 'success');
  };

  shiftMediaRecorders[slotKey] = recorder;
  recorder.start(500);

  // UI state for recording
  if (card) {
    card.classList.remove('is-recorded');
    card.classList.remove('shake-warning');
    card.classList.add('is-recording');
  }
  if (statusBadge) {
    statusBadge.className = 'slot-status-pill status-recording';
    statusBadge.textContent = '🔴 جارِ التسجيل الآن...';
  }
  if (btnStart) btnStart.style.display = 'none';
  if (btnStop) btnStop.style.display = 'inline-flex';
  if (btnRerec) btnRerec.style.display = 'none';
  if (recOverlay) recOverlay.style.display = 'flex';

  // Timer counter
  shiftRecordingSeconds[slotKey] = 0;
  if (timerDisplay) timerDisplay.textContent = '00:00';
  if (shiftTimerIntervals[slotKey]) clearInterval(shiftTimerIntervals[slotKey]);
  shiftTimerIntervals[slotKey] = setInterval(() => {
    shiftRecordingSeconds[slotKey]++;
    const m = String(Math.floor(shiftRecordingSeconds[slotKey] / 60)).padStart(2, '0');
    const s = String(shiftRecordingSeconds[slotKey] % 60).padStart(2, '0');
    if (timerDisplay) timerDisplay.textContent = `${m}:${s}`;
  }, 1000);
}

/**
 * Stops live recording for a specific video slot
 */
function stopShiftVideoRecording(slotKey) {
  if (shiftTimerIntervals[slotKey]) {
    clearInterval(shiftTimerIntervals[slotKey]);
    shiftTimerIntervals[slotKey] = null;
  }
  const recorder = shiftMediaRecorders[slotKey];
  if (recorder && recorder.state !== 'inactive') {
    try { recorder.stop(); } catch(e) {}
  }
  if (shiftMediaStreams[slotKey]) {
    shiftMediaStreams[slotKey].getTracks().forEach(t => t.stop());
    shiftMediaStreams[slotKey] = null;
  }
}

/**
 * Resets a video slot to initial state for re-recording
 */
function resetShiftVideoSlot(slotKey) {
  if (shiftTimerIntervals[slotKey]) {
    clearInterval(shiftTimerIntervals[slotKey]);
    shiftTimerIntervals[slotKey] = null;
  }
  const recorder = shiftMediaRecorders[slotKey];
  if (recorder && recorder.state !== 'inactive') {
    try { recorder.stop(); } catch(e) {}
  }
  if (shiftMediaStreams[slotKey]) {
    shiftMediaStreams[slotKey].getTracks().forEach(t => t.stop());
    shiftMediaStreams[slotKey] = null;
  }

  recordedShiftVideos[slotKey] = null;
  if (shiftVideoObjectUrls[slotKey]) {
    URL.revokeObjectURL(shiftVideoObjectUrls[slotKey]);
    shiftVideoObjectUrls[slotKey] = null;
  }

  const slotNum = slotKey === 'video1' ? '1' : '2';
  const card = document.getElementById(`slotCardVideo${slotNum}`);
  const placeholder = document.getElementById(`placeholderVideo${slotNum}`);
  const liveVideo = document.getElementById(`liveVideo${slotNum}`);
  const playbackVideo = document.getElementById(`playbackVideo${slotNum}`);
  const recOverlay = document.getElementById(`recOverlayVideo${slotNum}`);
  const timerDisplay = document.getElementById(`timerVideo${slotNum}`);
  const statusBadge = document.getElementById(`statusBadgeVideo${slotNum}`);
  const btnStart = document.getElementById(`btnStartRecVideo${slotNum}`);
  const btnStop = document.getElementById(`btnStopRecVideo${slotNum}`);
  const btnRerec = document.getElementById(`btnRerecVideo${slotNum}`);

  if (card) {
    card.classList.remove('is-recording');
    card.classList.remove('is-recorded');
    card.classList.remove('shake-warning');
  }
  if (placeholder) placeholder.style.display = 'flex';
  if (liveVideo) {
    liveVideo.srcObject = null;
    liveVideo.style.display = 'none';
  }
  if (playbackVideo) {
    playbackVideo.pause();
    playbackVideo.src = '';
    playbackVideo.style.display = 'none';
  }
  if (recOverlay) recOverlay.style.display = 'none';
  if (timerDisplay) timerDisplay.textContent = '00:00';
  if (statusBadge) {
    statusBadge.className = 'slot-status-pill status-empty';
    statusBadge.textContent = '⚪ لم يتم التسجيل بعد';
  }
  if (btnStart) btnStart.style.display = 'inline-flex';
  if (btnStop) btnStop.style.display = 'none';
  if (btnRerec) btnRerec.style.display = 'none';
}

/**
 * Resets both video slots for shift close
 */
function resetAllShiftVideoSlots() {
  resetShiftVideoSlot('video1');
  resetShiftVideoSlot('video2');
}

/**
 * Cleanly stops any active camera streams across both slots
 */
function cleanupAllShiftCameraStreams() {
  ['video1', 'video2'].forEach(slotKey => {
    if (shiftTimerIntervals[slotKey]) {
      clearInterval(shiftTimerIntervals[slotKey]);
      shiftTimerIntervals[slotKey] = null;
    }
    const recorder = shiftMediaRecorders[slotKey];
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch(e) {}
    }
    if (shiftMediaStreams[slotKey]) {
      shiftMediaStreams[slotKey].getTracks().forEach(t => t.stop());
      shiftMediaStreams[slotKey] = null;
    }
  });
}

/**
 * Triggers a shake animation on a card to alert the user
 */
function shakeSlotCard(cardId) {
  const el = document.getElementById(cardId);
  if (!el) return;
  el.classList.remove('shake-warning');
  void el.offsetWidth; // Reflow
  el.classList.add('shake-warning');
  setTimeout(() => {
    el.classList.remove('shake-warning');
  }, 650);
}

/**
 * Opens modal to review recorded videos of a closed shift
 */
async function openViewShiftVideosModal(shiftId) {
  const modal = document.getElementById('modalViewShiftVideos');
  if (!modal) return;

  const titleEl = document.getElementById('viewVideosModalTitle');
  const subtitleEl = document.getElementById('viewVideosModalSubtitle');
  const p1 = document.getElementById('viewModalPlayer1');
  const p2 = document.getElementById('viewModalPlayer2');
  const noV1 = document.getElementById('viewModalNoVideo1');
  const noV2 = document.getElementById('viewModalNoVideo2');

  activeViewModalUrls.forEach(url => URL.revokeObjectURL(url));
  activeViewModalUrls = [];
  currentViewingShiftId = shiftId;

  const shift = shiftsHistory.find(s => s.id === shiftId);
  if (titleEl) {
    titleEl.textContent = `فيديوهات توثيق وردية #${shift ? shift.shiftNumber : ''}`;
  }
  if (subtitleEl && shift) {
    const closeDate = new Date(shift.closedAt);
    subtitleEl.textContent = `المسؤول: ${shift.closedBy || shift.openedBy || '---'} | الإغلاق: ${formatDate(closeDate)} ${formatTime(closeDate)} | المبلغ المحول: ${shift.transferredAmount || 0} ج`;
  }

  showToast('جارِ تحميل الفيديوهات الموثقة... ⏳', 'info');
  const { video1, video2 } = await getShiftVideosFromDB(shiftId);

  const card1 = document.getElementById('viewReviewCard1');
  const card2 = document.getElementById('viewReviewCard2');
  const grid = modal.querySelector('.video-review-grid');

  if (video1) {
    const url1 = URL.createObjectURL(video1);
    activeViewModalUrls.push(url1);
    if (p1) {
      p1.src = url1;
      p1.style.display = 'block';
    }
    if (noV1) noV1.style.display = 'none';
  } else {
    if (p1) {
      p1.src = '';
      p1.style.display = 'none';
    }
    if (noV1) noV1.style.display = 'flex';
  }

  if (video2) {
    const url2 = URL.createObjectURL(video2);
    activeViewModalUrls.push(url2);
    if (p2) {
      p2.src = url2;
      p2.style.display = 'block';
    }
    if (noV2) noV2.style.display = 'none';
    if (card2) card2.style.display = 'block';
    if (grid) grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
  } else {
    if (p2) {
      p2.src = '';
      p2.style.display = 'none';
    }
    if (noV2) noV2.style.display = 'none';
    if (card2) card2.style.display = 'none';
    if (grid) grid.style.gridTemplateColumns = '1fr';
  }

  modal.classList.add('show');
}

/**
 * Closes the shift videos review modal and clears players
 */
function closeViewShiftVideosModal() {
  const modal = document.getElementById('modalViewShiftVideos');
  if (modal) {
    modal.classList.remove('show');
    const grid = modal.querySelector('.video-review-grid');
    if (grid) grid.style.gridTemplateColumns = '';
  }
  const card2 = document.getElementById('viewReviewCard2');
  if (card2) card2.style.display = '';
  const p1 = document.getElementById('viewModalPlayer1');
  const p2 = document.getElementById('viewModalPlayer2');
  if (p1) { p1.pause(); p1.src = ''; }
  if (p2) { p2.pause(); p2.src = ''; }
  activeViewModalUrls.forEach(url => URL.revokeObjectURL(url));
  activeViewModalUrls = [];
  currentViewingShiftId = null;
}

window.openViewShiftVideosModal = openViewShiftVideosModal;
window.closeViewShiftVideosModal = closeViewShiftVideosModal;

/**
 * Opens Close Shift modal and displays breakdown (Allowed for employee at end of day or admin)
 */
function openCloseShiftModal() {
  if (!currentShift || currentShift.status === 'closed') {
    showToast('لا توجد وردية مفتوحة حالياً لتقفيلها! ⚪', 'warning');
    return;
  }

  const modal = document.getElementById('modalCloseShift');
  if (!modal) return;

  // Clean slate for video recording slot
  resetAllShiftVideoSlots();

  const currentCashier = currentUser ? currentUser.username : (currentShift.openedBy || 'الموظف');

  const shiftNumEl = document.getElementById('closeShiftNumDisplay');
  if (shiftNumEl) shiftNumEl.textContent = `وردية #${currentShift.shiftNumber || 1}`;
  const cashierEl = document.getElementById('closeShiftCashierDisplay');
  if (cashierEl) cashierEl.textContent = `${currentCashier} (المسلم)`;

  const startTimeEl = document.getElementById('closeShiftStartTimeDisplay');
  if (startTimeEl) {
    const startTime = new Date(currentShift.openedAt || Date.now());
    startTimeEl.textContent = `${formatDate(startTime)} - ${formatTime(startTime)}`;
  }

  const bd = currentShift.breakdown || {};
  const elKids = document.getElementById('closeBreakdownKids');
  if (elKids) elKids.textContent = `${bd.kids || 0} ج`;
  const elTrampoline = document.getElementById('closeBreakdownTrampoline');
  if (elTrampoline) elTrampoline.textContent = `${bd.trampoline || 0} ج`;
  const elPs = document.getElementById('closeBreakdownPs');
  if (elPs) elPs.textContent = `${bd.playstation || 0} ج`;
  const elArcade = document.getElementById('closeBreakdownArcade');
  if (elArcade) elArcade.textContent = `${bd.arcade || 0} ج`;
  const elArt = document.getElementById('closeBreakdownArt');
  if (elArt) elArt.textContent = `${bd.art || 0} ج`;

  const drawerBal = vaults.drawer || 0;
  const elAmt = document.getElementById('closeShiftAmountDisplay');
  if (elAmt) elAmt.textContent = `${drawerBal} جنيه`;
  const elNotes = document.getElementById('closeShiftNotes');
  if (elNotes) elNotes.value = '';

  modal.classList.add('show');
}

/**
 * Confirms Close Shift:
 * 1. Validates mandatory camera video recording
 * 2. Saves video record to IndexedDB
 * 3. Transfers full drawer cash to sub safe
 * 4. Zeros drawer
 * 5. Logs shift_close transaction in audit ledger
 * 6. Archives closed shift
 * 7. Marks shift as closed & starts next shift
 */
function confirmCloseShift() {
  // STRICT MANDATORY CONDITION: Both live camera videos must be recorded
  if (!recordedShiftVideos.video1 || !recordedShiftVideos.video2) {
    if (!recordedShiftVideos.video1 && !recordedShiftVideos.video2) {
      showToast('⚠️ لا يمكن تقفيل الوردية وترحيل اليومية! يجب تسجيل الفيديو الأول والفيديو الثاني من الكاميرا أولاً.', 'danger');
      shakeSlotCard('slotCardVideo1');
      shakeSlotCard('slotCardVideo2');
    } else if (!recordedShiftVideos.video1) {
      showToast('⚠️ يجب تسجيل الفيديو الأول (جرد الدرج وعد النقدية) من الكاميرا أولاً لإتمام التقفيل!', 'danger');
      shakeSlotCard('slotCardVideo1');
    } else {
      showToast('⚠️ يجب تسجيل الفيديو الثاني (توثيق ترحيل وتسليم النقدية للخزنة) من الكاميرا أولاً لإتمام التقفيل!', 'danger');
      shakeSlotCard('slotCardVideo2');
    }
    playChime('error');
    return;
  }

  const amountToTransfer = parseFloat(vaults.drawer) || 0;
  const notesInput = document.getElementById('closeShiftNotes');
  const shiftNotes = notesInput ? notesInput.value.trim() : '';
  const currentCashier = currentUser ? currentUser.username : (currentShift.openedBy || 'الموظف');

  // Save recorded videos to IndexedDB safely
  saveShiftVideosToDB(currentShift.id, recordedShiftVideos.video1, recordedShiftVideos.video2);
  if (window.dbUploadShiftVideo) {
    if (recordedShiftVideos.video1) window.dbUploadShiftVideo(currentShift.id, 1, recordedShiftVideos.video1);
    if (recordedShiftVideos.video2) window.dbUploadShiftVideo(currentShift.id, 2, recordedShiftVideos.video2);
  }

  // 1. Transfer drawer balance to sub safe
  vaults.sub_safe = (parseFloat(vaults.sub_safe) || 0) + amountToTransfer;
  vaults.drawer = 0;

  // 2. Log Shift Close Transaction in ledger
  const tx = {
    id: generateId(),
    timestamp: Date.now(),
    type: 'shift_close',
    title: `تقفيل وردية #${currentShift.shiftNumber || 1} وترحيل النقدية`,
    from: 'خزنة الدرج 💵',
    to: 'الخزنة الفرعية 🗄️',
    amount: amountToTransfer,
    user: currentCashier,
    shiftNumber: currentShift.shiftNumber || 1,
    notes: shiftNotes ? `تقفيل وردية: ${shiftNotes}` : `ترحيل إيرادات وردية #${currentShift.shiftNumber || 1} بالكامل إلى الخزنة الفرعية (موثقة بفيديوهين بالكاميرا 📹)`,
    refId: currentShift.id,
    hasVideos: true
  };
  moneyTransactions.unshift(tx);

  // 3. Archive Closed Shift with video verification metadata
  const closedShift = {
    id: currentShift.id,
    shiftNumber: currentShift.shiftNumber || 1,
    openedBy: currentShift.openedBy || currentCashier,
    closedBy: currentCashier,
    openedAt: currentShift.openedAt || Date.now(),
    closedAt: Date.now(),
    totalRevenue: currentShift.totalRevenue || 0,
    breakdown: { ...(currentShift.breakdown || {}) },
    transferredAmount: amountToTransfer,
    notes: shiftNotes,
    hasVideos: true,
    video1Saved: true,
    video2Saved: true
  };
  shiftsHistory.unshift(closedShift);

  // Clean up recording states and streams
  resetAllShiftVideoSlots();
  cleanupAllShiftCameraStreams();

  // 4. Automatically start the next shift immediately!
  const nextNum = (closedShift.shiftNumber || 1) + 1;
  currentShift = {
    id: 'shift_' + nextNum,
    shiftNumber: nextNum,
    openedBy: currentCashier,
    openedAt: Date.now(),
    totalRevenue: 0,
    breakdown: { kids: 0, trampoline: 0, arcade: 0, playstation: 0, art: 0 },
    status: 'active',
    startNotes: `بدء تلقائي بعد تقفيل وردية #${closedShift.shiftNumber}`
  };

  // 5. Log automatic start of the new shift in audit ledger
  const autoStartTx = {
    id: generateId(),
    timestamp: Date.now() + 10,
    type: 'shift_start',
    title: `بدء وردية جديدة #${nextNum} (تلقائياً)`,
    from: currentCashier,
    to: 'خزنة الدرج 💵',
    amount: 0,
    user: currentCashier,
    shiftNumber: nextNum,
    notes: `تم فتح وردية #${nextNum} تلقائياً فور تقفيل وردية #${closedShift.shiftNumber}`,
    refId: currentShift.id
  };
  moneyTransactions.unshift(autoStartTx);

  saveVaults();
  saveCurrentShift();
  saveMoneyTransactions();
  saveShiftsHistory();

  if (window.dbSyncVaults) window.dbSyncVaults(vaults);
  if (window.dbUpsertShift) {
    window.dbUpsertShift(closedShift);
    window.dbUpsertShift(currentShift);
  }
  if (window.dbInsertTransaction) {
    window.dbInsertTransaction(tx);
    window.dbInsertTransaction(autoStartTx);
  }

  const modal = document.getElementById('modalCloseShift');
  if (modal) modal.classList.remove('show');

  playChime('confirm');
  showToast(`تم تقفيل وردية #${closedShift.shiftNumber} بنجاح وتسليم ${amountToTransfer} ج للخزنة الفرعية 🗄️ موثقة بفيديوهين بالكاميرا، وتم بدء وردية جديدة (#${nextNum}) تلقائياً! 🚀`, 'success');
}

/**
 * Opens Sub-Safe to General-Safe transfer modal
 */
function openTransferModal() {
  if (currentUser && currentUser.role !== 'admin') {
    showToast('عذراً، تحويل الأموال متاح للمدير فقط ⚠️', 'warning');
    return;
  }
  const modal = document.getElementById('modalTransferVaults');
  if (!modal) return;

  const subBal = vaults.sub_safe || 0;
  const mainBal = vaults.main_safe || 0;

  document.getElementById('transferModalSubBalance').textContent = `${subBal} ج`;
  document.getElementById('transferModalMainBalance').textContent = `${mainBal} ج`;

  const amountInp = document.getElementById('inputTransferAmount');
  if (amountInp) {
    amountInp.value = '';
    amountInp.max = subBal;
  }
  const noteInp = document.getElementById('inputTransferNote');
  if (noteInp) noteInp.value = '';

  modal.classList.add('show');
}

/**
 * Confirms Sub-Safe to General-Safe transfer
 */
function confirmVaultTransfer() {
  const amountInp = document.getElementById('inputTransferAmount');
  const noteInp = document.getElementById('inputTransferNote');
  const amount = parseFloat(amountInp.value);
  const note = noteInp ? noteInp.value.trim() : '';

  if (!amount || amount <= 0) {
    showToast('يرجى إدخال مبلغ صحيح أكبر من صفر للتحويل', 'warning');
    return;
  }

  const subBal = vaults.sub_safe || 0;
  if (amount > subBal) {
    showToast(`رصيد الخزنة الفرعية (${subBal} ج) لا يكفي لهذا التحويل!`, 'warning');
    return;
  }

  // Deduct from Sub-Safe and Add to Master Safe
  vaults.sub_safe -= amount;
  vaults.main_safe = (vaults.main_safe || 0) + amount;

  // Log in Ledger
  const tx = {
    id: generateId(),
    timestamp: Date.now(),
    type: 'vault_transfer',
    title: 'توريد نقدية إلى الخزنة العمومية',
    from: 'الخزنة الفرعية 🗄️',
    to: 'الخزنة العمومية 🏦',
    amount: amount,
    user: currentUser ? currentUser.username : 'مدير النظام',
    shiftNumber: currentShift.shiftNumber || 1,
    notes: note || 'تحويل نقدية من الخزنة الفرعية إلى الخزنة العمومية',
    refId: 'trf_' + Date.now()
  };
  moneyTransactions.unshift(tx);

  saveVaults();
  saveMoneyTransactions();
  if (window.dbSyncVaults) window.dbSyncVaults(vaults);
  if (window.dbInsertTransaction) window.dbInsertTransaction(tx);

  const modal = document.getElementById('modalTransferVaults');
  if (modal) modal.classList.remove('show');

  playChime('confirm');
  showToast(`تم تحويل ${amount} ج بنجاح من الخزنة الفرعية إلى الخزنة العمومية ✅`, 'success');
}

/**
 * Opens General Safe Deposit / Withdrawal modal
 */
function openGeneralDepositModal() {
  if (currentUser && currentUser.role !== 'admin') {
    showToast('عذراً، حركة الخزنة العمومية متاحة للمدير فقط ⚠️', 'warning');
    return;
  }
  const modal = document.getElementById('modalGeneralDeposit');
  if (!modal) return;
  document.getElementById('inputGeneralAmount').value = '';
  document.getElementById('inputGeneralNote').value = '';
  document.getElementById('selectGeneralTxType').value = 'deposit';
  modal.classList.add('show');
}

/**
 * Confirms General Safe Deposit or Withdrawal
 */
function confirmGeneralTx() {
  const type = document.getElementById('selectGeneralTxType').value;
  const amountInp = document.getElementById('inputGeneralAmount');
  const noteInp = document.getElementById('inputGeneralNote');
  const amount = parseFloat(amountInp.value);
  const note = noteInp ? noteInp.value.trim() : '';

  if (!amount || amount <= 0) {
    showToast('يرجى إدخال مبلغ صحيح أكبر من صفر', 'warning');
    return;
  }

  if (type === 'withdraw') {
    const mainBal = vaults.main_safe || 0;
    if (amount > mainBal) {
      showToast(`رصيد الخزنة العمومية (${mainBal} ج) لا يكفي للسحب المطلوب!`, 'warning');
      return;
    }
    vaults.main_safe -= amount;

    const tx = {
      id: generateId(),
      timestamp: Date.now(),
      type: 'general_withdraw',
      title: 'سحب مالي (مصروفات إدارة)',
      from: 'الخزنة العمومية 🏦',
      to: 'مصروفات إدارة 📤',
      amount: amount,
      user: currentUser ? currentUser.username : 'مدير النظام',
      shiftNumber: currentShift.shiftNumber || 1,
      notes: note || 'سحب نقدي من الخزنة العمومية',
      refId: 'wth_' + Date.now()
    };
    moneyTransactions.unshift(tx);
  } else {
    // Deposit
    vaults.main_safe = (vaults.main_safe || 0) + amount;

    const tx = {
      id: generateId(),
      timestamp: Date.now(),
      type: 'general_deposit',
      title: 'إيداع مالي (توريد خارجي)',
      from: 'توريد خارجي 📥',
      to: 'الخزنة العمومية 🏦',
      amount: amount,
      user: currentUser ? currentUser.username : 'مدير النظام',
      shiftNumber: currentShift.shiftNumber || 1,
      notes: note || 'إيداع نقدي في الخزنة العمومية',
      refId: 'dep_' + Date.now()
    };
    moneyTransactions.unshift(tx);
  }

  saveVaults();
  saveMoneyTransactions();
  if (window.dbSyncVaults) window.dbSyncVaults(vaults);
  if (window.dbInsertTransaction) window.dbInsertTransaction(tx);

  const modal = document.getElementById('modalGeneralDeposit');
  if (modal) modal.classList.remove('show');

  playChime('confirm');
  showToast(`تم تسجيل حركة الخزنة العمومية بنجاح (${type === 'deposit' ? 'إيداع' : 'سحب'}) ✅`, 'success');
}

/**
 * Wires all events for Vaults, Shifts, and Money Flow Ledger
 */
function setupVaultsAndShifts() {
  // Quick Start Shift button in header
  const btnTopStart = document.getElementById('btnQuickStartShiftTop');
  if (btnTopStart) btnTopStart.addEventListener('click', openStartShiftModal);

  // Start Shift modal buttons
  const btnCancelStart = document.getElementById('btnCancelStartShift');
  const btnConfirmStart = document.getElementById('btnConfirmStartShift');

  if (btnCancelStart) {
    btnCancelStart.addEventListener('click', () => {
      const m = document.getElementById('modalStartShift');
      if (m) m.classList.remove('show');
    });
  }

  if (btnConfirmStart) btnConfirmStart.addEventListener('click', confirmStartShift);

  // Quick Close Shift buttons
  const btnTopClose = document.getElementById('btnQuickCloseShiftTop');
  const btnHeroClose = document.getElementById('btnHeroCloseShift');
  const btnDrawerClose = document.getElementById('btnDrawerCloseShift');
  const btnCancelClose = document.getElementById('btnCancelCloseShift');
  const btnConfirmClose = document.getElementById('btnConfirmCloseShift');

  if (btnTopClose) btnTopClose.addEventListener('click', openCloseShiftModal);

  if (btnHeroClose) {
    btnHeroClose.addEventListener('click', () => {
      if (currentShift && currentShift.status === 'active') {
        openCloseShiftModal();
      } else {
        openStartShiftModal();
      }
    });
  }

  if (btnDrawerClose) {
    btnDrawerClose.addEventListener('click', () => {
      if (currentShift && currentShift.status === 'active') {
        openCloseShiftModal();
      } else {
        openStartShiftModal();
      }
    });
  }

  if (btnCancelClose) {
    btnCancelClose.addEventListener('click', () => {
      cleanupAllShiftCameraStreams();
      const m = document.getElementById('modalCloseShift');
      if (m) m.classList.remove('show');
    });
  }

  if (btnConfirmClose) btnConfirmClose.addEventListener('click', confirmCloseShift);

  // Close shift modal backdrop click cleanup
  const modalCloseShiftEl = document.getElementById('modalCloseShift');
  if (modalCloseShiftEl) {
    modalCloseShiftEl.addEventListener('click', (e) => {
      if (e.target === modalCloseShiftEl) {
        cleanupAllShiftCameraStreams();
        modalCloseShiftEl.classList.remove('show');
      }
    });
  }

  // Camera Video Recording Controls: Slot 1 (Video 1)
  const btnStartRec1 = document.getElementById('btnStartRecVideo1');
  const btnStopRec1 = document.getElementById('btnStopRecVideo1');
  const btnRerec1 = document.getElementById('btnRerecVideo1');
  if (btnStartRec1) btnStartRec1.addEventListener('click', () => startShiftVideoRecording('video1'));
  if (btnStopRec1) btnStopRec1.addEventListener('click', () => stopShiftVideoRecording('video1'));
  if (btnRerec1) btnRerec1.addEventListener('click', () => resetShiftVideoSlot('video1'));

  // Camera Video Recording Controls: Slot 2 (Video 2)
  const btnStartRec2 = document.getElementById('btnStartRecVideo2');
  const btnStopRec2 = document.getElementById('btnStopRecVideo2');
  const btnRerec2 = document.getElementById('btnRerecVideo2');
  if (btnStartRec2) btnStartRec2.addEventListener('click', () => startShiftVideoRecording('video2'));
  if (btnStopRec2) btnStopRec2.addEventListener('click', () => stopShiftVideoRecording('video2'));
  if (btnRerec2) btnRerec2.addEventListener('click', () => resetShiftVideoSlot('video2'));

  // Video Review Modal Controls
  const btnCloseViewVideos = document.getElementById('btnCloseViewVideosModal');
  if (btnCloseViewVideos) btnCloseViewVideos.addEventListener('click', closeViewShiftVideosModal);

  const modalViewShiftVideosEl = document.getElementById('modalViewShiftVideos');
  if (modalViewShiftVideosEl) {
    modalViewShiftVideosEl.addEventListener('click', (e) => {
      if (e.target === modalViewShiftVideosEl) {
        closeViewShiftVideosModal();
      }
    });
  }

  // Shift Video Deletion Modal Controls
  const btnConfirmDelYes = document.getElementById('btnConfirmDeleteShiftVideosYes');
  const btnConfirmDelNo = document.getElementById('btnConfirmDeleteShiftVideosNo');
  const modalConfirmDel = document.getElementById('modalConfirmDeleteShiftVideos');
  const btnDeleteCurrentView = document.getElementById('btnDeleteCurrentViewVideos');

  if (btnConfirmDelYes) {
    btnConfirmDelYes.addEventListener('click', () => {
      if (pendingDeleteShiftId) {
        executeDeleteShiftVideos(pendingDeleteShiftId);
      }
    });
  }

  if (btnConfirmDelNo) {
    btnConfirmDelNo.addEventListener('click', () => {
      if (modalConfirmDel) modalConfirmDel.classList.remove('show');
      pendingDeleteShiftId = null;
    });
  }

  if (modalConfirmDel) {
    modalConfirmDel.addEventListener('click', (e) => {
      if (e.target === modalConfirmDel) {
        modalConfirmDel.classList.remove('show');
        pendingDeleteShiftId = null;
      }
    });
  }

  if (btnDeleteCurrentView) {
    btnDeleteCurrentView.addEventListener('click', () => {
      if (currentViewingShiftId) {
        promptDeleteShiftVideos(currentViewingShiftId);
      }
    });
  }

  // Sub Safe to Master Safe transfer buttons
  const btnOpenTrf = document.getElementById('btnOpenTransferModal');
  const btnCancelTrf = document.getElementById('btnCancelVaultTransfer');
  const btnConfirmTrf = document.getElementById('btnConfirmVaultTransfer');

  if (btnOpenTrf) btnOpenTrf.addEventListener('click', openTransferModal);

  if (btnCancelTrf) {
    btnCancelTrf.addEventListener('click', () => {
      const m = document.getElementById('modalTransferVaults');
      if (m) m.classList.remove('show');
    });
  }

  if (btnConfirmTrf) btnConfirmTrf.addEventListener('click', confirmVaultTransfer);

  // General Safe deposit / withdrawal buttons
  const btnOpenGen = document.getElementById('btnOpenGeneralDepositModal');
  const btnCancelGen = document.getElementById('btnCancelGeneralTx');
  const btnConfirmGen = document.getElementById('btnConfirmGeneralTx');

  if (btnOpenGen) btnOpenGen.addEventListener('click', openGeneralDepositModal);

  if (btnCancelGen) {
    btnCancelGen.addEventListener('click', () => {
      const m = document.getElementById('modalGeneralDeposit');
      if (m) m.classList.remove('show');
    });
  }

  if (btnConfirmGen) btnConfirmGen.addEventListener('click', confirmGeneralTx);

  // Filter tabs for Money Flow Ledger
  const filterBtns = document.querySelectorAll('#txFilterTabs .btn-filter');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMoneyFlowFilter = btn.dataset.txfilter || 'all';
      renderMoneyFlowTable();
    });
  });

  // Print button for Money Flow Ledger
  const btnPrintTx = document.getElementById('btnPrintMoneyFlow');
  if (btnPrintTx) {
    btnPrintTx.addEventListener('click', () => {
      window.print();
    });
  }

  // Clear Money Flow Table button
  const btnClearMoneyFlow = document.getElementById('btnClearMoneyFlowTable');
  if (btnClearMoneyFlow) {
    btnClearMoneyFlow.addEventListener('click', () => {
      if (moneyTransactions.length === 0) {
        showToast('جدول حركة الأموال فارغ بالفعل!', 'info');
        return;
      }
      openClearTableConfirmModal('money_flow');
    });
  }

  // Clear Shifts History Table button
  const btnClearShiftsHistory = document.getElementById('btnClearShiftsHistoryTable');
  if (btnClearShiftsHistory) {
    btnClearShiftsHistory.addEventListener('click', () => {
      if (shiftsHistory.length === 0) {
        showToast('سجل الورديات السابقة فارغ بالفعل!', 'info');
        return;
      }
      openClearTableConfirmModal('shifts_history');
    });
  }
}

/* ==========================================================================
   Comprehensive Reports Section (منظومة تقارير الأقسام الخمسة وحساب النسبة)
   ========================================================================== */

let reportFilterState = {
  dateFrom: '',
  dateTo: '',
  user: 'all',
  section: 'all',
  sortBy: 'section',
  preset: 'all',
  percentage: 10
};

/**
 * Consolidates all booking and quick sale records across all 5 sections
 */
function getAllReportRecords() {
  const records = [];

  // 1. Play Area & PS Bookings (Kids, Trampoline, PlayStation)
  const allBookings = [...activeBookings, ...archiveBookings];
  allBookings.forEach(b => {
    const sub = parseFloat(b.subtotal) || parseFloat(b.net) || 0;
    const disc = parseFloat(b.discount) || 0;
    const net = parseFloat(b.net) || (sub - disc) || 0;

    records.push({
      id: b.id,
      type: 'booking',
      section: b.section,
      device: b.device || null,
      count: b.count || 1,
      durationMinutes: b.durationMinutes,
      subtotal: sub,
      discount: disc,
      net: net,
      notes: b.notes || '',
      timestamp: b.startTime || b.checkedOutAt || Date.now(),
      user: b.user || 'مدير النظام'
    });
  });

  // 2. Quick Sales (Arcade, Art)
  quickSales.forEach(s => {
    const amt = parseFloat(s.amount) || 0;
    records.push({
      id: s.id,
      type: 'sale',
      section: s.section,
      device: null,
      count: 1,
      durationMinutes: null,
      subtotal: amt,
      discount: 0,
      net: amt,
      notes: s.note || '',
      timestamp: s.timestamp || Date.now(),
      user: s.user || 'مدير النظام'
    });
  });

  // Sort descending by timestamp
  records.sort((a, b) => b.timestamp - a.timestamp);
  return records;
}

/**
 * Populates User filter dropdown with all distinct users in system and history
 */
function populateReportUsersDropdown(records) {
  const select = document.getElementById('repFilterUser');
  if (!select) return;

  const currentVal = select.value || reportFilterState.user || 'all';
  const userSet = new Set();
  
  if (usersList && Array.isArray(usersList)) {
    usersList.forEach(u => userSet.add(u.username));
  }
  records.forEach(r => {
    if (r.user) userSet.add(r.user);
  });

  select.innerHTML = '<option value="all">الكل (جميع المستخدمين)</option>';
  userSet.forEach(userName => {
    const opt = document.createElement('option');
    opt.value = userName;
    opt.textContent = `👤 ${userName}`;
    if (userName === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

/**
 * Calculates metrics and renders the comprehensive Reports Section UI
 */
function renderReportsDashboard() {
  const allRecords = getAllReportRecords();
  populateReportUsersDropdown(allRecords);

  // Apply filters
  let filtered = allRecords;

  if (reportFilterState.dateFrom) {
    const startTs = new Date(reportFilterState.dateFrom + 'T00:00:00').getTime();
    if (!isNaN(startTs)) {
      filtered = filtered.filter(r => r.timestamp >= startTs);
    }
  }

  if (reportFilterState.dateTo) {
    const endTs = new Date(reportFilterState.dateTo + 'T23:59:59.999').getTime();
    if (!isNaN(endTs)) {
      filtered = filtered.filter(r => r.timestamp <= endTs);
    }
  }

  if (reportFilterState.user && reportFilterState.user !== 'all') {
    filtered = filtered.filter(r => r.user === reportFilterState.user);
  }

  if (reportFilterState.section && reportFilterState.section !== 'all') {
    filtered = filtered.filter(r => r.section === reportFilterState.section);
  }

  // Update Period Badge Text
  const periodBadge = document.getElementById('repPeriodDisplayBadge');
  if (periodBadge) {
    if (reportFilterState.dateFrom && reportFilterState.dateTo) {
      periodBadge.textContent = `${reportFilterState.dateFrom} إلى ${reportFilterState.dateTo}`;
    } else if (reportFilterState.dateFrom) {
      periodBadge.textContent = `من ${reportFilterState.dateFrom}`;
    } else if (reportFilterState.dateTo) {
      periodBadge.textContent = `حتى ${reportFilterState.dateTo}`;
    } else {
      periodBadge.textContent = 'كل الفترات';
    }
  }

  // Compute breakdown for all 5 sections
  const sectionsData = {
    kids: { count: 0, gross: 0, discount: 0, net: 0, title: 'كيدز اريا', icon: '🏰' },
    trampoline: { count: 0, gross: 0, discount: 0, net: 0, title: 'ترامبولين', icon: '🤸‍♂️' },
    playstation: { count: 0, gross: 0, discount: 0, net: 0, title: 'بلاستيشن', icon: '🎮' },
    arcade: { count: 0, gross: 0, discount: 0, net: 0, title: 'العاب الكترونية', icon: '🕹️' },
    art: { count: 0, gross: 0, discount: 0, net: 0, title: 'رسم وتلوين', icon: '🎨' }
  };

  filtered.forEach(r => {
    const sec = sectionsData[r.section];
    if (sec) {
      sec.count += (r.count || 1);
      sec.gross += (r.subtotal || 0);
      sec.discount += (r.discount || 0);
      sec.net += (r.net || 0);
    }
  });

  // Calculate Overall Grand Totals
  let grandGross = 0;
  let grandDiscount = 0;
  let grandNet = 0;

  Object.values(sectionsData).forEach(sec => {
    grandGross += sec.gross;
    grandDiscount += sec.discount;
    grandNet += sec.net;
  });

  grandGross = Math.round(grandGross * 100) / 100;
  grandDiscount = Math.round(grandDiscount * 100) / 100;
  grandNet = Math.round(grandNet * 100) / 100;

  // 1. Update 5 Section Metric Cards
  // Kids
  const elGrossKids = document.getElementById('repGrossKids');
  if (elGrossKids) elGrossKids.textContent = `${sectionsData.kids.gross.toLocaleString()} ج`;
  const elDiscKids = document.getElementById('repDiscountKids');
  if (elDiscKids) elDiscKids.textContent = `${sectionsData.kids.discount.toLocaleString()} ج`;
  const elNetKids = document.getElementById('repNetKids');
  if (elNetKids) elNetKids.textContent = `${sectionsData.kids.net.toLocaleString()} ج`;
  const elCountKids = document.getElementById('repCountKids');
  if (elCountKids) elCountKids.textContent = `${sectionsData.kids.count} حجز`;

  // Trampoline
  const elGrossTramp = document.getElementById('repGrossTrampoline');
  if (elGrossTramp) elGrossTramp.textContent = `${sectionsData.trampoline.gross.toLocaleString()} ج`;
  const elDiscTramp = document.getElementById('repDiscountTrampoline');
  if (elDiscTramp) elDiscTramp.textContent = `${sectionsData.trampoline.discount.toLocaleString()} ج`;
  const elNetTramp = document.getElementById('repNetTrampoline');
  if (elNetTramp) elNetTramp.textContent = `${sectionsData.trampoline.net.toLocaleString()} ج`;
  const elCountTramp = document.getElementById('repCountTrampoline');
  if (elCountTramp) elCountTramp.textContent = `${sectionsData.trampoline.count} حجز`;

  // PlayStation
  const elGrossPs = document.getElementById('repGrossPs');
  if (elGrossPs) elGrossPs.textContent = `${sectionsData.playstation.gross.toLocaleString()} ج`;
  const elDiscPs = document.getElementById('repDiscountPs');
  if (elDiscPs) elDiscPs.textContent = `${sectionsData.playstation.discount.toLocaleString()} ج`;
  const elNetPs = document.getElementById('repNetPs');
  if (elNetPs) elNetPs.textContent = `${sectionsData.playstation.net.toLocaleString()} ج`;
  const elCountPs = document.getElementById('repCountPs');
  if (elCountPs) elCountPs.textContent = `${sectionsData.playstation.count} جهاز`;

  // Arcade
  const elGrossArc = document.getElementById('repGrossArcade');
  if (elGrossArc) elGrossArc.textContent = `${sectionsData.arcade.gross.toLocaleString()} ج`;
  const elDiscArc = document.getElementById('repDiscountArcade');
  if (elDiscArc) elDiscArc.textContent = `${sectionsData.arcade.discount.toLocaleString()} ج`;
  const elNetArc = document.getElementById('repNetArcade');
  if (elNetArc) elNetArc.textContent = `${sectionsData.arcade.net.toLocaleString()} ج`;
  const elCountArc = document.getElementById('repCountArcade');
  if (elCountArc) elCountArc.textContent = `${sectionsData.arcade.count} عملية`;

  // Art
  const elGrossArt = document.getElementById('repGrossArt');
  if (elGrossArt) elGrossArt.textContent = `${sectionsData.art.gross.toLocaleString()} ج`;
  const elDiscArt = document.getElementById('repDiscountArt');
  if (elDiscArt) elDiscArt.textContent = `${sectionsData.art.discount.toLocaleString()} ج`;
  const elNetArt = document.getElementById('repNetArt');
  if (elNetArt) elNetArt.textContent = `${sectionsData.art.net.toLocaleString()} ج`;
  const elCountArt = document.getElementById('repCountArt');
  if (elCountArt) elCountArt.textContent = `${sectionsData.art.count} عملية`;

  // 2. Render 5 Sections Summary Comparison Table
  const tbodySections = document.getElementById('tbodyReportSections');
  if (tbodySections) {
    const secKeys = ['kids', 'trampoline', 'playstation', 'arcade', 'art'];
    tbodySections.innerHTML = secKeys.map((k, i) => {
      const s = sectionsData[k];
      const sharePct = grandNet > 0 ? ((s.net / grandNet) * 100).toFixed(1) : '0';
      return `
        <tr>
          <td><strong>${i + 1}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">${s.icon}</span>
              <strong>${s.title}</strong>
            </div>
          </td>
          <td><strong>${s.count}</strong></td>
          <td><strong style="color: #cbd5e1;">${s.gross.toLocaleString()} ج</strong></td>
          <td><strong style="color: #f87171;">${s.discount.toLocaleString()} ج</strong></td>
          <td><strong style="color: #34d399; font-size: 1.05rem;">${s.net.toLocaleString()} ج</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="flex: 1; background: rgba(255,255,255,0.08); height: 6px; border-radius: 4px; overflow: hidden; min-width: 50px;">
                <div style="width: ${sharePct}%; background: var(--teal); height: 100%;"></div>
              </div>
              <span style="font-weight: 800; font-size: 0.85rem; color: var(--teal);">${sharePct}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 3. Update Bottom Grand Totals
  const elTotalGross = document.getElementById('repTotalGross');
  if (elTotalGross) elTotalGross.textContent = `${grandGross.toLocaleString()} ج`;

  const elTotalDiscount = document.getElementById('repTotalDiscount');
  if (elTotalDiscount) elTotalDiscount.textContent = `${grandDiscount.toLocaleString()} ج`;

  const elTotalNet = document.getElementById('repTotalNet');
  if (elTotalNet) elTotalNet.textContent = `${grandNet.toLocaleString()} ج`;

  // 4. Update Custom Percentage Calculation
  updatePercentageCalculation(grandNet);

  // 5. Render Detailed Audit Log Table
  renderReportDetailsTable(filtered);
}

/**
 * Calculates custom percentage share & remaining balance
 */
function updatePercentageCalculation(totalNet) {
  if (totalNet === undefined) {
    const elNet = document.getElementById('repTotalNet');
    if (elNet) {
      totalNet = parseFloat(elNet.textContent.replace(/[^0-9.-]+/g, '')) || 0;
    } else {
      totalNet = 0;
    }
  }

  const pctInput = document.getElementById('repPercentageInput');
  const pctRate = pctInput ? (parseFloat(pctInput.value) || 0) : (reportFilterState.percentage || 10);
  reportFilterState.percentage = pctRate;

  const calculatedShare = Math.round((totalNet * (pctRate / 100)) * 100) / 100;
  const remainingAmount = Math.round((totalNet - calculatedShare) * 100) / 100;

  const echoEl = document.getElementById('repPctEcho');
  if (echoEl) echoEl.textContent = `${pctRate}%`;

  const shareValEl = document.getElementById('repCalculatedShare');
  if (shareValEl) shareValEl.textContent = `${calculatedShare.toLocaleString()} ج`;

  const shareFormulaEl = document.getElementById('repShareFormula');
  if (shareFormulaEl) {
    shareFormulaEl.textContent = `${totalNet.toLocaleString()} ج × ${pctRate}% = ${calculatedShare.toLocaleString()} ج`;
  }

  const remValEl = document.getElementById('repRemainingAmount');
  if (remValEl) remValEl.textContent = `${remainingAmount.toLocaleString()} ج`;

  const remFormulaEl = document.getElementById('repRemainingFormula');
  if (remFormulaEl) {
    remFormulaEl.textContent = `${totalNet.toLocaleString()} ج - ${calculatedShare.toLocaleString()} ج = ${remainingAmount.toLocaleString()} ج`;
  }
}

/**
 * Renders the itemized audit table of records with section-based grouping & custom sort order
 */
function renderReportDetailsTable(records) {
  const tbody = document.getElementById('tbodyReportDetails');
  const emptyState = document.getElementById('emptyReportDetails');
  const countBadge = document.getElementById('repDetailCountBadge');

  if (!tbody) return;

  if (countBadge) countBadge.textContent = `${records.length} حركة`;

  if (records.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const sectionMeta = {
    kids: { text: '🏰 كيدز اريا', title: 'قسم كيدز اريا', icon: '🏰', class: 'tx-badge-sale' },
    trampoline: { text: '🤸‍♂️ ترامبولين', title: 'قسم ترامبولين', icon: '🤸‍♂️', class: 'tx-badge-shift' },
    playstation: { text: '🎮 بلاستيشن', title: 'قسم بلاستيشن', icon: '🎮', class: 'tx-badge-transfer' },
    arcade: { text: '🕹️ ألعاب إلكترونية', title: 'قسم الألعاب الإلكترونية', icon: '🕹️', class: 'tx-badge-deposit' },
    art: { text: '🎨 رسم وتلوين', title: 'قسم الرسم والتلوين', icon: '🎨', class: 'tx-badge-withdraw' }
  };

  const sortBy = reportFilterState.sortBy || 'section';

  if (sortBy === 'section') {
    // Group records by section in defined canonical order: kids -> trampoline -> playstation -> arcade -> art
    const sectionOrder = ['kids', 'trampoline', 'playstation', 'arcade', 'art'];
    const groups = {};
    sectionOrder.forEach(secKey => { groups[secKey] = []; });

    records.forEach(r => {
      if (!groups[r.section]) groups[r.section] = [];
      groups[r.section].push(r);
    });

    let html = '';
    let globalRowIndex = 1;

    sectionOrder.forEach(secKey => {
      const secRecords = groups[secKey];
      if (!secRecords || secRecords.length === 0) return;

      // Sort items within this section by timestamp descending (newest first)
      secRecords.sort((a, b) => b.timestamp - a.timestamp);

      const meta = sectionMeta[secKey] || { text: secKey, title: secKey, icon: '🏢', class: 'tx-badge-sale' };
      const secGross = secRecords.reduce((sum, r) => sum + (r.subtotal || 0), 0);
      const secDiscount = secRecords.reduce((sum, r) => sum + (r.discount || 0), 0);
      const secNet = secRecords.reduce((sum, r) => sum + (r.net || 0), 0);

      // Distinctive Section Group Header Divider
      html += `
        <tr class="report-section-header-row sec-${secKey}">
          <td colspan="9">
            <div class="sec-header-bar">
              <div class="sec-header-right">
                <span class="sec-header-icon">${meta.icon}</span>
                <span class="sec-header-name">${meta.title}</span>
                <span class="sec-header-badge">${secRecords.length} عملية</span>
              </div>
              <div class="sec-header-left">
                <span>إجمالي المبلغ: <strong style="color: #cbd5e1;">${secGross.toLocaleString()} ج</strong></span>
                <span style="margin: 0 6px; opacity: 0.4;">|</span>
                <span>الخصومات: <strong style="color: #f87171;">${secDiscount.toLocaleString()} ج</strong></span>
                <span style="margin: 0 6px; opacity: 0.4;">|</span>
                <span>صافي القسم: <strong style="color: #34d399; font-size: 0.95rem;">${secNet.toLocaleString()} ج</strong></span>
              </div>
            </div>
          </td>
        </tr>
      `;

      // Render records for this section
      secRecords.forEach((r) => {
        const dObj = new Date(r.timestamp);
        const dateStr = formatDate(dObj);
        const timeStr = formatTime(dObj);

        html += `
          <tr>
            <td><strong>#${globalRowIndex++}</strong></td>
            <td>
              <div style="font-size: 0.85rem; font-weight: 700;">${timeStr}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">${dateStr}</div>
            </td>
            <td><span class="tx-badge ${meta.class}">${meta.text}</span></td>
            <td><strong style="color: var(--teal); font-size: 0.85rem;">${r.id}</strong></td>
            <td><span class="tx-vault-pill">👤 ${r.user || 'مدير'}</span></td>
            <td><strong style="color: #cbd5e1;">${r.subtotal.toLocaleString()} ج</strong></td>
            <td><span style="color: ${r.discount > 0 ? '#f87171' : '#64748b'}; font-weight: 700;">${r.discount > 0 ? '-' + r.discount.toLocaleString() + ' ج' : '0 ج'}</span></td>
            <td><strong style="color: #34d399; font-size: 1.02rem;">${r.net.toLocaleString()} ج</strong></td>
            <td style="max-width: 200px; font-size: 0.82rem; color: #94a3b8;">${r.notes || '-'}</td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = html;
  } else {
    // Non-section flat sort (date-desc, date-asc, net-desc)
    const sorted = [...records];
    if (sortBy === 'date-desc') {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortBy === 'date-asc') {
      sorted.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === 'net-desc') {
      sorted.sort((a, b) => b.net - a.net);
    }

    tbody.innerHTML = sorted.map((r, idx) => {
      const dObj = new Date(r.timestamp);
      const dateStr = formatDate(dObj);
      const timeStr = formatTime(dObj);
      const meta = sectionMeta[r.section] || { text: r.section, class: 'tx-badge-sale' };

      return `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td>
            <div style="font-size: 0.85rem; font-weight: 700;">${timeStr}</div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">${dateStr}</div>
          </td>
          <td><span class="tx-badge ${meta.class}">${meta.text}</span></td>
          <td><strong style="color: var(--teal); font-size: 0.85rem;">${r.id}</strong></td>
          <td><span class="tx-vault-pill">👤 ${r.user || 'مدير'}</span></td>
          <td><strong style="color: #cbd5e1;">${r.subtotal.toLocaleString()} ج</strong></td>
          <td><span style="color: ${r.discount > 0 ? '#f87171' : '#64748b'}; font-weight: 700;">${r.discount > 0 ? '-' + r.discount.toLocaleString() + ' ج' : '0 ج'}</span></td>
          <td><strong style="color: #34d399; font-size: 1.02rem;">${r.net.toLocaleString()} ج</strong></td>
          <td style="max-width: 200px; font-size: 0.82rem; color: #94a3b8;">${r.notes || '-'}</td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * Initializes and wires events for the Reports Section
 */
function setupReportsSection() {
  const btnApply = document.getElementById('btnRepApplyFilter');
  const btnReset = document.getElementById('btnRepResetFilter');
  const btnPrint = document.getElementById('btnRepPrint');
  const pctInput = document.getElementById('repPercentageInput');
  const dateFrom = document.getElementById('repFilterDateFrom');
  const dateTo = document.getElementById('repFilterDateTo');
  const userSelect = document.getElementById('repFilterUser');
  const secSelect = document.getElementById('repFilterSection');
  const sortSelect = document.getElementById('repSortOrder');
  const btnCalFrom = document.getElementById('btnOpenCalFrom');
  const btnCalTo = document.getElementById('btnOpenCalTo');

  // Helper to open the native calendar picker popup
  const openCalendar = (inputEl) => {
    if (!inputEl) return;
    try {
      if (typeof inputEl.showPicker === 'function') {
        inputEl.showPicker();
      } else {
        inputEl.focus();
      }
    } catch (err) {
      inputEl.focus();
    }
  };

  // Calendar open events for Date From
  if (dateFrom) {
    dateFrom.addEventListener('click', () => openCalendar(dateFrom));
    dateFrom.addEventListener('focus', () => {
      try {
        if (typeof dateFrom.showPicker === 'function') dateFrom.showPicker();
      } catch (e) {}
    });
    dateFrom.addEventListener('change', () => {
      reportFilterState.dateFrom = dateFrom.value;
      reportFilterState.preset = 'custom';
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      renderReportsDashboard();
    });
  }

  // Calendar open events for Date To
  if (dateTo) {
    dateTo.addEventListener('click', () => openCalendar(dateTo));
    dateTo.addEventListener('focus', () => {
      try {
        if (typeof dateTo.showPicker === 'function') dateTo.showPicker();
      } catch (e) {}
    });
    dateTo.addEventListener('change', () => {
      reportFilterState.dateTo = dateTo.value;
      reportFilterState.preset = 'custom';
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      renderReportsDashboard();
    });
  }

  // Section Filter Change
  if (secSelect) {
    secSelect.addEventListener('change', () => {
      reportFilterState.section = secSelect.value;
      renderReportsDashboard();
    });
  }

  // Sort Order Change
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      reportFilterState.sortBy = sortSelect.value;
      renderReportsDashboard();
    });
  }

  // Calendar icon buttons click triggers
  if (btnCalFrom) {
    btnCalFrom.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCalendar(dateFrom);
    });
  }

  if (btnCalTo) {
    btnCalTo.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCalendar(dateTo);
    });
  }

  // Also support clicking date-picker-wrapper container
  document.querySelectorAll('.date-picker-wrapper').forEach(wrapper => {
    wrapper.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && !e.target.closest('.btn-open-cal')) {
        const inp = wrapper.querySelector('input[type="date"]');
        if (inp) openCalendar(inp);
      }
    });
  });

  // Apply Filter
  if (btnApply) {
    btnApply.addEventListener('click', () => {
      reportFilterState.dateFrom = dateFrom ? dateFrom.value : '';
      reportFilterState.dateTo = dateTo ? dateTo.value : '';
      reportFilterState.user = userSelect ? userSelect.value : 'all';
      reportFilterState.section = secSelect ? secSelect.value : 'all';
      if (sortSelect) reportFilterState.sortBy = sortSelect.value;
      renderReportsDashboard();
      showToast('تم تطبيق الفلتر وتحديث الإحصائيات 🔍', 'info');
    });
  }

  // Reset Filter
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (userSelect) userSelect.value = 'all';
      if (secSelect) secSelect.value = 'all';
      if (sortSelect) sortSelect.value = 'section';

      reportFilterState.dateFrom = '';
      reportFilterState.dateTo = '';
      reportFilterState.user = 'all';
      reportFilterState.section = 'all';
      reportFilterState.sortBy = 'section';
      reportFilterState.preset = 'all';

      // Update preset active button
      document.querySelectorAll('.btn-preset').forEach(b => {
        b.classList.toggle('active', b.dataset.preset === 'all');
      });

      renderReportsDashboard();
      showToast('تم تفريغ الفلتر وعرض جميع البيانات 🔄', 'info');
    });
  }

  // Print Report
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  // Preset Buttons (كل الفترات، اليوم، الأسبوع السابق، الشهر الحالي، الشهر السابق، آخر 3 شهور، آخر 6 شهور)
  const presetBtns = document.querySelectorAll('.btn-preset');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.dataset.preset;
      reportFilterState.preset = preset;

      const now = new Date();
      const formatDateInput = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      if (preset === 'today') {
        const todayStr = formatDateInput(now);
        if (dateFrom) dateFrom.value = todayStr;
        if (dateTo) dateTo.value = todayStr;
        reportFilterState.dateFrom = todayStr;
        reportFilterState.dateTo = todayStr;
      } else if (preset === 'last-week') {
        // الأسبوع السابق: من السبت للجمعة للأسبوع الماضي
        const dayOfWeek = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
        const daysSinceSat = (dayOfWeek + 1) % 7;
        const thisWeekSat = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceSat);
        const prevWeekSat = new Date(thisWeekSat.getFullYear(), thisWeekSat.getMonth(), thisWeekSat.getDate() - 7);
        const prevWeekFri = new Date(prevWeekSat.getFullYear(), prevWeekSat.getMonth(), prevWeekSat.getDate() + 6);

        const fromStr = formatDateInput(prevWeekSat);
        const toStr = formatDateInput(prevWeekFri);
        if (dateFrom) dateFrom.value = fromStr;
        if (dateTo) dateTo.value = toStr;
        reportFilterState.dateFrom = fromStr;
        reportFilterState.dateTo = toStr;
      } else if (preset === 'current-month' || preset === 'month') {
        // الشهر الحالي: من أول يوم في الشهر حتى اليوم
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const fromStr = formatDateInput(monthStart);
        const toStr = formatDateInput(now);
        if (dateFrom) dateFrom.value = fromStr;
        if (dateTo) dateTo.value = toStr;
        reportFilterState.dateFrom = fromStr;
        reportFilterState.dateTo = toStr;
      } else if (preset === 'last-month') {
        // الشهر السابق: من أول يوم في الشهر السابق إلى آخر يوم فيه
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const fromStr = formatDateInput(prevMonthStart);
        const toStr = formatDateInput(prevMonthEnd);
        if (dateFrom) dateFrom.value = fromStr;
        if (dateTo) dateTo.value = toStr;
        reportFilterState.dateFrom = fromStr;
        reportFilterState.dateTo = toStr;
      } else if (preset === 'last-3-months') {
        // آخر 3 شهور: من قبل 3 شهور حتى اليوم
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const fromStr = formatDateInput(threeMonthsAgo);
        const toStr = formatDateInput(now);
        if (dateFrom) dateFrom.value = fromStr;
        if (dateTo) dateTo.value = toStr;
        reportFilterState.dateFrom = fromStr;
        reportFilterState.dateTo = toStr;
      } else if (preset === 'last-6-months') {
        // آخر 6 شهور: من قبل 6 شهور حتى اليوم
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const fromStr = formatDateInput(sixMonthsAgo);
        const toStr = formatDateInput(now);
        if (dateFrom) dateFrom.value = fromStr;
        if (dateTo) dateTo.value = toStr;
        reportFilterState.dateFrom = fromStr;
        reportFilterState.dateTo = toStr;
      } else if (preset === 'yesterday') {
        const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yestStr = formatDateInput(yest);
        if (dateFrom) dateFrom.value = yestStr;
        if (dateTo) dateTo.value = yestStr;
        reportFilterState.dateFrom = yestStr;
        reportFilterState.dateTo = yestStr;
      } else if (preset === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fromStr = formatDateInput(weekAgo);
        const toStr = formatDateInput(now);
        if (dateFrom) dateFrom.value = fromStr;
        if (dateTo) dateTo.value = toStr;
        reportFilterState.dateFrom = fromStr;
        reportFilterState.dateTo = toStr;
      } else {
        // all (كل الفترات)
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        reportFilterState.dateFrom = '';
        reportFilterState.dateTo = '';
      }

      renderReportsDashboard();
    });
  });

  // Custom Percentage Input
  if (pctInput) {
    pctInput.addEventListener('input', () => {
      const val = parseFloat(pctInput.value) || 0;
      reportFilterState.percentage = val;

      // Update active chip state
      document.querySelectorAll('.btn-pct-chip').forEach(chip => {
        chip.classList.toggle('active', parseFloat(chip.dataset.pct) === val);
      });

      updatePercentageCalculation();
    });
  }

  // Percentage Quick Chips
  const chipBtns = document.querySelectorAll('.btn-pct-chip');
  chipBtns.forEach(chip => {
    chip.addEventListener('click', () => {
      chipBtns.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const pct = parseFloat(chip.dataset.pct) || 10;
      if (pctInput) pctInput.value = pct;
      reportFilterState.percentage = pct;

      updatePercentageCalculation();
    });
  });
}

/* ==========================================================================
   Refunds Operations Section Logic (منطق قسم عمليات الاسترجاع)
   ========================================================================== */
function setupRefundsSection() {
  // Preset buttons
  const presetBtns = document.querySelectorAll('#refundDatePresets .btn-filter-preset');
  const dateFromInput = document.getElementById('refundDateFrom');
  const dateToInput = document.getElementById('refundDateTo');

  const formatDateInput = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refundFilterState.preset = btn.dataset.preset;

      const today = new Date();

      if (refundFilterState.preset === 'today') {
        const str = formatDateInput(today);
        if (dateFromInput) dateFromInput.value = str;
        if (dateToInput) dateToInput.value = str;
        refundFilterState.dateFrom = str;
        refundFilterState.dateTo = str;
      } else if (refundFilterState.preset === 'yesterday') {
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        const str = formatDateInput(yest);
        if (dateFromInput) dateFromInput.value = str;
        if (dateToInput) dateToInput.value = str;
        refundFilterState.dateFrom = str;
        refundFilterState.dateTo = str;
      } else if (refundFilterState.preset === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 6);
        const fromStr = formatDateInput(weekAgo);
        const toStr = formatDateInput(today);
        if (dateFromInput) dateFromInput.value = fromStr;
        if (dateToInput) dateToInput.value = toStr;
        refundFilterState.dateFrom = fromStr;
        refundFilterState.dateTo = toStr;
      } else if (refundFilterState.preset === 'month') {
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const fromStr = formatDateInput(firstOfMonth);
        const toStr = formatDateInput(today);
        if (dateFromInput) dateFromInput.value = fromStr;
        if (dateToInput) dateToInput.value = toStr;
        refundFilterState.dateFrom = fromStr;
        refundFilterState.dateTo = toStr;
      } else {
        // all
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        refundFilterState.dateFrom = '';
        refundFilterState.dateTo = '';
      }

      renderRefundsTable();
    });
  });

  // Date Inputs
  if (dateFromInput) {
    dateFromInput.addEventListener('change', () => {
      refundFilterState.dateFrom = dateFromInput.value;
      presetBtns.forEach(b => b.classList.remove('active'));
      refundFilterState.preset = 'custom';
      renderRefundsTable();
    });
  }

  if (dateToInput) {
    dateToInput.addEventListener('change', () => {
      refundFilterState.dateTo = dateToInput.value;
      presetBtns.forEach(b => b.classList.remove('active'));
      refundFilterState.preset = 'custom';
      renderRefundsTable();
    });
  }

  // Section dropdown
  const secSelect = document.getElementById('refundFilterSection');
  if (secSelect) {
    secSelect.addEventListener('change', () => {
      refundFilterState.section = secSelect.value;
      renderRefundsTable();
    });
  }

  // Search input
  const searchInput = document.getElementById('refundSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      refundFilterState.search = searchInput.value.trim().toLowerCase();
      renderRefundsTable();
    });
  }

  // Reset button
  const btnReset = document.getElementById('btnResetRefundFilters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      refundFilterState = {
        preset: 'all',
        dateFrom: '',
        dateTo: '',
        section: 'all',
        search: ''
      };
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      if (secSelect) secSelect.value = 'all';
      if (searchInput) searchInput.value = '';
      presetBtns.forEach(b => {
        if (b.dataset.preset === 'all') b.classList.add('active');
        else b.classList.remove('active');
      });
      renderRefundsTable();
      showToast('تمت إعادة ضبط فلاتر الاسترجاع', 'info');
    });
  }

  // Print button
  const btnPrint = document.getElementById('btnPrintRefunds');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }
}

/**
 * Calculates KPIs, applies filters, and renders the Refunds review table
 */
function renderRefundsTable() {
  const tbody = document.getElementById('tbodyRefunds');
  const empty = document.getElementById('emptyRefunds');
  const badge = document.getElementById('refundsTableBadge');
  const filterHint = document.getElementById('refundFilterSummaryHint');

  // 1. Calculate overall & today / shift KPIs across all refunds
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const currentShiftNum = currentShift ? currentShift.shiftNumber : 1;

  let todayAmount = 0;
  let todayCount = 0;
  let shiftAmount = 0;
  let shiftCount = 0;

  refundsList.forEach(r => {
    if (r.timestamp >= startOfToday) {
      todayAmount += (r.amount || 0);
      todayCount++;
    }
    if (r.shiftNumber === currentShiftNum) {
      shiftAmount += (r.amount || 0);
      shiftCount++;
    }
  });

  const kpiTodayAmtEl = document.getElementById('kpiRefundTodayAmount');
  if (kpiTodayAmtEl) kpiTodayAmtEl.textContent = `${todayAmount.toLocaleString()} ج`;
  const kpiTodayCntEl = document.getElementById('kpiRefundTodayCount');
  if (kpiTodayCntEl) kpiTodayCntEl.textContent = `${todayCount} عملية اليوم`;

  const kpiShiftAmtEl = document.getElementById('kpiRefundShiftAmount');
  if (kpiShiftAmtEl) kpiShiftAmtEl.textContent = `${shiftAmount.toLocaleString()} ج`;
  const kpiShiftCntEl = document.getElementById('kpiRefundShiftCount');
  if (kpiShiftCntEl) kpiShiftCntEl.textContent = `${shiftCount} عملية في الوردية`;

  // 2. Filter list according to refundFilterState
  let filtered = [...refundsList];

  if (refundFilterState.dateFrom) {
    const fromTs = new Date(refundFilterState.dateFrom + 'T00:00:00').getTime();
    if (!isNaN(fromTs)) {
      filtered = filtered.filter(r => r.timestamp >= fromTs);
    }
  }

  if (refundFilterState.dateTo) {
    const toTs = new Date(refundFilterState.dateTo + 'T23:59:59.999').getTime();
    if (!isNaN(toTs)) {
      filtered = filtered.filter(r => r.timestamp <= toTs);
    }
  }

  if (refundFilterState.section && refundFilterState.section !== 'all') {
    filtered = filtered.filter(r => r.section === refundFilterState.section);
  }

  if (refundFilterState.search) {
    const q = refundFilterState.search;
    filtered = filtered.filter(r => {
      const matchId = (r.refId || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q);
      const matchUser = (r.user || '').toLowerCase().includes(q);
      const matchReason = (r.refundReason || '').toLowerCase().includes(q);
      const matchNotes = (r.notes || '').toLowerCase().includes(q);
      const matchDetails = (r.details || '').toLowerCase().includes(q);
      return matchId || matchUser || matchReason || matchNotes || matchDetails;
    });
  }

  // 3. Update Period KPIs (Total Amount and Count for filtered view)
  const filteredTotalAmt = filtered.reduce((sum, r) => sum + (r.amount || 0), 0);
  const kpiTotalAmtEl = document.getElementById('kpiRefundTotalAmount');
  if (kpiTotalAmtEl) kpiTotalAmtEl.textContent = `${filteredTotalAmt.toLocaleString()} ج`;
  const kpiTotalCntEl = document.getElementById('kpiRefundTotalCount');
  if (kpiTotalCntEl) kpiTotalCntEl.textContent = filtered.length;

  const kpiPeriodSubtext = document.getElementById('kpiRefundPeriodSubtext');
  if (kpiPeriodSubtext) {
    if (refundFilterState.dateFrom && refundFilterState.dateTo) {
      kpiPeriodSubtext.textContent = `${refundFilterState.dateFrom} إلى ${refundFilterState.dateTo}`;
    } else if (refundFilterState.dateFrom) {
      kpiPeriodSubtext.textContent = `من ${refundFilterState.dateFrom}`;
    } else if (refundFilterState.dateTo) {
      kpiPeriodSubtext.textContent = `حتى ${refundFilterState.dateTo}`;
    } else {
      kpiPeriodSubtext.textContent = 'كل الفترات';
    }
  }

  if (badge) badge.textContent = `${filtered.length} عملية`;
  if (filterHint) {
    filterHint.textContent = (filtered.length === refundsList.length) ? 'عرض كافة العمليات المستردة' : `عرض ${filtered.length} من أصل ${refundsList.length} عملية`;
  }

  // 4. Update badge in Navbar
  const navBadge = document.getElementById('badgeRefunds');
  if (navBadge) {
    navBadge.textContent = refundsList.length;
  }

  // 5. Render Table rows
  if (!tbody) return;
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  const sectionMeta = {
    kids: { text: '🏰 كيدز اريا', class: 'tx-badge-sale' },
    trampoline: { text: '🤸‍♂️ ترامبولين', class: 'tx-badge-shift' },
    playstation: { text: '🎮 بلاستيشن', class: 'tx-badge-transfer' },
    arcade: { text: '🕹️ ألعاب إلكترونية', class: 'tx-badge-deposit' },
    art: { text: '🎨 رسم وتلوين', class: 'tx-badge-withdraw' }
  };

  filtered.forEach((r, idx) => {
    const tr = document.createElement('tr');
    const dObj = new Date(r.timestamp);
    const dateStr = formatDate(dObj);
    const timeStr = formatTime(dObj);
    const meta = sectionMeta[r.section] || { text: r.sectionTitle || r.section, class: 'tx-badge-sale' };

    tr.innerHTML = `
      <td><strong>#${idx + 1}</strong></td>
      <td>
        <div style="font-weight: 700; font-size: 0.88rem;">${timeStr}</div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">${dateStr}</div>
      </td>
      <td><span class="tx-badge ${meta.class}">${meta.text}</span></td>
      <td><strong style="color: var(--teal); font-size: 0.95rem;">${r.refId || r.id}</strong></td>
      <td style="font-size: 0.88rem; font-weight: 600;">${r.details || '-'}</td>
      <td><strong class="refund-amount-tag">-${r.amount} ج</strong></td>
      <td><span class="refund-reason-pill" title="${r.refundReason}">${r.refundReason || 'طلب العميل'}</span></td>
      <td><span class="tx-vault-pill">👤 ${r.user || 'مدير النظام'}</span></td>
      <td><span class="badge-mini" style="background: rgba(255,255,255,0.08); color: #cbd5e1;">وردية #${r.shiftNumber || 1}</span></td>
      <td style="max-width: 180px; font-size: 0.82rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.notes || ''}">${r.notes || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==========================================================================
   Supabase Cloud Synchronization & Realtime Integration
   ========================================================================== */
async function initCloudSync() {
  console.log('🚀 [App] Starting Supabase Cloud Sync...');
  
  if (typeof checkSupabaseConnection !== 'function') {
    console.warn('⚠️ [App] checkSupabaseConnection function is missing.');
    return;
  }

  const connected = await checkSupabaseConnection();
  if (!connected) {
    console.log('ℹ️ [App] Running with LocalStorage. Cloud will retry when connection is available.');
    return;
  }

  try {
    if (typeof updateCloudStatusUI === 'function') {
      updateCloudStatusUI('loading', 'جاري المزامنة مع السحابة... ⏳');
    }

    const cloud = await fetchAllDataFromSupabase();

    if (cloud) {
      // 1. Settings
      if (cloud.appSettings) {
        appSettings = { ...appSettings, ...cloud.appSettings };
        localStorage.setItem(STORAGE_APP_SETTINGS, JSON.stringify(appSettings));
        applySettingsToUI();
        calculateKidsPrice();
        calculateTrampolinePrice();
        calculatePlaystationPrice();
      } else if (appSettings) {
        if (window.dbSyncAppSettings) window.dbSyncAppSettings(appSettings);
      }

      // 2. Users
      if (cloud.usersList && cloud.usersList.length > 0) {
        usersList = cloud.usersList;
        localStorage.setItem(STORAGE_USERS, JSON.stringify(usersList));
        renderAdminUsersTable();
        updateSwitchUserDropdown();
      } else if (usersList && usersList.length > 0) {
        usersList.forEach(u => {
          if (window.dbUpsertUser) window.dbUpsertUser(u);
        });
      }

      // 3. Vaults
      if (cloud.vaults) {
        vaults = {
          drawer: parseFloat(cloud.vaults.drawer) || 0,
          sub_safe: parseFloat(cloud.vaults.sub_safe) || 0,
          main_safe: parseFloat(cloud.vaults.main_safe) || 0
        };
        localStorage.setItem(STORAGE_VAULTS, JSON.stringify(vaults));
        renderVaultsUI();
      } else if (vaults) {
        if (window.dbSyncVaults) window.dbSyncVaults(vaults);
      }

      // 4. Shifts
      if (cloud.shifts && cloud.shifts.length > 0) {
        const activeS = cloud.shifts.find(s => s.status === 'active');
        if (activeS) {
          currentShift = {
            id: activeS.id,
            shiftNumber: parseInt(activeS.shift_number) || 1,
            openedBy: activeS.opened_by || 'مدير النظام',
            openedAt: new Date(activeS.opened_at).getTime(),
            totalRevenue: parseFloat(activeS.total_revenue) || 0,
            breakdown: activeS.breakdown || { kids: 0, trampoline: 0, arcade: 0, playstation: 0, art: 0 },
            status: 'active',
            startNotes: activeS.start_notes || ''
          };
          localStorage.setItem(STORAGE_CURRENT_SHIFT, JSON.stringify(currentShift));
        }

        const closedList = cloud.shifts.filter(s => s.status === 'closed');
        if (closedList.length > 0) {
          shiftsHistory = closedList.map(s => ({
            id: s.id,
            shiftNumber: parseInt(s.shift_number) || 1,
            openedBy: s.opened_by,
            closedBy: s.closed_by,
            openedAt: new Date(s.opened_at).getTime(),
            closedAt: s.closed_at ? new Date(s.closed_at).getTime() : Date.now(),
            totalRevenue: parseFloat(s.total_revenue) || 0,
            breakdown: s.breakdown || {},
            transferredAmount: parseFloat(s.transferred_amount) || 0,
            notes: s.close_notes || '',
            hasVideos: s.has_videos === true,
            video1Saved: s.video1_saved === true,
            video2Saved: s.video2_saved === true,
            videosDeleted: s.videos_deleted === true,
            videosDeletedAt: s.videos_deleted_at ? new Date(s.videos_deleted_at).getTime() : null
          }));
          localStorage.setItem(STORAGE_SHIFTS_HISTORY, JSON.stringify(shiftsHistory));
        }
      } else if (currentShift) {
        if (window.dbUpsertShift) window.dbUpsertShift(currentShift);
      }

      // 5. Bookings
      if (cloud.bookings && cloud.bookings.length > 0) {
        const active = [];
        const archive = [];
        cloud.bookings.forEach(b => {
          const item = {
            id: b.id,
            section: b.section,
            device: b.device || null,
            count: parseInt(b.count) || 1,
            durationMinutes: parseInt(b.duration_minutes) || 30,
            durationLabel: b.duration_label || '',
            subtotal: parseFloat(b.subtotal) || 0,
            discount: parseFloat(b.discount) || 0,
            net: parseFloat(b.net) || 0,
            notes: b.notes || '',
            startTime: new Date(b.start_time).getTime(),
            endTime: new Date(b.end_time).getTime(),
            checkedOutAt: b.checked_out_at ? new Date(b.checked_out_at).getTime() : null,
            status: b.status || 'active',
            hasAlertedWarning: false,
            hasAlertedEnded: false,
            user: b.created_by || 'مدير النظام'
          };
          if (b.status === 'checked_out') {
            archive.push(item);
          } else {
            active.push(item);
          }
        });
        activeBookings = active;
        archiveBookings = archive;
        localStorage.setItem(STORAGE_ACTIVE_BOOKINGS, JSON.stringify(activeBookings));
        localStorage.setItem(STORAGE_ARCHIVE_BOOKINGS, JSON.stringify(archiveBookings));
      } else {
        if (activeBookings && activeBookings.length > 0) {
          activeBookings.forEach(b => {
            if (window.dbUpsertBooking) window.dbUpsertBooking(b);
          });
        }
      }

      // 6. Quick Sales
      if (cloud.quickSales && cloud.quickSales.length > 0) {
        quickSales = cloud.quickSales.map(s => ({
          id: s.id,
          section: s.section,
          amount: parseFloat(s.amount) || 0,
          note: s.note || '',
          clearedFromTable: s.cleared_from_table === true,
          clearedAt: s.cleared_at ? new Date(s.cleared_at).getTime() : null,
          timestamp: new Date(s.created_at).getTime(),
          user: s.created_by || 'مدير النظام'
        }));
        localStorage.setItem(STORAGE_QUICK_SALES, JSON.stringify(quickSales));
      } else if (quickSales && quickSales.length > 0) {
        quickSales.forEach(s => {
          if (window.dbUpsertQuickSale) window.dbUpsertQuickSale(s);
        });
      }

      // 7. Money Transactions
      if (cloud.moneyTransactions && cloud.moneyTransactions.length > 0) {
        moneyTransactions = cloud.moneyTransactions.map(t => ({
          id: t.id,
          type: t.type,
          title: t.title,
          from: t.from_source,
          to: t.to_destination,
          amount: parseFloat(t.amount) || 0,
          user: t.user_name || 'مدير النظام',
          shiftNumber: parseInt(t.shift_number) || 1,
          notes: t.notes || '',
          refId: t.ref_id,
          hasVideos: t.has_videos === true,
          videosDeleted: t.videos_deleted === true,
          timestamp: new Date(t.created_at).getTime()
        }));
        localStorage.setItem(STORAGE_MONEY_TRANSACTIONS, JSON.stringify(moneyTransactions));
      } else if (moneyTransactions && moneyTransactions.length > 0) {
        moneyTransactions.forEach(t => {
          if (window.dbInsertTransaction) window.dbInsertTransaction(t);
        });
      }

      // 8. Refunds
      if (cloud.refunds && cloud.refunds.length > 0) {
        refundsList = cloud.refunds.map(r => ({
          id: r.id,
          refId: r.ref_id,
          section: r.section,
          sectionTitle: r.section_title,
          details: r.details,
          amount: parseFloat(r.amount) || 0,
          subtotal: parseFloat(r.subtotal) || 0,
          discount: parseFloat(r.discount) || 0,
          refundReason: r.refund_reason,
          timestamp: new Date(r.created_at).getTime(),
          bookingTime: r.booking_time ? new Date(r.booking_time).getTime() : Date.now(),
          user: r.user_name,
          shiftNumber: parseInt(r.shift_number) || 1,
          notes: r.notes || ''
        }));
        localStorage.setItem(STORAGE_REFUNDS, JSON.stringify(refundsList));
      } else if (refundsList && refundsList.length > 0) {
        refundsList.forEach(r => {
          if (window.dbInsertRefund) window.dbInsertRefund(r);
        });
      }

      // Refresh UI with latest cloud data
      renderAllTables();
      renderVaultsUI();
      renderMoneyFlowTable();
      renderShiftsHistoryTable();
      renderReportsDashboard();
      renderRefundsTable();
      updateSectionBadges();
      updateArchiveBadge();
    }

    if (typeof updateCloudStatusUI === 'function') {
      updateCloudStatusUI('online', 'متصل بالسحابة ☁️ (مباشر)');
    }

    // Start Realtime Live Channel Listener
    if (typeof setupSupabaseRealtime === 'function') {
      setupSupabaseRealtime(handleRealtimeEvent);
    }
  } catch (err) {
    console.error('initCloudSync error:', err);
    if (typeof updateCloudStatusUI === 'function') {
      updateCloudStatusUI('online', 'متصل بالسحابة ☁️');
    }
  }
}

/**
 * Handles Live Realtime Updates from other devices/tabs
 */
function handleRealtimeEvent(table, payload) {
  const { eventType, new: newRec, old: oldRec } = payload;

  if (table === 'bookings') {
    if (eventType === 'INSERT') {
      if (!activeBookings.some(b => b.id === newRec.id) && !archiveBookings.some(b => b.id === newRec.id)) {
        const item = {
          id: newRec.id,
          section: newRec.section,
          device: newRec.device || null,
          count: parseInt(newRec.count) || 1,
          durationMinutes: parseInt(newRec.duration_minutes) || 30,
          durationLabel: newRec.duration_label || '',
          subtotal: parseFloat(newRec.subtotal) || 0,
          discount: parseFloat(newRec.discount) || 0,
          net: parseFloat(newRec.net) || 0,
          notes: newRec.notes || '',
          startTime: new Date(newRec.start_time).getTime(),
          endTime: new Date(newRec.end_time).getTime(),
          checkedOutAt: newRec.checked_out_at ? new Date(newRec.checked_out_at).getTime() : null,
          status: newRec.status || 'active',
          user: newRec.created_by || 'مدير النظام'
        };
        if (item.status === 'checked_out') {
          archiveBookings.unshift(item);
        } else {
          activeBookings.unshift(item);
        }
        saveActiveBookings();
        saveArchiveBookings();
        renderAllTables();
        playBeep('success');
      }
    } else if (eventType === 'UPDATE') {
      const idx = activeBookings.findIndex(b => b.id === newRec.id);
      if (idx !== -1) {
        if (newRec.status === 'checked_out') {
          const [removed] = activeBookings.splice(idx, 1);
          removed.status = 'checked_out';
          removed.checkedOutAt = newRec.checked_out_at ? new Date(newRec.checked_out_at).getTime() : Date.now();
          archiveBookings.unshift(removed);
        } else {
          activeBookings[idx].status = newRec.status;
        }
        saveActiveBookings();
        saveArchiveBookings();
        renderAllTables();
      }
    } else if (eventType === 'DELETE') {
      activeBookings = activeBookings.filter(b => b.id !== oldRec.id);
      archiveBookings = archiveBookings.filter(b => b.id !== oldRec.id);
      saveActiveBookings();
      saveArchiveBookings();
      renderAllTables();
    }
  } else if (table === 'quick_sales') {
    if (eventType === 'INSERT') {
      if (!quickSales.some(s => s.id === newRec.id)) {
        quickSales.unshift({
          id: newRec.id,
          section: newRec.section,
          amount: parseFloat(newRec.amount) || 0,
          note: newRec.note || '',
          clearedFromTable: newRec.cleared_from_table === true,
          clearedAt: newRec.cleared_at ? new Date(newRec.cleared_at).getTime() : null,
          timestamp: new Date(newRec.created_at).getTime(),
          user: newRec.created_by || 'مدير النظام'
        });
        saveQuickSales();
        renderQuickSalesTables();
      }
    } else if (eventType === 'UPDATE') {
      const idx = quickSales.findIndex(s => s.id === newRec.id);
      if (idx !== -1) {
        quickSales[idx].clearedFromTable = newRec.cleared_from_table === true;
        quickSales[idx].clearedAt = newRec.cleared_at ? new Date(newRec.cleared_at).getTime() : null;
        saveQuickSales();
        renderQuickSalesTables();
      }
    } else if (eventType === 'DELETE') {
      quickSales = quickSales.filter(s => s.id !== oldRec.id);
      saveQuickSales();
      renderQuickSalesTables();
    }
  } else if (table === 'vaults') {
    if (newRec) {
      vaults = {
        drawer: parseFloat(newRec.drawer) || 0,
        sub_safe: parseFloat(newRec.sub_safe) || 0,
        main_safe: parseFloat(newRec.main_safe) || 0
      };
      localStorage.setItem(STORAGE_VAULTS, JSON.stringify(vaults));
      renderVaultsUI();
    }
  } else if (table === 'shifts') {
    if (newRec) {
      if (newRec.status === 'active') {
        currentShift = {
          id: newRec.id,
          shiftNumber: parseInt(newRec.shift_number) || 1,
          openedBy: newRec.opened_by || 'مدير النظام',
          openedAt: new Date(newRec.opened_at).getTime(),
          totalRevenue: parseFloat(newRec.total_revenue) || 0,
          breakdown: newRec.breakdown || { kids: 0, trampoline: 0, arcade: 0, playstation: 0, art: 0 },
          status: 'active',
          startNotes: newRec.start_notes || ''
        };
        localStorage.setItem(STORAGE_CURRENT_SHIFT, JSON.stringify(currentShift));
        renderVaultsUI();
      } else if (newRec.status === 'closed') {
        if (!shiftsHistory.some(s => s.id === newRec.id)) {
          shiftsHistory.unshift({
            id: newRec.id,
            shiftNumber: parseInt(newRec.shift_number) || 1,
            openedBy: newRec.opened_by,
            closedBy: newRec.closed_by,
            openedAt: new Date(newRec.opened_at).getTime(),
            closedAt: newRec.closed_at ? new Date(newRec.closed_at).getTime() : Date.now(),
            totalRevenue: parseFloat(newRec.total_revenue) || 0,
            breakdown: newRec.breakdown || {},
            transferredAmount: parseFloat(newRec.transferred_amount) || 0,
            notes: newRec.close_notes || '',
            hasVideos: newRec.has_videos === true,
            video1Saved: newRec.video1_saved === true,
            video2Saved: newRec.video2_saved === true,
            videosDeleted: newRec.videos_deleted === true,
            videosDeletedAt: newRec.videos_deleted_at ? new Date(newRec.videos_deleted_at).getTime() : null
          });
          localStorage.setItem(STORAGE_SHIFTS_HISTORY, JSON.stringify(shiftsHistory));
          renderShiftsHistoryTable();
        }
      }
    }
  } else if (table === 'money_transactions') {
    if (eventType === 'INSERT') {
      if (!moneyTransactions.some(t => t.id === newRec.id)) {
        moneyTransactions.unshift({
          id: newRec.id,
          type: newRec.type,
          title: newRec.title,
          from: newRec.from_source,
          to: newRec.to_destination,
          amount: parseFloat(newRec.amount) || 0,
          user: newRec.user_name || 'مدير النظام',
          shiftNumber: parseInt(newRec.shift_number) || 1,
          notes: newRec.notes || '',
          refId: newRec.ref_id,
          hasVideos: newRec.has_videos === true,
          videosDeleted: newRec.videos_deleted === true,
          timestamp: new Date(newRec.created_at).getTime()
        });
        localStorage.setItem(STORAGE_MONEY_TRANSACTIONS, JSON.stringify(moneyTransactions));
        renderMoneyFlowTable();
      }
    }
  } else if (table === 'refunds') {
    if (eventType === 'INSERT') {
      if (!refundsList.some(r => r.id === newRec.id)) {
        refundsList.unshift({
          id: newRec.id,
          refId: newRec.ref_id,
          section: newRec.section,
          sectionTitle: newRec.section_title,
          details: newRec.details,
          amount: parseFloat(newRec.amount) || 0,
          subtotal: parseFloat(newRec.subtotal) || 0,
          discount: parseFloat(newRec.discount) || 0,
          refundReason: newRec.refund_reason,
          timestamp: new Date(newRec.created_at).getTime(),
          bookingTime: newRec.booking_time ? new Date(newRec.booking_time).getTime() : Date.now(),
          user: newRec.user_name,
          shiftNumber: parseInt(newRec.shift_number) || 1,
          notes: newRec.notes || ''
        });
        localStorage.setItem(STORAGE_REFUNDS, JSON.stringify(refundsList));
        renderRefundsTable();
        updateSectionBadges();
      }
    }
  }
}



