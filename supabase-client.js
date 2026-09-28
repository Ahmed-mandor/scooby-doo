/**
 * ملاهي سكوبي دوو - نادي الشرطة
 * Supabase Database Client & Realtime Sync Engine (Production-Grade)
 */

const SUPABASE_CONFIG = {
  url: 'https://uzvrswtujofjmaraoqkp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6dnJzd3R1am9mam1hcmFvcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTU4ODYsImV4cCI6MjEwNjE5MTg4Nn0.KASLhXBuI6BjMmRX8OdNTZ5hcsDdNx7jNce7QMxS9rg'
};

// Global reference for Supabase Client Instance (avoid shadowing window.supabase)
window.sbClient = null;
let isCloudConnected = false;
let realtimeChannel = null;

/**
 * Returns or initializes the active Supabase client instance
 */
function getSupabaseClient() {
  if (window.sbClient) return window.sbClient;
  
  const sdk = window.supabase;
  if (sdk && typeof sdk.createClient === 'function') {
    try {
      window.sbClient = sdk.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      console.log('✅ [Supabase] Client initialized successfully.');
      return window.sbClient;
    } catch (e) {
      console.error('❌ [Supabase] Error creating client:', e);
      return null;
    }
  }
  return null;
}

/**
 * Updates UI badge for cloud connectivity
 */
function updateCloudStatusUI(status, message) {
  const badge = document.getElementById('cloudStatusBadge');
  const dot = document.getElementById('cloudStatusDot');
  const text = document.getElementById('cloudStatusText');

  if (!badge) return;

  if (status === 'online') {
    isCloudConnected = true;
    if (dot) dot.className = 'cloud-dot status-online';
    if (text) text.textContent = message || 'متصل بالسحابة ☁️';
    badge.title = 'قاعدة بيانات Supabase متصلة ومحدثة لحظياً (اضغط لإعادة الفحص)';
  } else if (status === 'offline') {
    isCloudConnected = false;
    if (dot) dot.className = 'cloud-dot status-offline';
    if (text) text.textContent = message || 'وضع محلي (أوفلاين) 💾';
    badge.title = 'تعذر الاتصال بالسحابة - يتم الحفظ محلياً بأمان (اضغط لإعادة المحاولة)';
  } else {
    isCloudConnected = false;
    if (dot) dot.className = 'cloud-dot status-loading';
    if (text) text.textContent = message || 'جاري الاتصال بالسحابة... ⏳';
    badge.title = 'جاري محاولة الاتصال بقاعدة البيانات السحابية';
  }
}

/**
 * Tests connection to Supabase and verifies tables (with auto-retry for slow CDN)
 */
async function checkSupabaseConnection() {
  // Wait up to 3 seconds for window.supabase SDK to load if not ready yet
  let sb = getSupabaseClient();
  if (!sb) {
    console.log('⏳ [Supabase] Waiting for Supabase SDK to load...');
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 200));
      sb = getSupabaseClient();
      if (sb) break;
    }
  }

  if (!sb) {
    console.warn('⚠️ [Supabase] Supabase SDK library not available on window.supabase.');
    updateCloudStatusUI('offline', 'المكتبة غير متوفرة 💾');
    return false;
  }

  try {
    console.log('🔍 [Supabase] Testing query on table "app_settings"...');
    const { data, error } = await sb
      .from('app_settings')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('⚠️ [Supabase] Connection test returned error:', error.message, error.code);
      if (error.code === '42P01') {
        updateCloudStatusUI('offline', 'يرجى تشغيل الـ Schema أولاً ⚠️');
      } else {
        updateCloudStatusUI('offline', 'تعذر الاتصال بالسحابة ⚠️');
      }
      return false;
    }

    console.log('🎉 [Supabase] Connected successfully! Found data:', data);
    updateCloudStatusUI('online', 'متصل بالسحابة ☁️ (مباشر)');
    return true;
  } catch (err) {
    console.error('❌ [Supabase] Connection exception:', err);
    updateCloudStatusUI('offline', 'وضع محلي (أوفلاين) 💾');
    return false;
  }
}

/* ==========================================================================
   Supabase Data Fetching & Sync Services
   ========================================================================== */

/**
 * Loads all initial datasets from Supabase Cloud
 */
