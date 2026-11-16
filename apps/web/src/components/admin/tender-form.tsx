"use client";

import { useState } from "react";
import type { CategoryDto, DepartmentDto, ProvinceDto, TenderDetail } from "@paktenders/shared-types";
import { ActionForm } from "@/components/forms/action-form";
import { FormRow, Input, Select, Textarea } from "@/components/ui/field";
import { createTender, updateTender } from "@/lib/actions";
import type { TenderSourceDto } from "@/lib/admin-types";

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" in Pakistan Standard Time. */
function toPktInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export function TenderForm({
  mode,
  tender,
  categories,
  departments,
  provinces,
  sources,
}: {
  mode: "create" | "edit";
  tender?: TenderDetail;
  categories: CategoryDto[];
  departments: DepartmentDto[];
  provinces: ProvinceDto[];
  sources: TenderSourceDto[];
}) {
  const [provinceId, setProvinceId] = useState(tender?.province.id ?? "");
  const cities = provinces.find((province) => province.id === provinceId)?.cities ?? [];
  const action = mode === "create" ? createTender : updateTender;

  return (
    <ActionForm
      action={action}
      submitLabel={mode === "create" ? "Create tender" : "Save changes"}
      successMessage={mode === "create" ? "Tender created" : "Tender updated"}
    >
      {tender ? <input type="hidden" name="id" value={tender.id} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <FormRow label="Title" htmlFor="tender-title">
            <Input
              id="tender-title"
              name="title"
              defaultValue={tender?.title ?? ""}
              required
              minLength={8}
              maxLength={240}
              placeholder="Supply of solar panels for district offices"
            />
          </FormRow>
        </div>

        <FormRow label="Reference number" htmlFor="tender-reference">
          <Input
            id="tender-reference"
            name="referenceNumber"
            defaultValue={tender?.referenceNumber ?? ""}
            maxLength={120}
            placeholder="e.g. PPRA/2026/001"
          />
        </FormRow>

        <FormRow label="Tender type" htmlFor="tender-type">
          <Select id="tender-type" name="tenderType" defaultValue={tender?.tenderType ?? "GOVERNMENT"}>
            <option value="GOVERNMENT">Government</option>
            <option value="PRIVATE">Private</option>
            <option value="NGO">NGO</option>
            <option value="AUCTION">Auction</option>
            <option value="CONSULTANCY">Consultancy</option>
            <option value="NEWSPAPER">Newspaper</option>
          </Select>
        </FormRow>

        <FormRow label="Category" htmlFor="tender-category">
          <Select id="tender-category" name="categoryId" defaultValue={tender?.category.id ?? ""} required>
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Department / organisation" htmlFor="tender-department">
          <Select id="tender-department" name="departmentId" defaultValue={tender?.department.id ?? ""} required>
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Province" htmlFor="tender-province">
          <Select
            id="tender-province"
            name="provinceId"
            value={provinceId}
            onChange={(event) => setProvinceId(event.target.value)}
            required
          >
            <option value="">Select a province</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="City" htmlFor="tender-city">
          <Select id="tender-city" name="cityId" defaultValue={tender?.city?.id ?? ""} key={provinceId}>
            <option value="">No city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Source" htmlFor="tender-source" hint="Optional attribution source.">
          <Select id="tender-source" name="sourceId" defaultValue={tender?.source?.id ?? ""}>
            <option value="">No source</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Status" htmlFor="tender-status">
          <Select id="tender-status" name="status" defaultValue={tender?.status ?? "DRAFT"}>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_VERIFICATION">Pending verification</option>
            <option value="PUBLISHED">Published</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </FormRow>

        <FormRow label="Verification" htmlFor="tender-verification">
          <Select
            id="tender-verification"
            name="verificationStatus"
            defaultValue={tender?.verificationStatus ?? "UNVERIFIED"}
          >
            <option value="UNVERIFIED">Unverified</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
          </Select>
        </FormRow>
      </div>

      <FormRow label="Summary" htmlFor="tender-summary" hint="Short card description, max 400 characters.">
        <Input
          id="tender-summary"
          name="summary"
          defaultValue={tender?.summary ?? ""}
          maxLength={400}
          placeholder="One-line summary shown in listings"
        />
      </FormRow>

      <FormRow label="Description" htmlFor="tender-description">
        <Textarea
          id="tender-description"
          name="description"
          defaultValue={tender?.description ?? ""}
          required
          minLength={30}
          maxLength={20000}
          className="min-h-40"
          placeholder="Full tender description, scope of work and instructions."
        />
      </FormRow>

      <div className="grid gap-4 lg:grid-cols-3">
        <FormRow label="Published at (PKT)" htmlFor="tender-published">
          <Input
            id="tender-published"
            name="publishedAt"
            type="datetime-local"
            defaultValue={toPktInput(tender?.publishedAt)}
          />
        </FormRow>
        <FormRow label="Closing at (PKT)" htmlFor="tender-closing">
          <Input
            id="tender-closing"
            name="closingAt"
            type="datetime-local"
            defaultValue={toPktInput(tender?.closingAt)}
          />
        </FormRow>
        <FormRow label="Opening at (PKT)" htmlFor="tender-opening">
          <Input
            id="tender-opening"
            name="openingAt"
            type="datetime-local"
            defaultValue={toPktInput(tender?.openingAt)}
          />
        </FormRow>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FormRow label="Estimated value (PKR)" htmlFor="tender-value">
          <Input
            id="tender-value"
            name="estimatedValue"
            type="number"
            min={0}
            step="0.01"
            defaultValue={tender?.estimatedValue ?? ""}
            placeholder="0"
          />
        </FormRow>
        <FormRow label="Bid security (PKR)" htmlFor="tender-bid-security">
          <Input
            id="tender-bid-security"
            name="bidSecurityAmount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={tender?.bidSecurityAmount ?? ""}
            placeholder="0"
          />
        </FormRow>
        <FormRow label="Bid security details" htmlFor="tender-bid-details">
          <Input
            id="tender-bid-details"
            name="bidSecurityDetails"
            defaultValue={tender?.bidSecurityDetails ?? ""}
            maxLength={2000}
            placeholder="Pay order / bank guarantee details"
          />
        </FormRow>
      </div>

      <FormRow label="Eligibility" htmlFor="tender-eligibility">
        <Textarea
          id="tender-eligibility"
          name="eligibility"
          defaultValue={tender?.eligibility ?? ""}
          maxLength={10000}
          placeholder="Eligibility criteria for bidders."
        />
      </FormRow>

      <FormRow
        label="Required documents"
        htmlFor="tender-documents"
        hint="One document per line, up to 50."
      >
        <Textarea
          id="tender-documents"
          name="requiredDocuments"
          defaultValue={(tender?.requiredDocuments ?? []).join("\n")}
          placeholder={"NTN certificate\nRegistration certificate\nBank statement"}
        />
      </FormRow>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormRow label="Contact name" htmlFor="tender-contact-name">
          <Input id="tender-contact-name" name="contactName" defaultValue={tender?.contactName ?? ""} maxLength={120} />
        </FormRow>
        <FormRow label="Contact email" htmlFor="tender-contact-email">
          <Input id="tender-contact-email" name="contactEmail" type="email" defaultValue={tender?.contactEmail ?? ""} maxLength={254} />
        </FormRow>
        <FormRow label="Contact phone" htmlFor="tender-contact-phone">
          <Input id="tender-contact-phone" name="contactPhone" defaultValue={tender?.contactPhone ?? ""} maxLength={40} />
        </FormRow>
        <FormRow label="Contact address" htmlFor="tender-contact-address">
          <Input id="tender-contact-address" name="contactAddress" defaultValue={tender?.contactAddress ?? ""} maxLength={400} />
        </FormRow>
      </div>

      <FormRow label="Original source URL" htmlFor="tender-original-url">
        <Input
          id="tender-original-url"
          name="originalUrl"
          type="url"
          defaultValue={tender?.originalUrl ?? ""}
          maxLength={1000}
          placeholder="https://…"
        />
      </FormRow>

      <FormRow label="Source attribution" htmlFor="tender-attribution" hint="Explain where this record came from.">
        <Input
          id="tender-attribution"
          name="sourceAttribution"
          defaultValue={tender?.sourceAttribution ?? ""}
          maxLength={400}
        />
      </FormRow>

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          name="isFeatured"
          defaultChecked={tender?.isFeatured ?? false}
          className="h-4 w-4 rounded border-line"
        />
        Feature this tender on the homepage
      </label>
    </ActionForm>
  );
}
