// Authoritative service catalog + pricing config — now DB-backed
// (app.service_groups, app.service_options, app.pricing_config).
//
// Prices are matched server-side at reservation time so a tampered client can't
// pay an arbitrary amount. The public menu and the admin editor read the same
// catalog, so there is a single source of truth for names, durations and prices.

import { supabaseAdmin } from './supabase.server';

// Fallback used only if pricing_config can't be read (e.g. migration not applied).
export const DEFAULT_HOME_CALL_FEE_ZAR = 250;

export interface ServicePrice {
  service: string;
  duration: string;
  durationMinutes: number;
  priceZar: number;
}

export interface ServiceOption {
  duration: string;
  durationMinutes: number;
  priceZar: number;
}

export interface ServiceGroup {
  name: string;
  description: string;
  icon: string;
  options: ServiceOption[];
}

export interface PricingConfig {
  fxMarkupPct: number;
  homeCallFeeZar: number;
}

/**
 * Owner-managed pricing settings (FX markup, home-call fee). Falls back to
 * sane defaults if the row is missing so booking never hard-fails on config.
 */
export async function getPricingConfig(): Promise<PricingConfig> {
  const { data, error } = await supabaseAdmin
    .from('pricing_config')
    .select('fx_markup_pct, home_call_fee_zar')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[services] getPricingConfig failed:', error);
    return { fxMarkupPct: 0, homeCallFeeZar: DEFAULT_HOME_CALL_FEE_ZAR };
  }
  return {
    fxMarkupPct: Number(data.fx_markup_pct),
    homeCallFeeZar: Number(data.home_call_fee_zar),
  };
}

/**
 * Full catalog grouped for the public menu and the admin editor. Active-only by
 * default; pass includeInactive to get everything (admin management view).
 */
export async function getServiceCatalog(opts?: { includeInactive?: boolean }): Promise<ServiceGroup[]> {
  const includeInactive = opts?.includeInactive ?? false;

  let groupsQuery = supabaseAdmin
    .from('service_groups')
    .select('id, name, description, icon, sort_order, active')
    .order('sort_order', { ascending: true });
  if (!includeInactive) groupsQuery = groupsQuery.eq('active', true);
  const { data: groups, error: gErr } = await groupsQuery;

  if (gErr || !groups) {
    if (gErr) console.error('[services] getServiceCatalog groups failed:', gErr);
    return [];
  }

  let optionsQuery = supabaseAdmin
    .from('service_options')
    .select('group_id, duration_label, duration_minutes, price_zar, sort_order, active')
    .order('sort_order', { ascending: true });
  if (!includeInactive) optionsQuery = optionsQuery.eq('active', true);
  const { data: options, error: oErr } = await optionsQuery;

  if (oErr) {
    console.error('[services] getServiceCatalog options failed:', oErr);
    return [];
  }

  const byGroup = new Map<string, ServiceOption[]>();
  for (const o of options ?? []) {
    const arr = byGroup.get(o.group_id) ?? [];
    arr.push({
      duration: o.duration_label,
      durationMinutes: o.duration_minutes,
      priceZar: Number(o.price_zar),
    });
    byGroup.set(o.group_id, arr);
  }

  return groups.map((g: any) => ({
    name: g.name,
    description: g.description,
    icon: g.icon,
    options: byGroup.get(g.id) ?? [],
  }));
}

/**
 * Authoritative price lookup by (service, duration). Case-insensitive exact
 * match against the active catalog — matches the previous behaviour, without
 * any wildcard/LIKE exposure to client-supplied strings.
 */
export async function lookupService(service: string, duration: string): Promise<ServicePrice | null> {
  const catalog = await getServiceCatalog();
  const wantService = service.trim().toLowerCase();
  const wantDuration = duration.trim().toLowerCase();

  const group = catalog.find((g) => g.name.toLowerCase() === wantService);
  if (!group) return null;

  const opt = group.options.find((o) => o.duration.toLowerCase() === wantDuration);
  if (!opt) return null;

  return {
    service: group.name,
    duration: opt.duration,
    durationMinutes: opt.durationMinutes,
    priceZar: opt.priceZar,
  };
}