async function fetchAllDataFromSupabase() {
  const sb = getSupabaseClient();
  if (!sb) return null;

  try {
    const [
      settingsRes,
      usersRes,
      vaultsRes,
      shiftsRes,
      bookingsRes,
      salesRes,
      txRes,
      refundsRes
    ] = await Promise.all([
      sb.from('app_settings').select('*').limit(1),
      sb.from('system_users').select('*'),
      sb.from('vaults').select('*').limit(1),
      sb.from('shifts').select('*').order('shift_number', { ascending: false }),
      sb.from('bookings').select('*').order('created_at', { ascending: false }),
      sb.from('quick_sales').select('*').order('created_at', { ascending: false }),
      sb.from('money_transactions').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('refunds').select('*').order('created_at', { ascending: false })
    ]);

    if (settingsRes.error) {
      console.warn('[Supabase] Could not fetch app_settings:', settingsRes.error.message);
      return null;
    }

    const cloudData = {
      appSettings: settingsRes.data && settingsRes.data[0] ? {
        kidsHourlyRate: parseFloat(settingsRes.data[0].kids_hourly_rate) || 50,
        psHourlyRate: parseFloat(settingsRes.data[0].ps_hourly_rate) || 50,
        trampolineGamePrice: parseFloat(settingsRes.data[0].trampoline_game_price) || 30,
        trampolineGameDuration: parseInt(settingsRes.data[0].trampoline_game_duration) || 10
      } : null,

      usersList: (usersRes.data && usersRes.data.length > 0) ? usersRes.data.map(u => ({
        id: u.id,
        username: u.username,
        password: u.password_hash,
        role: u.role,
        permissions: u.permissions || {}
      })) : null,

      vaults: vaultsRes.data && vaultsRes.data[0] ? {
        drawer: parseFloat(vaultsRes.data[0].drawer) || 0,
        sub_safe: parseFloat(vaultsRes.data[0].sub_safe) || 0,
        main_safe: parseFloat(vaultsRes.data[0].main_safe) || 0
      } : null,

      shifts: shiftsRes.data || [],
      bookings: bookingsRes.data || [],
      quickSales: salesRes.data || [],
      moneyTransactions: txRes.data || [],
      refunds: refundsRes.data || []
    };

    return cloudData;
  } catch (err) {
    console.error('Error fetching data from Supabase:', err);
    return null;
  }
}

/* ==========================================================================
   Supabase Data Mutation Handlers (Background Sync)
   ========================================================================== */

async function dbUpsertBooking(booking) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const payload = {
      id: booking.id,
      section: booking.section,
      device: booking.device || null,
      count: parseInt(booking.count) || 1,
      duration_minutes: parseInt(booking.durationMinutes) || 30,
      duration_label: booking.durationLabel || '',
      subtotal: parseFloat(booking.subtotal) || 0,
      discount: parseFloat(booking.discount) || 0,
      net: parseFloat(booking.net) || 0,
      notes: booking.notes || '',
      start_time: new Date(booking.startTime).toISOString(),
      end_time: new Date(booking.endTime).toISOString(),
      checked_out_at: booking.checkedOutAt ? new Date(booking.checkedOutAt).toISOString() : null,
      status: booking.status || 'active',
      shift_id: (window.currentShift && window.currentShift.id) ? window.currentShift.id : null,
      shift_number: (window.currentShift && window.currentShift.shiftNumber) ? window.currentShift.shiftNumber : 1,
      created_by: booking.user || 'مدير النظام'
    };
    await sb.from('bookings').upsert(payload);
  } catch (err) {
    console.warn('dbUpsertBooking error:', err);
  }
}

async function dbDeleteBooking(bookingId) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from('bookings').delete().eq('id', bookingId);
  } catch (err) {
    console.warn('dbDeleteBooking error:', err);
  }
}

async function dbUpsertQuickSale(sale) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const payload = {
      id: sale.id,
      section: sale.section,
      amount: parseFloat(sale.amount) || 0,
      note: sale.note || '',
      cleared_from_table: sale.clearedFromTable === true,
      cleared_at: sale.clearedAt ? new Date(sale.clearedAt).toISOString() : null,
      shift_id: (window.currentShift && window.currentShift.id) ? window.currentShift.id : null,
      shift_number: (window.currentShift && window.currentShift.shiftNumber) ? window.currentShift.shiftNumber : 1,
      created_by: sale.user || 'مدير النظام',
      created_at: new Date(sale.timestamp || Date.now()).toISOString()
    };
    await sb.from('quick_sales').upsert(payload);
  } catch (err) {
    console.warn('dbUpsertQuickSale error:', err);
  }
}

