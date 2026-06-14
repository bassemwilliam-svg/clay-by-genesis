"use client";

import { useActionState, useState } from "react";
import type { ProductActionState } from "@/lib/products/actions";
import type {
  ProductForEdit,
  ProductFormOptions,
} from "@/lib/products/queries";

type Action = (
  prev: ProductActionState,
  formData: FormData,
) => Promise<ProductActionState>;

const TYPE_LABELS: Record<string, string> = {
  GAME_ASSET: "Game asset",
  ENVIRONMENT_KIT: "Environment kit",
  PROCEDURAL_TOOL: "Procedural tool",
  COURSE: "Course",
  BUNDLE: "Bundle",
};

const inputCls =
  "w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40";

function Field({
  label,
  name,
  errors,
  children,
  hint,
}: {
  label: string;
  name: string;
  errors?: Record<string, string[]>;
  children: React.ReactNode;
  hint?: string;
}) {
  const fieldErr = errors?.[name];
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {fieldErr?.length ? (
        <span className="text-xs text-destructive">{fieldErr[0]}</span>
      ) : null}
    </label>
  );
}

function listValue(v: string[] | undefined) {
  return v?.length ? v.join(", ") : "";
}

export function ProductForm({
  mode,
  action,
  options,
  initial,
}: {
  mode: "create" | "edit";
  action: Action;
  options: ProductFormOptions;
  initial?: NonNullable<ProductForEdit>;
}) {
  const [state, formAction, pending] = useActionState<
    ProductActionState,
    FormData
  >(action, { ok: false });
  const errors = state.fieldErrors;

  const [type, setType] = useState<string>(initial?.type ?? "GAME_ASSET");
  const [categoryId, setCategoryId] = useState<string>(
    initial?.categoryId ?? "",
  );

  const subcategories =
    options.categories.find((c) => c.id === categoryId)?.subcategories ?? [];

  const ga = initial?.gameAssetDetail;
  const ek = initial?.environmentKitDetail;
  const pt = initial?.proceduralToolDetail;

  return (
    <form action={formAction} className="space-y-8">
      {state.formError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      {mode === "edit" && state.ok ? (
        <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          Saved.
        </p>
      ) : null}

      {/* Status travels with the form so updates preserve it; transitions happen
          via the workflow buttons on the edit page. */}
      <input type="hidden" name="status" value={initial?.status ?? "DRAFT"} />

      <section className="grid gap-5 md:grid-cols-2">
        <Field label="Type" name="type" errors={errors}>
          {mode === "create" ? (
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputCls}
            >
              {Object.entries(TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="type" value={type} />
              <input
                className={`${inputCls} text-muted-foreground`}
                value={TYPE_LABELS[type]}
                disabled
              />
            </>
          )}
        </Field>

        <Field label="Title" name="title" errors={errors}>
          <input
            name="title"
            className={inputCls}
            defaultValue={initial?.title ?? ""}
            required
          />
        </Field>

        <Field
          label="Slug"
          name="slug"
          errors={errors}
          hint="Lowercase, hyphenated. Used in the storefront URL."
        >
          <input
            name="slug"
            className={inputCls}
            defaultValue={initial?.slug ?? ""}
            required
          />
        </Field>

        <Field label="License" name="licenseId" errors={errors}>
          <select
            name="licenseId"
            className={inputCls}
            defaultValue={initial?.licenseId ?? ""}
          >
            <option value="">, None, </option>
            {options.licenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Category" name="categoryId" errors={errors}>
          <select
            name="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputCls}
          >
            <option value="">, None, </option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Subcategory" name="subcategoryId" errors={errors}>
          <select
            name="subcategoryId"
            className={inputCls}
            defaultValue={initial?.subcategoryId ?? ""}
            disabled={!subcategories.length}
          >
            <option value="">, None, </option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Price (cents)"
          name="priceCents"
          errors={errors}
          hint="Integer minor units. 4900 = $49.00"
        >
          <input
            name="priceCents"
            type="number"
            min={0}
            className={inputCls}
            defaultValue={initial?.priceCents ?? 0}
            required
          />
        </Field>

        <Field label="Discount price (cents)" name="discountCents" errors={errors}>
          <input
            name="discountCents"
            type="number"
            min={0}
            className={inputCls}
            defaultValue={initial?.discountCents ?? ""}
          />
        </Field>

        <Field label="Currency" name="currency" errors={errors}>
          <input
            name="currency"
            className={inputCls}
            defaultValue={initial?.currency ?? "USD"}
            maxLength={3}
          />
        </Field>

        <Field
          label="Included in membership"
          name="includedInTier"
          errors={errors}
          hint="Members at this tier (and above) get it free; everyone else gets the member discount."
        >
          <select
            name="includedInTier"
            className={inputCls}
            defaultValue={initial?.includedInTier ?? ""}
          >
            <option value="">Not included (à la carte)</option>
            <option value="PRO">Pro &amp; Studio</option>
            <option value="STUDIO">Studio only</option>
          </select>
        </Field>
      </section>

      {/* Cross-cutting catalog facets, drive the Industry / Theme / Style filters
          on browse. Free-text with datalist suggestions of values already in use,
          so the admin can extend the vocabulary while reusing existing tags. */}
      <fieldset className="grid gap-5 rounded-lg border border-border p-5 md:grid-cols-3">
        <legend className="px-2 text-sm font-semibold">Catalog facets</legend>
        <Field
          label="Industry"
          name="industry"
          errors={errors}
          hint="e.g. Games, Film & VFX, Architecture"
        >
          <input
            name="industry"
            className={inputCls}
            list="facet-industry"
            defaultValue={initial?.industry ?? ""}
          />
          <datalist id="facet-industry">
            {options.facets.industry.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Theme"
          name="theme"
          errors={errors}
          hint="e.g. Sci-Fi, WW2, Fantasy"
        >
          <input
            name="theme"
            className={inputCls}
            list="facet-theme"
            defaultValue={initial?.theme ?? ""}
          />
          <datalist id="facet-theme">
            {options.facets.theme.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Style"
          name="style"
          errors={errors}
          hint="e.g. Realistic, Stylized"
        >
          <input
            name="style"
            className={inputCls}
            list="facet-style"
            defaultValue={initial?.style ?? ""}
          />
          <datalist id="facet-style">
            {options.facets.style.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
      </fieldset>

      <section className="grid gap-5">
        <Field label="Short description" name="shortDesc" errors={errors}>
          <input
            name="shortDesc"
            className={inputCls}
            defaultValue={initial?.shortDesc ?? ""}
          />
        </Field>
        <Field label="Full description" name="fullDesc" errors={errors}>
          <textarea
            name="fullDesc"
            rows={5}
            className={inputCls}
            defaultValue={initial?.fullDesc ?? ""}
          />
        </Field>
      </section>

      {/* ---- Per-category detail (driven by the discriminated union) ---- */}
      {type === "GAME_ASSET" ? (
        <fieldset className="grid gap-5 rounded-lg border border-border p-5 md:grid-cols-2">
          <legend className="px-2 text-sm font-semibold">Game asset</legend>
          <Field label="Polycount" name="polycount" errors={errors}>
            <input name="polycount" type="number" min={0} className={inputCls} defaultValue={ga?.polycount ?? ""} />
          </Field>
          <Field label="Max texture resolution" name="textureResMax" errors={errors}>
            <input name="textureResMax" type="number" min={0} className={inputCls} defaultValue={ga?.textureResMax ?? ""} />
          </Field>
          <Field label="LOD count" name="lodCount" errors={errors}>
            <input name="lodCount" type="number" min={0} className={inputCls} defaultValue={ga?.lodCount ?? ""} />
          </Field>
          <div className="flex items-end gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isRigged" defaultChecked={ga?.isRigged ?? false} /> Rigged
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isAnimated" defaultChecked={ga?.isAnimated ?? false} /> Animated
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPbr" defaultChecked={ga?.isPbr ?? false} /> PBR
            </label>
          </div>
          <Field label="File formats" name="fileFormats" errors={errors} hint="Comma-separated, e.g. fbx, glb, obj">
            <input name="fileFormats" className={inputCls} defaultValue={listValue(ga?.fileFormats)} />
          </Field>
          <Field label="Target engines" name="targetEngines" errors={errors} hint="Comma-separated, e.g. Unreal, Unity">
            <input name="targetEngines" className={inputCls} defaultValue={listValue(ga?.targetEngines)} />
          </Field>
          <Field label="Software" name="software" errors={errors} hint="Comma-separated, e.g. Houdini, Blender">
            <input name="software" className={inputCls} defaultValue={listValue(ga?.software)} />
          </Field>
        </fieldset>
      ) : null}

      {type === "ENVIRONMENT_KIT" ? (
        <fieldset className="grid gap-5 rounded-lg border border-border p-5 md:grid-cols-2">
          <legend className="px-2 text-sm font-semibold">Environment kit</legend>
          <Field label="Module count" name="moduleCount" errors={errors}>
            <input name="moduleCount" type="number" min={0} className={inputCls} defaultValue={ek?.moduleCount ?? ""} />
          </Field>
          <Field label="Coverage area (m²)" name="coverageAreaM2" errors={errors}>
            <input name="coverageAreaM2" type="number" min={0} className={inputCls} defaultValue={ek?.coverageAreaM2 ?? ""} />
          </Field>
          <Field label="Biome" name="biome" errors={errors}>
            <input name="biome" className={inputCls} defaultValue={ek?.biome ?? ""} />
          </Field>
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" name="isModular" defaultChecked={ek?.isModular ?? true} /> Modular
          </label>
          <Field label="File formats" name="fileFormats" errors={errors} hint="Comma-separated">
            <input name="fileFormats" className={inputCls} defaultValue={listValue(ek?.fileFormats)} />
          </Field>
          <Field label="Target engines" name="targetEngines" errors={errors} hint="Comma-separated">
            <input name="targetEngines" className={inputCls} defaultValue={listValue(ek?.targetEngines)} />
          </Field>
          <Field label="Software" name="software" errors={errors} hint="Comma-separated">
            <input name="software" className={inputCls} defaultValue={listValue(ek?.software)} />
          </Field>
        </fieldset>
      ) : null}

      {type === "PROCEDURAL_TOOL" ? (
        <fieldset className="grid gap-5 rounded-lg border border-border p-5 md:grid-cols-2">
          <legend className="px-2 text-sm font-semibold">Procedural tool</legend>
          <Field label="Host software" name="hostSoftware" errors={errors} hint="e.g. Houdini, Blender">
            <input name="hostSoftware" className={inputCls} defaultValue={pt?.hostSoftware ?? ""} />
          </Field>
          <Field label="Tool type" name="toolType" errors={errors} hint="e.g. HDA, geometry node group">
            <input name="toolType" className={inputCls} defaultValue={pt?.toolType ?? ""} />
          </Field>
          <div className="md:col-span-2">
            <Field
              label="Parameter manifest (JSON)"
              name="parameterManifest"
              errors={errors}
              hint="The editable-parameter schema. Drives the live configurator + landing demo."
            >
              <textarea
                name="parameterManifest"
                rows={8}
                className={`${inputCls} font-mono text-xs`}
                defaultValue={
                  pt?.parameterManifest
                    ? JSON.stringify(pt.parameterManifest, null, 2)
                    : ""
                }
              />
            </Field>
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create product"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