export function totalPrice(priceZar: number, isHomeCall: boolean, homeCallFeeZar: number): number {
  return priceZar + (isHomeCall ? homeCallFeeZar : 0);
}

// ---------------------------------------------------------------------------
// Admin CRUD. Owner-gated at the route layer; these functions assume the caller
// is already authorised. They expose row ids (unlike the public catalog) so the
// admin editor can target specific rows.
// ---------------------------------------------------------------------------

export interface AdminServiceOption {
  id: string;
  duration: string;
  durationMinutes: number;
  priceZar: number;
  sortOrder: number;
  active: boolean;
}

export interface AdminServiceGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  active: boolean;
  options: AdminServiceOption[];
}

export async function getCatalogForAdmin(): Promise<AdminServiceGroup[]> {
  const { data: groups, error: gErr } = await supabaseAdmin
    .from('service_groups')
    .select('id, name, description, icon, sort_order, active')
    .order('sort_order', { ascending: true });
  if (gErr || !groups) {
    if (gErr) console.error('[services] getCatalogForAdmin groups failed:', gErr);
    return [];
  }

  const { data: options, error: oErr } = await supabaseAdmin
    .from('service_options')
    .select('id, group_id, duration_label, duration_minutes, price_zar, sort_order, active')
    .order('sort_order', { ascending: true });
  if (oErr) {
    console.error('[services] getCatalogForAdmin options failed:', oErr);
    return [];
  }

  const byGroup = new Map<string, AdminServiceOption[]>();
  for (const o of options ?? []) {
    const arr = byGroup.get(o.group_id) ?? [];
    arr.push({
      id: o.id,
      duration: o.duration_label,
      durationMinutes: o.duration_minutes,
      priceZar: Number(o.price_zar),
      sortOrder: o.sort_order,
      active: o.active,
    });
    byGroup.set(o.group_id, arr);
  }

  return groups.map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    icon: g.icon,
    sortOrder: g.sort_order,
    active: g.active,
    options: byGroup.get(g.id) ?? [],
  }));
}

export async function updatePricingConfig(input: {
  fxMarkupPct: number;
  homeCallFeeZar: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('pricing_config')
    .update({
      fx_markup_pct: input.fxMarkupPct,
      home_call_fee_zar: input.homeCallFeeZar,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    console.error('[services] updatePricingConfig failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function createServiceGroup(input: {
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from('service_groups').insert({
    name: input.name,
    description: input.description,
    icon: input.icon,
    sort_order: input.sortOrder,
  });
  if (error) {
    console.error('[services] createServiceGroup failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateServiceGroup(
  id: string,
  input: { name: string; description: string; icon: string; sortOrder: number; active: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('service_groups')
    .update({
      name: input.name,
      description: input.description,
      icon: input.icon,
      sort_order: input.sortOrder,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('[services] updateServiceGroup failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteServiceGroup(id: string): Promise<{ ok: boolean; error?: string }> {
  // Options cascade-delete via the FK.
  const { error } = await supabaseAdmin.from('service_groups').delete().eq('id', id);
  if (error) {
    console.error('[services] deleteServiceGroup failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function createServiceOption(input: {
  groupId: string;
  durationLabel: string;
  durationMinutes: number;
  priceZar: number;
  sortOrder: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from('service_options').insert({
    group_id: input.groupId,
    duration_label: input.durationLabel,
    duration_minutes: input.durationMinutes,
    price_zar: input.priceZar,
    sort_order: input.sortOrder,
  });
  if (error) {
    console.error('[services] createServiceOption failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateServiceOption(
  id: string,
  input: {
    durationLabel: string;
    durationMinutes: number;
    priceZar: number;
    sortOrder: number;
    active: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('service_options')
    .update({
      duration_label: input.durationLabel,
      duration_minutes: input.durationMinutes,
      price_zar: input.priceZar,
      sort_order: input.sortOrder,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('[services] updateServiceOption failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteServiceOption(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from('service_options').delete().eq('id', id);
  if (error) {
    console.error('[services] deleteServiceOption failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
