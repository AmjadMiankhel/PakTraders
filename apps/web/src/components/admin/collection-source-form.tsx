"use client";

import { ActionForm } from "@/components/forms/action-form";
import { FormRow, Input, Select, Textarea } from "@/components/ui/field";
import { updateCollectionSource } from "@/lib/actions";
import type { CollectionSourceDetail } from "@/lib/collection-types";

export function CollectionSourceForm({ source }: { source: CollectionSourceDetail }) {
  const config = source.config ? JSON.stringify(source.config, null, 2) : "";

  return (
    <ActionForm action={updateCollectionSource} submitLabel="Save configuration" successMessage="Source configuration saved">
      <input type="hidden" name="id" value={source.id} />

      <div className="grid gap-4 lg:grid-cols-2">
        <FormRow label="Source name" htmlFor="source-name">
          <Input id="source-name" name="name" defaultValue={source.name} required minLength={2} maxLength={160} />
        </FormRow>
        <FormRow label="Status" htmlFor="source-status">
          <Select id="source-status" name="status" defaultValue={source.status}>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="DEGRADED">Degraded</option>
            <option value="DISABLED">Disabled</option>
            <option value="PENDING_REVIEW">Pending review</option>
          </Select>
        </FormRow>
        <FormRow label="Listing URL" htmlFor="source-url" hint="Public page the connector reads.">
          <Input id="source-url" name="url" type="url" defaultValue={source.url ?? ""} maxLength={2000} />
        </FormRow>
        <FormRow label="Base URL" htmlFor="source-base-url" hint="Used to resolve relative links.">
          <Input id="source-base-url" name="baseUrl" type="url" defaultValue={source.baseUrl ?? ""} maxLength={2000} />
        </FormRow>
      </div>

      <div className="flex flex-wrap gap-5 rounded-xl border border-line bg-surface px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            name="isEnabled"
            defaultChecked={source.isEnabled}
            className="h-4 w-4 rounded border-line"
          />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            name="isVerified"
            defaultChecked={source.isVerified}
            className="h-4 w-4 rounded border-line"
          />
          Access verified
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            name="respectRobots"
            defaultChecked={source.respectRobots}
            className="h-4 w-4 rounded border-line"
          />
          Respect robots.txt
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            name="autoPublish"
            defaultChecked={source.autoPublish}
            className="h-4 w-4 rounded border-line"
          />
          Auto-publish above confidence threshold
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <FormRow label="Priority" htmlFor="source-priority" hint="1 = highest">
          <Input id="source-priority" name="priority" type="number" min={1} max={100} defaultValue={source.priority} />
        </FormRow>
        <FormRow label="Schedule (minutes)" htmlFor="source-schedule">
          <Input
            id="source-schedule"
            name="scheduleMinutes"
            type="number"
            min={5}
            max={1440}
            defaultValue={source.scheduleMinutes}
          />
        </FormRow>
        <FormRow label="Requests / minute" htmlFor="source-rate">
          <Input
            id="source-rate"
            name="rateLimitPerMinute"
            type="number"
            min={1}
            max={60}
            defaultValue={source.rateLimitPerMinute}
          />
        </FormRow>
        <FormRow label="Max listing pages" htmlFor="source-pages">
          <Input id="source-pages" name="maxPages" type="number" min={1} max={20} defaultValue={source.maxPages} />
        </FormRow>
        <FormRow label="Min confidence" htmlFor="source-confidence" hint="0 – 1">
          <Input
            id="source-confidence"
            name="minConfidence"
            type="number"
            min={0}
            max={1}
            step="0.01"
            defaultValue={source.minConfidence}
          />
        </FormRow>
      </div>

      <FormRow label="Access notes" htmlFor="source-access-notes" hint="Why this source is enabled or disabled, and any conditions.">
        <Textarea id="source-access-notes" name="accessNotes" defaultValue={source.accessNotes ?? ""} maxLength={4000} />
      </FormRow>

      <FormRow label="Licence notes" htmlFor="source-license-notes">
        <Textarea id="source-license-notes" name="licenseNotes" defaultValue={source.licenseNotes ?? ""} maxLength={4000} />
      </FormRow>

      <FormRow label="Terms URL" htmlFor="source-terms">
        <Input id="source-terms" name="termsUrl" type="url" defaultValue={source.termsUrl ?? ""} maxLength={2000} />
      </FormRow>

      <FormRow
        label="Connector config (JSON)"
        htmlFor="source-config"
        hint={`Read by the “${source.connectorKey}” connector. Leave empty for defaults.`}
      >
        <Textarea
          id="source-config"
          name="config"
          defaultValue={config}
          className="min-h-48 font-mono text-xs"
          spellCheck={false}
        />
      </FormRow>
    </ActionForm>
  );
}
