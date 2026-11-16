"use client";

import { useState } from "react";
import type { ProvinceDto } from "@paktenders/shared-types";
import { ActionForm } from "@/components/forms/action-form";
import { FormRow, Input, Select, Textarea } from "@/components/ui/field";
import { updateProfile } from "@/lib/actions";
import type { MyProfile } from "@/lib/account-types";

export function ProfileForm({
  profile,
  provinces,
}: {
  profile: MyProfile;
  provinces: ProvinceDto[];
}) {
  const [provinceId, setProvinceId] = useState(profile.profile?.provinceId ?? "");
  const cities = provinces.find((province) => province.id === provinceId)?.cities ?? [];
  const keywords = (profile.profile?.preferredKeywords ?? []).join(", ");

  return (
    <ActionForm action={updateProfile} submitLabel="Save profile" successMessage="Profile updated">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Full name" htmlFor="profile-fullName">
          <Input
            id="profile-fullName"
            name="fullName"
            defaultValue={profile.fullName}
            required
            minLength={2}
            maxLength={120}
          />
        </FormRow>
        <FormRow label="Mobile number" htmlFor="profile-phone" hint="Pakistani mobile number, e.g. 03001234567.">
          <Input id="profile-phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} placeholder="03xx xxxxxxx" />
        </FormRow>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Job title" htmlFor="profile-jobTitle">
          <Input
            id="profile-jobTitle"
            name="jobTitle"
            defaultValue={profile.profile?.jobTitle ?? ""}
            maxLength={120}
            placeholder="e.g. Procurement manager"
          />
        </FormRow>
        <FormRow label="Marketing emails" htmlFor="profile-marketingOptIn">
          <label className="mt-2 flex items-center gap-2 text-sm text-ink-700">
            <input
              id="profile-marketingOptIn"
              name="marketingOptIn"
              type="checkbox"
              defaultChecked={profile.profile?.marketingOptIn ?? false}
              className="h-4 w-4 rounded border-line"
            />
            Send me product updates and offers
          </label>
        </FormRow>
      </div>

      <FormRow label="Province" htmlFor="profile-provinceId">
        <Select
          id="profile-provinceId"
          name="provinceId"
          value={provinceId}
          onChange={(event) => setProvinceId(event.target.value)}
        >
          <option value="">No preference</option>
          {provinces.map((province) => (
            <option key={province.id} value={province.id}>
              {province.name}
            </option>
          ))}
        </Select>
      </FormRow>

      <FormRow label="City" htmlFor="profile-cityId">
        <Select
          id="profile-cityId"
          name="cityId"
          defaultValue={profile.profile?.cityId ?? ""}
          key={provinceId}
          disabled={cities.length === 0}
        >
          <option value="">No preference</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
      </FormRow>

      <FormRow
        label="Preferred keywords"
        htmlFor="profile-keywords"
        hint="Comma-separated, up to 20 keywords. Used to personalize alerts."
      >
        <Input
          id="profile-keywords"
          name="preferredKeywords"
          defaultValue={keywords}
          placeholder="construction, solar, IT services"
        />
      </FormRow>

      <FormRow label="About you" htmlFor="profile-bio">
        <Textarea
          id="profile-bio"
          name="bio"
          defaultValue={profile.profile?.bio ?? ""}
          maxLength={1000}
          placeholder="Tell us about your business and the tenders you look for."
        />
      </FormRow>
    </ActionForm>
  );
}