async function dbDeleteQuickSale(saleId) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from('quick_sales').delete().eq('id', saleId);
  } catch (err) {
    console.warn('dbDeleteQuickSale error:', err);
  }
}

async function dbSyncVaults(vaultsState) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from('vaults').upsert({
      id: 1,
      drawer: parseFloat(vaultsState.drawer) || 0,
      sub_safe: parseFloat(vaultsState.sub_safe) || 0,
      main_safe: parseFloat(vaultsState.main_safe) || 0,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('dbSyncVaults error:', err);
  }
}

async function dbUpsertShift(shift) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const payload = {
      id: shift.id,
      shift_number: parseInt(shift.shiftNumber) || 1,
      opened_by: shift.openedBy || 'مدير النظام',
      closed_by: shift.closedBy || null,
      opened_at: new Date(shift.openedAt || Date.now()).toISOString(),
      closed_at: shift.closedAt ? new Date(shift.closedAt).toISOString() : null,
      total_revenue: parseFloat(shift.totalRevenue) || 0,
      breakdown: shift.breakdown || {},
      transferred_amount: parseFloat(shift.transferredAmount) || 0,
      status: shift.status || 'active',
      start_notes: shift.startNotes || null,
      close_notes: shift.notes || null,
      has_videos: shift.hasVideos === true,
      video1_saved: shift.video1Saved === true,
      video2_saved: shift.video2Saved === true,
      videos_deleted: shift.videosDeleted === true,
      videos_deleted_at: shift.videosDeletedAt ? new Date(shift.videosDeletedAt).toISOString() : null
    };
    await sb.from('shifts').upsert(payload);
  } catch (err) {
    console.warn('dbUpsertShift error:', err);
  }
}

async function dbInsertTransaction(tx) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const payload = {
      id: tx.id,
      type: tx.type || 'sale',
      title: tx.title || '',
      from_source: tx.from || '',
      to_destination: tx.to || '',
      amount: parseFloat(tx.amount) || 0,
      ref_id: tx.refId || null,
      shift_id: (window.currentShift && window.currentShift.id) ? window.currentShift.id : null,
      shift_number: tx.shiftNumber || 1,
      user_name: tx.user || 'مدير النظام',
      notes: tx.notes || null,
      has_videos: tx.hasVideos === true,
      videos_deleted: tx.videosDeleted === true,
      created_at: new Date(tx.timestamp || Date.now()).toISOString()
    };
    await sb.from('money_transactions').upsert(payload);
  } catch (err) {
    console.warn('dbInsertTransaction error:', err);
  }
}

async function dbInsertRefund(refund) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const payload = {
      id: refund.id,
      ref_id: refund.refId,
      section: refund.section,
      section_title: refund.sectionTitle || '',
      details: refund.details || '',
      amount: parseFloat(refund.amount) || 0,
      subtotal: parseFloat(refund.subtotal) || 0,
      discount: parseFloat(refund.discount) || 0,
      refund_reason: refund.refundReason || 'طلب العميل',
      booking_time: new Date(refund.bookingTime || Date.now()).toISOString(),
      shift_id: (window.currentShift && window.currentShift.id) ? window.currentShift.id : null,
      shift_number: refund.shiftNumber || 1,
      user_name: refund.user || 'مدير النظام',
      notes: refund.notes || null,
      created_at: new Date(refund.timestamp || Date.now()).toISOString()
    };
    await sb.from('refunds').upsert(payload);
  } catch (err) {
    console.warn('dbInsertRefund error:', err);
  }
}

async function dbSyncAppSettings(settings) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from('app_settings').upsert({
      id: 1,
      kids_hourly_rate: settings.kidsHourlyRate,
      ps_hourly_rate: settings.psHourlyRate,
      trampoline_game_price: settings.trampolineGamePrice,
      trampoline_game_duration: settings.trampolineGameDuration,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('dbSyncAppSettings error:', err);
  }
}

async function dbUpsertUser(user) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from('system_users').upsert({
      id: user.id,
      username: user.username,
      password_hash: user.password,
      role: user.role,
      permissions: user.permissions || {}
    });
  } catch (err) {
    console.warn('dbUpsertUser error:', err);
  }
}

async function dbDeleteUser(userId) {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from('system_users').delete().eq('id', userId);
  } catch (err) {
    console.warn('dbDeleteUser error:', err);
  }
}

/**
 * Uploads shift video recording blob to Supabase Storage Bucket
 */
