"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryDto, DepartmentDto, ProvinceDto } from "@paktenders/shared-types";
import { Alert } from "@/components/ui/feedback";
import { FormRow, Input, Select, Textarea } from "@/components/ui/field";
import { reviewCollectionImport, type ActionResult } from "@/lib/actions";
import { toPktInput } from "@/lib/collection-utils";
import type { CollectionImportDetail } from "@/lib/collection-types";

function SubmitChoice({
  value,
  children,
  className,
}: {
  value: "PUBLISH" | "REJECT" | "NEEDS_REVIEW";
  children: React.ReactNode;
  className: string;
}) {
  return (
    <button type="submit" name="reviewAction" value={value} className={className}>
      {children}
    </button>
  );
}

export function CollectionReviewForm({
  record,
  categories,
  departments,
  provinces,
}: {
  record: CollectionImportDetail;
  categories: CategoryDto[];
  departments: DepartmentDto[];
  provinces: ProvinceDto[];
}) {
  const tender = record.tender;
  const [provinceId, setProvinceId] = useState(tender?.province.id ?? "");
  const cities = provinces.find((province) => province.id === provinceId)?.cities ?? [];
  const [state, formAction] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => reviewCollectionImport(formData),
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  if (!tender) {
    return (
      <Alert tone="warning" title="No tender record is attached">
        This import did not create a tender. Check the raw payload and the run log for the reason.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={record.id} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <FormRow label="Title" htmlFor="review-title">
            <Input id="review-title" name="title" defaultValue={tender.title} required minLength={4} maxLength={300} />
          </FormRow>
        </div>
        <FormRow label="Reference number" htmlFor="review-reference">
          <Input id="review-reference" name="referenceNumber" defaultValue={tender.referenceNumber ?? ""} maxLength={120} />
        </FormRow>
        <FormRow label="Tender type" htmlFor="review-type">
          <Select id="review-type" name="tenderType" defaultValue={tender.tenderType}>
            <option value="GOVERNMENT">Government</option>
            <option value="PRIVATE">Private</option>
            <option value="NGO">NGO</option>
            <option value="AUCTION">Auction</option>
            <option value="CONSULTANCY">Consultancy</option>
            <option value="NEWSPAPER">Newspaper</option>
          </Select>
        </FormRow>
        <FormRow label="Category" htmlFor="review-category">
          <Select id="review-category" name="categoryId" defaultValue={tender.category.id}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Department / organisation" htmlFor="review-department">
          <Select id="review-department" name="departmentId" defaultValue={tender.department.id}>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Province" htmlFor="review-province">
          <Select
            id="review-province"
            name="provinceId"
            value={provinceId}
            onChange={(event) => setProvinceId(event.target.value)}
          >
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="City" htmlFor="review-city">
          <Select id="review-city" name="cityId" defaultValue={tender.city?.id ?? ""} key={provinceId}>
            <option value="">No city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </Select>
        </FormRow>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FormRow label="Published at (PKT)" htmlFor="review-published">
          <Input id="review-published" name="publishedAt" type="datetime-local" defaultValue={toPktInput(tender.publishedAt)} />
        </FormRow>
        <FormRow label="Closing at (PKT)" htmlFor="review-closing">
          <Input id="review-closing" name="closingAt" type="datetime-local" defaultValue={toPktInput(tender.closingAt)} />
        </FormRow>
        <FormRow label="Opening at (PKT)" htmlFor="review-opening">
          <Input id="review-opening" name="openingAt" type="datetime-local" defaultValue={toPktInput(tender.openingAt)} />
        </FormRow>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormRow label="Estimated value (PKR)" htmlFor="review-value">
          <Input id="review-value" name="estimatedValue" defaultValue={tender.estimatedValue ?? ""} maxLength={60} />
        </FormRow>
        <FormRow label="Bid security (PKR)" htmlFor="review-bid-security">
          <Input id="review-bid-security" name="bidSecurityAmount" defaultValue={tender.bidSecurityAmount ?? ""} maxLength={60} />
        </FormRow>
      </div>

      <FormRow label="Summary" htmlFor="review-summary" hint="Optional short summary. Leave empty to keep the existing value.">
        <Input id="review-summary" name="summary" defaultValue={tender.summary ?? ""} maxLength={4000} />
      </FormRow>

      <FormRow label="Description" htmlFor="review-description">
        <Textarea id="review-description" name="description" defaultValue={tender.description ?? ""} maxLength={20000} className="min-h-32" />
      </FormRow>

      <FormRow label="Eligibility" htmlFor="review-eligibility">
        <Textarea id="review-eligibility" name="eligibility" defaultValue={tender.eligibility ?? ""} maxLength={4000} />
      </FormRow>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormRow label="Contact name" htmlFor="review-contact-name">
          <Input id="review-contact-name" name="contactName" defaultValue={tender.contactName ?? ""} maxLength={160} />
        </FormRow>
        <FormRow label="Contact email" htmlFor="review-contact-email">
          <Input id="review-contact-email" name="contactEmail" type="email" defaultValue={tender.contactEmail ?? ""} maxLength={200} />
        </FormRow>
        <FormRow label="Contact phone" htmlFor="review-contact-phone">
          <Input id="review-contact-phone" name="contactPhone" defaultValue={tender.contactPhone ?? ""} maxLength={60} />
        </FormRow>
        <FormRow label="Contact address" htmlFor="review-contact-address">
          <Input id="review-contact-address" name="contactAddress" defaultValue={tender.contactAddress ?? ""} maxLength={600} />
        </FormRow>
      </div>

      <FormRow label="Review notes" htmlFor="review-notes" hint="Recorded in the audit log and on the import.">
        <Textarea id="review-notes" name="notes" maxLength={2000} placeholder="What was checked against the source notice?" />
      </FormRow>

      {state ? (
        <Alert tone={state.ok ? "success" : "error"}>
          {state.ok ? (state.message ?? "Review saved") : (state.message ?? "Could not save the review")}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <SubmitChoice value="PUBLISH" className="btn-primary">
          Publish tender
        </SubmitChoice>
        <SubmitChoice value="NEEDS_REVIEW" className="btn-secondary">
          Keep for review
        </SubmitChoice>
        <SubmitChoice value="REJECT" className="btn-danger">
          Reject import
        </SubmitChoice>
      </div>
    </form>
  );
}
