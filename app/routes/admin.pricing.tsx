// app/routes/admin.pricing.tsx
// Owner-only pricing & service catalog manager. Full CRUD over service groups,
// their duration/price options, plus the FX markup and home-call fee.

import { Form, Link, useLoaderData, useSearchParams, redirect } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { assertOwner } from '~/lib/auth.server';
import {
  getCatalogForAdmin,
  getPricingConfig,
  updatePricingConfig,
  createServiceGroup,
  updateServiceGroup,
  deleteServiceGroup,
  createServiceOption,
  updateServiceOption,
  deleteServiceOption,
  type AdminServiceGroup,
  type PricingConfig,
} from '~/lib/services.server';

export function meta() {
  return [{ title: "Pricing | Chi Chi's Beauty Spa" }];
}

interface LoaderData {
  catalog: AdminServiceGroup[];
  config: PricingConfig;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await assertOwner(request);
  const [catalog, config] = await Promise.all([getCatalogForAdmin(), getPricingConfig()]);
  return new Response(JSON.stringify({ catalog, config } satisfies LoaderData), {
    headers: { ...Object.fromEntries(session.headers), 'Content-Type': 'application/json' },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await assertOwner(request);
  const fd = await request.formData();
  const intent = fd.get('intent') as string;

  const str = (k: string) => ((fd.get(k) as string) ?? '').trim();
  const num = (k: string, fallback = 0) => {
    const n = Number(fd.get(k));
    return Number.isFinite(n) ? n : fallback;
  };
  const bool = (k: string) => {
    const v = fd.get(k);
    return v === 'on' || v === 'true';
  };

  let res: { ok: boolean; error?: string } = { ok: true };
  switch (intent) {
    case 'updateConfig':
      res = await updatePricingConfig({
        fxMarkupPct: num('fxMarkupPct'),
        homeCallFeeZar: num('homeCallFeeZar'),
      });
      break;
    case 'createGroup':
      res = await createServiceGroup({
        name: str('name'),
        description: str('description'),
        icon: str('icon') || '✿',
        sortOrder: num('sortOrder'),
      });
      break;
    case 'updateGroup':
      res = await updateServiceGroup(str('id'), {
        name: str('name'),
        description: str('description'),
        icon: str('icon') || '✿',
        sortOrder: num('sortOrder'),
        active: bool('active'),
      });
      break;
    case 'deleteGroup':
      res = await deleteServiceGroup(str('id'));
      break;
    case 'createOption':
      res = await createServiceOption({
        groupId: str('groupId'),
        durationLabel: str('durationLabel'),
        durationMinutes: num('durationMinutes'),
        priceZar: num('priceZar'),
        sortOrder: num('sortOrder'),
      });
      break;
    case 'updateOption':
      res = await updateServiceOption(str('id'), {
        durationLabel: str('durationLabel'),
        durationMinutes: num('durationMinutes'),
        priceZar: num('priceZar'),
        sortOrder: num('sortOrder'),
        active: bool('active'),
      });
      break;
    case 'deleteOption':
      res = await deleteServiceOption(str('id'));
      break;
    default:
      res = { ok: false, error: 'unknown_intent' };
  }

  const dest = res.ok
    ? '/admin/pricing?ok=1'
    : `/admin/pricing?error=${encodeURIComponent(res.error ?? 'failed')}`;
  return redirect(dest, { headers: session.headers });
}

const inputCls =
  'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#f48fb1]/50';
const btnPrimary =
  'px-4 py-2 bg-[#f48fb1] text-[#0a0a0a] text-sm font-semibold rounded-lg hover:bg-[#f8bbd9] transition-all';
const btnDanger =
  'px-3 py-2 border border-red-500/40 text-red-300 text-sm rounded-lg hover:bg-red-500/10 transition-all';

export default function AdminPricing() {
  const { catalog, config } = useLoaderData<typeof loader>() as LoaderData;
  const [searchParams] = useSearchParams();
  const ok = searchParams.get('ok');
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-playfair text-3xl">Pricing & Services</h1>
          <Link to="/admin" className="text-[#f48fb1] hover:text-[#f8bbd9] transition-colors text-sm">
            ← Back to Admin
          </Link>
        </div>

        {ok && (
          <div className="mb-6 p-3 rounded-xl bg-green-500/20 border border-green-500/50 text-green-300 text-sm">
            Saved.
          </div>
        )}
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Pricing config */}
        <div className="gradient-border rounded-2xl p-6 mb-6">
          <h2 className="font-playfair text-xl mb-4">Payment settings</h2>
          <Form method="post" className="grid grid-cols-2 gap-4 items-end">
            <input type="hidden" name="intent" value="updateConfig" />
            <label className="block">
              <span className="block text-sm text-white/60 mb-1">FX markup %</span>
              <input
                className={inputCls}
                type="number"
                step="0.01"
                min="0"
                max="100"
                name="fxMarkupPct"
                defaultValue={config.fxMarkupPct}
              />
              <span className="block text-xs text-white/40 mt-1">
                Added on top of the live rate for USD/EUR charges.
              </span>
            </label>
            <label className="block">
              <span className="block text-sm text-white/60 mb-1">Home-call fee (R)</span>
              <input
                className={inputCls}
                type="number"
                step="0.01"
                min="0"
                name="homeCallFeeZar"
                defaultValue={config.homeCallFeeZar}
              />
            </label>
            <div className="col-span-2">
              <button className={btnPrimary} type="submit">
                Save settings
              </button>
            </div>
          </Form>
        </div>

        {/* Service groups */}
        {catalog.map((group) => (
          <div key={group.id} className="gradient-border rounded-2xl p-6 mb-6">
            <Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="updateGroup" />
              <input type="hidden" name="id" value={group.id} />
              <div className="flex gap-3">
                <label className="w-16">
                  <span className="block text-xs text-white/50 mb-1">Icon</span>
                  <input className={inputCls} name="icon" defaultValue={group.icon} />
                </label>
                <label className="flex-1">
                  <span className="block text-xs text-white/50 mb-1">Service name</span>
                  <input className={inputCls} name="name" defaultValue={group.name} required />
                </label>
                <label className="w-20">
                  <span className="block text-xs text-white/50 mb-1">Order</span>
                  <input className={inputCls} type="number" name="sortOrder" defaultValue={group.sortOrder} />
                </label>
              </div>
              <label className="block">
                <span className="block text-xs text-white/50 mb-1">Description</span>
                <input className={inputCls} name="description" defaultValue={group.description} />
              </label>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input type="checkbox" name="active" defaultChecked={group.active} />
                  Active (shown on site)
                </label>
                <button className={btnPrimary} type="submit">
                  Save service
                </button>
              </div>
            </Form>

            {/* Options */}
            <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
              <span className="block text-sm text-white/60">Durations & prices</span>
              {group.options.map((opt) => (
                <Form key={opt.id} method="post" className="flex flex-wrap items-end gap-2">
                  {/* No hidden intent: each submit button carries its own, so
                      only the clicked action is sent. */}
                  <input type="hidden" name="id" value={opt.id} />
                  <label className="w-28">
                    <span className="block text-xs text-white/50 mb-1">Label</span>
                    <input className={inputCls} name="durationLabel" defaultValue={opt.duration} required />
                  </label>
                  <label className="w-20">
                    <span className="block text-xs text-white/50 mb-1">Minutes</span>
                    <input
                      className={inputCls}
                      type="number"
                      name="durationMinutes"
                      min="15"
                      max="240"
                      defaultValue={opt.durationMinutes}
                    />
                  </label>
                  <label className="w-24">
                    <span className="block text-xs text-white/50 mb-1">Price (R)</span>
                    <input
                      className={inputCls}
                      type="number"
                      step="0.01"
                      min="0"
                      name="priceZar"
                      defaultValue={opt.priceZar}
                    />
                  </label>
                  <label className="w-16">
                    <span className="block text-xs text-white/50 mb-1">Order</span>
                    <input className={inputCls} type="number" name="sortOrder" defaultValue={opt.sortOrder} />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-white/70 pb-2">
                    <input type="checkbox" name="active" defaultChecked={opt.active} />
                    Active
                  </label>
                  <button className={btnPrimary} type="submit" name="intent" value="updateOption">
                    Save
                  </button>
                  <button
                    className={btnDanger}
                    type="submit"
                    name="intent"
                    value="deleteOption"
                    formNoValidate
                  >
                    Delete
                  </button>
                </Form>
              ))}

              {/* Add option */}
              <Form method="post" className="flex flex-wrap items-end gap-2 pt-2">
                <input type="hidden" name="intent" value="createOption" />
                <input type="hidden" name="groupId" value={group.id} />
                <label className="w-28">
                  <span className="block text-xs text-white/50 mb-1">Label</span>
                  <input className={inputCls} name="durationLabel" placeholder="30 min" required />
                </label>
                <label className="w-20">
                  <span className="block text-xs text-white/50 mb-1">Minutes</span>
                  <input className={inputCls} type="number" name="durationMinutes" min="15" max="240" placeholder="30" />
                </label>
                <label className="w-24">
                  <span className="block text-xs text-white/50 mb-1">Price (R)</span>
                  <input className={inputCls} type="number" step="0.01" min="0" name="priceZar" placeholder="400" />
                </label>
                <button className={btnPrimary} type="submit">
                  + Add duration
                </button>
              </Form>
            </div>

            {/* Delete group */}
            <Form method="post" className="mt-4 border-t border-white/10 pt-4">
              <input type="hidden" name="intent" value="deleteGroup" />
              <input type="hidden" name="id" value={group.id} />
              <button
                className={btnDanger}
                type="submit"
                onClick={(e) => {
                  if (!confirm(`Delete "${group.name}" and all its durations?`)) e.preventDefault();
                }}
              >
                Delete this service
              </button>
            </Form>
          </div>
        ))}

        {/* Add group */}
        <div className="gradient-border rounded-2xl p-6">
          <h2 className="font-playfair text-xl mb-4">Add a service</h2>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="createGroup" />
            <div className="flex gap-3">
              <label className="w-16">
                <span className="block text-xs text-white/50 mb-1">Icon</span>
                <input className={inputCls} name="icon" placeholder="✿" />
              </label>
              <label className="flex-1">
                <span className="block text-xs text-white/50 mb-1">Service name</span>
                <input className={inputCls} name="name" placeholder="New Treatment" required />
              </label>
              <label className="w-20">
                <span className="block text-xs text-white/50 mb-1">Order</span>
                <input className={inputCls} type="number" name="sortOrder" defaultValue={catalog.length + 1} />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs text-white/50 mb-1">Description</span>
              <input className={inputCls} name="description" placeholder="Short description" />
            </label>
            <button className={btnPrimary} type="submit">
              Create service
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