async function dbUploadShiftVideo(shiftId, slot, blob) {
  const sb = getSupabaseClient();
  if (!sb || !blob) return null;
  try {
    const ext = blob.type && blob.type.includes('mp4') ? 'mp4' : 'webm';
    const filePath = `shifts/${shiftId}/slot_${slot}_${Date.now()}.${ext}`;

    const { data, error } = await sb.storage
      .from('shift-verification-videos')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: blob.type || 'video/webm'
      });

    if (error) {
      console.warn('Supabase video upload warning:', error.message);
      return null;
    }

    const { data: urlData } = sb.storage
      .from('shift-verification-videos')
      .getPublicUrl(filePath);

    const publicUrl = urlData ? urlData.publicUrl : null;

    await sb.from('shift_videos').upsert({
      id: `${shiftId}_v${slot}`,
      shift_id: shiftId,
      slot: slot,
      storage_path: filePath,
      video_url: publicUrl,
      mime_type: blob.type || 'video/webm',
      file_size_bytes: blob.size || 0
    });

    return publicUrl;
  } catch (err) {
    console.warn('dbUploadShiftVideo error:', err);
    return null;
  }
}

/**
 * Clears operations in Supabase when administrator triggers total wipe
 */
async function dbClearAllOperations() {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await Promise.all([
      sb.from('bookings').delete().neq('id', 'NONE'),
      sb.from('quick_sales').delete().neq('id', 'NONE'),
      sb.from('refunds').delete().neq('id', 'NONE'),
      sb.from('money_transactions').delete().neq('id', 'NONE'),
      sb.from('shifts').delete().neq('id', 'shift_1'),
      sb.from('vaults').upsert({ id: 1, drawer: 0, sub_safe: 0, main_safe: 0 })
    ]);
  } catch (err) {
    console.warn('dbClearAllOperations error:', err);
  }
}

/* ==========================================================================
   Supabase Realtime Live Channel (Multi-device instant synchronization)
   ========================================================================== */

function setupSupabaseRealtime(onRealtimeUpdate) {
  const sb = getSupabaseClient();
  if (!sb || realtimeChannel) return;

  try {
    realtimeChannel = sb
      .channel('scooby_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate('bookings', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quick_sales' }, (payload) => {
        if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate('quick_sales', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vaults' }, (payload) => {
        if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate('vaults', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, (payload) => {
        if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate('shifts', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'money_transactions' }, (payload) => {
        if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate('money_transactions', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, (payload) => {
        if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate('refunds', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate('app_settings', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_users' }, (payload) => {
        if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate('system_users', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Supabase] Realtime Channel Subscribed!');
          updateCloudStatusUI('online', 'متصل بالسحابة ☁️ (مباشر)');
        }
      });
  } catch (err) {
    console.warn('[Supabase] Realtime subscription warning:', err);
  }
}

// Click listener on badge for manual test
document.addEventListener('DOMContentLoaded', () => {
  const badge = document.getElementById('cloudStatusBadge');
  if (badge) {
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', async () => {
      updateCloudStatusUI('loading', 'جاري فحص الاتصال...');
      const ok = await checkSupabaseConnection();
      if (ok && typeof showToast === 'function') {
        showToast('الاتصال بالسحابة سليم وقاعدة البيانات متزامنة ☁️✅', 'success');
      } else if (!ok && typeof showToast === 'function') {
        showToast('تعذر الاتصال بالسحابة! جاري العمل محلياً 💾', 'warning');
      }
    });
  }
});

// Export functions to global scope
window.getSupabaseClient = getSupabaseClient;
window.checkSupabaseConnection = checkSupabaseConnection;
window.fetchAllDataFromSupabase = fetchAllDataFromSupabase;
window.dbUpsertBooking = dbUpsertBooking;
window.dbDeleteBooking = dbDeleteBooking;
window.dbUpsertQuickSale = dbUpsertQuickSale;
window.dbDeleteQuickSale = dbDeleteQuickSale;
window.dbSyncVaults = dbSyncVaults;
window.dbUpsertShift = dbUpsertShift;
window.dbInsertTransaction = dbInsertTransaction;
window.dbInsertRefund = dbInsertRefund;
window.dbSyncAppSettings = dbSyncAppSettings;
window.dbUpsertUser = dbUpsertUser;
window.dbDeleteUser = dbDeleteUser;
window.dbUploadShiftVideo = dbUploadShiftVideo;
window.dbClearAllOperations = dbClearAllOperations;
window.setupSupabaseRealtime = setupSupabaseRealtime;
window.updateCloudStatusUI = updateCloudStatusUI;
