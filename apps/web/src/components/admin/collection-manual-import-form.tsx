"use client";

import { ActionForm } from "@/components/forms/action-form";
import { FormRow, Input, Select, Textarea } from "@/components/ui/field";
import { createCollectionManualImport } from "@/lib/actions";
import type { CollectionSource } from "@/lib/collection-types";

export function CollectionManualImportForm({ sources }: { sources: CollectionSource[] }) {
  return (
    <ActionForm
      action={createCollectionManualImport}
      submitLabel="Import notice"
      pendingLabel="Importing…"
      successMessage="Notice imported"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <FormRow
          label="Source"
          htmlFor="manual-source"
          hint="The source this notice came from. Manual-only sources appear here too."
        >
          <Select id="manual-source" name="sourceId" required defaultValue="">
            <option value="" disabled>
              Choose a source…
            </option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name} ({source.code})
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow
          label="Source URL"
          htmlFor="manual-source-url"
          hint="Required unless you upload the notice document."
        >
          <Input
            id="manual-source-url"
            name="sourceUrl"
            type="url"
            maxLength={2000}
            placeholder="https://…"
          />
        </FormRow>
      </div>

      <FormRow label="Title" htmlFor="manual-title">
        <Input id="manual-title" name="title" required minLength={4} maxLength={300} />
      </FormRow>

      <div className="grid gap-4 lg:grid-cols-3">
        <FormRow label="Reference number" htmlFor="manual-reference">
          <Input id="manual-reference" name="referenceNumber" maxLength={120} />
        </FormRow>
        <FormRow label="Organisation (as published)" htmlFor="manual-organization">
          <Input id="manual-organization" name="organization" maxLength={200} />
        </FormRow>
        <FormRow label="Department" htmlFor="manual-department">
          <Input id="manual-department" name="department" maxLength={200} />
        </FormRow>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <FormRow label="Category" htmlFor="manual-category" hint="Matched to the catalogue by name.">
          <Input id="manual-category" name="category" maxLength={120} placeholder="Construction" />
        </FormRow>
        <FormRow label="Province" htmlFor="manual-province">
          <Input id="manual-province" name="province" maxLength={120} placeholder="Punjab" />
        </FormRow>
        <FormRow label="City" htmlFor="manual-city">
          <Input id="manual-city" name="city" maxLength={120} placeholder="Lahore" />
        </FormRow>
        <FormRow label="Tender type" htmlFor="manual-type">
          <Select id="manual-type" name="tenderType" defaultValue="">
            <option value="">Not specified</option>
            <option value="GOVERNMENT">Government</option>
            <option value="PRIVATE">Private</option>
            <option value="NGO">NGO</option>
            <option value="AUCTION">Auction</option>
            <option value="CONSULTANCY">Consultancy</option>
            <option value="NEWSPAPER">Newspaper</option>
          </Select>
        </FormRow>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FormRow label="Published at (PKT)" htmlFor="manual-published">
          <Input id="manual-published" name="publishedAt" type="datetime-local" />
        </FormRow>
        <FormRow label="Closing at (PKT)" htmlFor="manual-closing">
          <Input id="manual-closing" name="closingAt" type="datetime-local" />
        </FormRow>
        <FormRow label="Opening at (PKT)" htmlFor="manual-opening">
          <Input id="manual-opening" name="openingAt" type="datetime-local" />
        </FormRow>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormRow label="Estimated value" htmlFor="manual-value" hint="As printed, for example “PKR 4.5 million”.">
          <Input id="manual-value" name="estimatedValue" maxLength={60} />
        </FormRow>
        <FormRow label="Bid security" htmlFor="manual-bid-security">
          <Input id="manual-bid-security" name="bidSecurity" maxLength={500} />
        </FormRow>
      </div>

      <FormRow label="Eligibility" htmlFor="manual-eligibility">
        <Textarea id="manual-eligibility" name="eligibility" maxLength={4000} />
      </FormRow>

      <FormRow
        label="Required documents"
        htmlFor="manual-required-documents"
        hint="One per line. Used for URL imports; ignored when you upload a document."
      >
        <Textarea id="manual-required-documents" name="requiredDocuments" maxLength={4000} />
      </FormRow>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormRow label="Contact name" htmlFor="manual-contact-name">
          <Input id="manual-contact-name" name="contactName" maxLength={160} />
        </FormRow>
        <FormRow label="Contact email" htmlFor="manual-contact-email">
          <Input id="manual-contact-email" name="contactEmail" type="email" maxLength={200} />
        </FormRow>
        <FormRow label="Contact phone" htmlFor="manual-contact-phone">
          <Input id="manual-contact-phone" name="contactPhone" maxLength={60} />
        </FormRow>
        <FormRow label="Contact address" htmlFor="manual-contact-address">
          <Input id="manual-contact-address" name="contactAddress" maxLength={600} />
        </FormRow>
      </div>

      <FormRow label="Description" htmlFor="manual-description">
        <Textarea id="manual-description" name="description" maxLength={20000} className="min-h-32" />
      </FormRow>

      <FormRow
        label="Document URLs"
        htmlFor="manual-document-urls"
        hint="One public PDF or document URL per line (maximum 10)."
      >
        <Textarea id="manual-document-urls" name="documentUrls" maxLength={4000} />
      </FormRow>

      <FormRow
        label="Upload notice document"
        htmlFor="manual-file"
        hint="PDF or image, up to 25 MB. The original is stored and used for extraction."
      >
        <Input id="manual-file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff" />
      </FormRow>
    </ActionForm>
  );
}
