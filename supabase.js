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

export async function createReservation({ date, service, guests, name, phone, email, notes, lang }) {
  const row = {
    date,
    service,
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
