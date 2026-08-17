/* ============================================================
   La Petite Auberge de Flo — Supabase client (shared)
   Loaded as <script type="module"> by reservation.html + admin.html.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

// Publishable key is safe to expose: RLS policies on the reservations table
// strictly limit what anon / authenticated roles can do.
export const SUPABASE_URL  = 'https://pmuczxviazbvfmvfqzlk.supabase.co';
export const SUPABASE_KEY  = 'sb_publishable_zaM4q3QmNtlLbKhpDyjGEQ_6jw83lG_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 5 },
  },
});

// ---------- Public form (reservation.html) ----------

export async function createReservation({ date, time, service, guests, name, phone, email, notes, lang }) {
  const row = {
    date,
    time,          // exact slot, e.g. "12:30"
    service,       // derived (midi/soir) — kept for capacity grouping
    guests: Number(guests),
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || null,
    notes: notes?.trim() || null,
    lang: lang || 'fr',
  };
  // Note: no .select() — anon has INSERT but no SELECT (RLS hides other rows),
  // and RETURNING would fail with "permission denied". The form doesn't need the id.
  const { error } = await supabase.from('reservations').insert(row);
  if (error) throw error;
}

// ---------- Chef dashboard (admin.html) ----------

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Fetch all upcoming + today's reservations (we don't paginate — small dataset)
export async function listReservations({ fromDate } = {}) {
  const from = fromDate || new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .gte('date', from)
    .order('date', { ascending: true })
    .order('service', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateStatus(id, status) {
  const { data: { user } } = await supabase.auth.getUser();
  const patch = { status };
  if (user && status !== 'en_attente') patch.handled_by = user.id;
  const { data, error } = await supabase
    .from('reservations')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Mode cahier ----------

// Numéro de table, texte libre ("12", "3+4", "terrasse"). Chaîne vide = on efface.
export async function setTableNo(id, tableNo) {
  const value = (tableNo ?? '').trim();
  const { data, error } = await supabase
    .from('reservations')
    .update({ table_no: value === '' ? null : value.slice(0, 20) })
    .eq('id', id)
    .select('id, table_no')
    .single();
  if (error) throw error;
  return data;
}

// Pointage de présence. `attendance` vaut 'arrive', 'absent' ou null (pas encore
// pointé). Volontairement SÉPARÉ de `status` : une réservation peut être
// confirmée ET absente — c'est justement le no-show qu'on cherche à mesurer.
export async function setAttendance(id, attendance) {
  if (attendance !== null && attendance !== 'arrive' && attendance !== 'absent') {
    throw new Error(`Pointage invalide : ${attendance}`);
  }
  const { data, error } = await supabase
    .from('reservations')
    .update({
      attendance,
      attendance_at: attendance === null ? null : new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, attendance, attendance_at')
    .single();
  if (error) throw error;
  return data;
}

// Correction d'une ligne existante (le client rappelle : "finalement on sera 6").
// Liste blanche de champs : on ne laisse pas passer status, handled_by, source…
const EDITABLE_FIELDS = ['date', 'time', 'service', 'guests', 'name', 'phone', 'email', 'notes'];

export async function updateReservation(id, patch) {
  const clean = {};
  for (const k of EDITABLE_FIELDS) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  if (!Object.keys(clean).length) throw new Error('Rien à modifier.');
  const { data, error } = await supabase
    .from('reservations')
    .update(clean)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Suppression définitive d'une ligne. Irréversible, et pas anodine : la ligne
// disparaît aussi de `v_service_activite` et donc de `get_previsions`, qui
// s'appuient sur l'historique des réservations. Pour une réservation qui ne
// viendra pas mais qui a bien existé, préférer `updateStatus(id, 'annulee')`
// ou le pointage 'absent' — les deux gardent la trace d'affluence.
// L'appelant DOIT demander confirmation avant.
export async function deleteReservation(id) {
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) throw error;
}

// Mémo du jour (plat du jour, groupe attendu, gâteau à prévoir…). Stocké dans
// service_overrides.notes — PK (date, service), donc un mémo par page de cahier.
// La colonne n'est plus lisible par `anon` : elle contient des noms de clients.
export async function setServiceNotes(date, service, notes) {
  const value = (notes ?? '').trim();
  const row = {
    date, service,
    notes: value === '' ? null : value.slice(0, 500),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('service_overrides')
    .upsert(row, { onConflict: 'date,service' });
  if (error) throw error;
}

export async function updateInternalNotes(id, internal_notes) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ internal_notes })
    .eq('id', id)
    .select('id, internal_notes')
    .single();
  if (error) throw error;
  return data;
}

// Chef ajoute une réservation lui-même depuis le dashboard (appel reçu sans
// papier sous la main, ou client venu directement) — évite de repasser par
// le formulaire public. Contrairement à createReservation (anon), on est en
// authenticated donc on peut relire la ligne créée (.select().single()).
// Statut par défaut "confirmee" : le chef vient de parler au client, ce n'est
// pas une demande "en attente" à valider.
export async function createReservationAsChef({ date, time, service, guests, name, phone, email, notes }) {
  const row = {
    date, time, service,
    guests: Number(guests),
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || null,
    notes: notes?.trim() || null,
    lang: 'fr',
    status: 'confirmee',
  };
  const { data, error } = await supabase.from('reservations').insert(row).select().single();
  if (error) throw error;
  return data;
}

// ---------- Service capacity (couverts, complet/ouvert) ----------

// Returns: { available, manually_closed, closed_reason, closed_note,
//            has_limit, is_full, almost_full, fits }
//
// Passer `guests` permet au serveur de répondre `fits` (ce groupe tient-il ?)
// sans que le client ait besoin de connaître la place restante. Le formulaire
// public doit s'en tenir à ces verdicts : les chiffres de salle
// (current_couverts / max_couverts / remaining) sont encore renvoyés pour
// compatibilité, mais ils partiront — ne pas s'y appuyer.
export async function getServiceState(date, service, guests = null) {
  const { data, error } = await supabase.rpc('get_service_state', {
    p_date: date, p_service: service, p_guests: guests,
  });
  if (error) throw error;
  return data;
}

// Chef toggles a service open/closed for a given day
export async function setServiceClosed(date, service, closed) {
  const { data: { user } } = await supabase.auth.getUser();
  const row = {
    date, service,
    manually_closed: closed,
    closed_by: closed ? user?.id || null : null,
    closed_at:  closed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('service_overrides')
    .upsert(row, { onConflict: 'date,service' });
  if (error) throw error;
}

// Chef sets a custom max for a specific day (overrides the default)
export async function setServiceMax(date, service, max) {
  const row = {
    date, service,
    max_couverts: max == null ? null : Number(max),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('service_overrides')
    .upsert(row, { onConflict: 'date,service' });
  if (error) throw error;
}

// Chef records covers already taken outside the app (phone call, paper agenda)
// for a given day/service — added on top of the app's own reservations when
// computing remaining capacity, so the public form and the dashboard stay
// consistent with what's actually booked.
export async function setOfflineCouverts(date, service, count) {
  const row = {
    date, service,
    offline_couverts: Number(count) || 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('service_overrides')
    .upsert(row, { onConflict: 'date,service' });
  if (error) throw error;
}

// ---------- Closures (fermetures récurrentes / par période) ----------
// Table `restaurant_closures` : lecture publique (le formulaire grise les jours
// fermés), écriture réservée au chef authentifié. Voir get_service_state pour
// la vérification serveur qui fait foi (ce cache client n'est qu'un confort UX).

export async function listClosures() {
  const { data, error } = await supabase
    .from('restaurant_closures')
    .select('*')
    .order('kind', { ascending: true })
    .order('weekday', { ascending: true })
    .order('start_date', { ascending: true });
  if (error) throw error;
  return data;
}

// Ferme un jour de la semaine de façon récurrente (ex. tous les lundis).
// service = null → toute la journée (les deux services).
export async function addWeeklyClosure(weekday, service, reason) {
  const { data: { user } } = await supabase.auth.getUser();
  const row = {
    kind: 'weekly', weekday, service: service || null,
    reason: reason?.trim() || null, created_by: user?.id || null,
  };
  const { error } = await supabase.from('restaurant_closures').insert(row);
  if (error) throw error;
}

// Ferme une période (congés, jours fériés...). service = null → les deux services.
export async function addRangeClosure(startDate, endDate, service, reason) {
  const { data: { user } } = await supabase.auth.getUser();
  const row = {
    kind: 'range', start_date: startDate, end_date: endDate,
    service: service || null, reason: reason?.trim() || null,
    created_by: user?.id || null,
  };
  const { error } = await supabase.from('restaurant_closures').insert(row);
  if (error) throw error;
}

export async function removeClosure(id) {
  const { error } = await supabase.from('restaurant_closures').delete().eq('id', id);
  if (error) throw error;
}

// Read the default global maxes (used by the settings panel)
export async function getDefaultCapacities() {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['default_max_midi', 'default_max_soir']);
  if (error) throw error;
  const out = { midi: 30, soir: 40 };
  for (const r of data || []) {
    if (r.key === 'default_max_midi') out.midi = parseInt(r.value, 10);
    if (r.key === 'default_max_soir') out.soir = parseInt(r.value, 10);
  }
  return out;
}

// Chef updates the global defaults (in Settings)
export async function setDefaultCapacities({ midi, soir }) {
  const rows = [
    { key: 'default_max_midi', value: String(midi), updated_at: new Date().toISOString() },
    { key: 'default_max_soir', value: String(soir), updated_at: new Date().toISOString() },
  ];
  const { error } = await supabase
    .from('app_config')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}

// ---------- Push notifications (Web Push) ----------

// Public VAPID key (safe to expose) — pairs with the private key stored in app_config.
// If you rotate VAPID, regenerate keys, update app_config and this constant together.
export const VAPID_PUBLIC_KEY =
  'BBOYucW6sFNiJBHjxCH1nzypk3m_0WkOLRMxkQDHDBgbd5nxpy08vrhQfjr-GHCv-LAkBXpd-CZngIp19_IPNHc';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// Subscribe this device to push, and persist the subscription to Supabase.
// Idempotent: if a subscription already exists for this endpoint, we UPSERT.
export async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push non supporté sur ce navigateur.');
  }
  const reg = await navigator.serviceWorker.ready;

  // Reuse existing subscription if present, otherwise create new one
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié.');

  const row = {
    user_id:    user.id,
    endpoint:   json.endpoint,
    p256dh:     json.keys.p256dh,
    auth:       json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
    last_used_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' });
  if (error) throw error;
  return json.endpoint;
}

export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

// Realtime: notify when any reservation changes (insert / update / delete)
export function subscribeReservations(onChange) {
  const channel = supabase
    .channel('reservations-stream')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => onChange(payload))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
