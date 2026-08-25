/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { z } from 'zod'
import { httpsUrlSchema } from '@perawallet/wallet-core-shared'

// GET /v1/auth/settings. We model the country/state lists the signup UI needs
// plus the per-jurisdiction T&C links used on the address step; the rest of the
// `links`/`config` blocks are still ignored.
const supportedCountrySchema = z.object({
    id: z.string(),
    iso3166alpha2: z.string(),
    name: z.string(),
    callingCode: z.string(),
    canSignUp: z.boolean(),
})

const supportedUsStateSchema = z.object({
    id: z.string(),
    name: z.string(),
    postalAbbreviation: z.string(),
    canSignUp: z.boolean(),
})

// Per-jurisdiction link group; we only read the T&C URL for now.
const settingsLinkGroupSchema = z
    .object({ termsAndConditions: z.string().optional().nullable() })
    .optional()
    .nullable()

export const registrationSettingsResponseSchema = z.object({
    countries: z.array(supportedCountrySchema).optional().nullable(),
    usStates: z.array(supportedUsStateSchema).optional().nullable(),
    links: z
        .object({
            us: settingsLinkGroupSchema,
            intl: settingsLinkGroupSchema,
        })
        .optional()
        .nullable(),
})
export type RegistrationSettingsApiResponse = z.infer<
    typeof registrationSettingsResponseSchema
>

// POST /v1/auth/register/email/send — returns the id later steps thread through.
export const sendEmailVerificationResponseSchema = z.object({
    contactVerificationId: z.string(),
})

// POST /v1/auth/register/email/verify — returns the onboarding id every later
// registration step requires. When the email already has an account Baanx
// answers 200 with `hasAccount: true` and a null onboardingId instead, so both
// are modelled as nullable/optional to tell those two success shapes apart.
export const verifyEmailResponseSchema = z.object({
    onboardingId: z.string().nullish(),
    hasAccount: z.boolean().nullish(),
})

// POST /v1/auth/register/verification — pre-auth (client key only); returns the
// Veriff session URL for the onboarding KYC step. The caller hands it to
// Linking.openURL, so the scheme is gated here.
export const registerVerificationResponseSchema = z.object({
    sessionUrl: httpsUrlSchema,
})
export type RegisterVerificationApiResponse = z.infer<
    typeof registerVerificationResponseSchema
>

// GET /v1/auth/register?onboardingId= — onboarding status. We model the KYC
// state the verification screen polls plus the profile fields used to prefill
// the personal-details form on resume; Zod strips the rest.
export const onboardingDetailsResponseSchema = z.object({
    // Nullish so an absent/null state resolves to `null` via toEnumValueOrNull
    // (same "unknown" bucket as an unmodelled string) instead of throwing.
    verificationState: z.string().nullish(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    /** ISO datetime, e.g. `1997-11-08T00:00:00.000Z`. */
    dateOfBirth: z.string().optional().nullable(),
    /** ISO 3166-1 alpha-2; null until the user provides it. */
    countryOfNationality: z.string().optional().nullable(),
})
export type OnboardingDetailsApiResponse = z.infer<
    typeof onboardingDetailsResponseSchema
>

// POST /v1/auth/register/address — the final registration step; issues the
// bearer token the authenticated user endpoints require. `accessToken` is null
// only when US AND isSameMailingAddress=false (a mailing address is still
// owed). `user.id` is the permanent userId the consent-link (PATCH) step needs;
// we model just that field of the larger `user` block.
export const addressResponseSchema = z.object({
    accessToken: z.string().nullable(),
    onboardingId: z.string(),
    user: z.object({ id: z.string() }).optional().nullable(),
})
export type AddressApiResponse = z.infer<typeof addressResponseSchema>

// POST /v2/consent/onboarding — returns the created consent set's id, which the
// link (PATCH) step binds to the user once the address step issues the userId.
export const consentResponseSchema = z.object({
    consentSetId: z.string(),
})
export type ConsentApiResponse = z.infer<typeof consentResponseSchema>

// POST /v1/card/funding-source — connects a Pera (Algorand) account as the
// card's funding source on the setup checklist. ASSUMPTION: the request/response
// shape is unverified (Baanx sandbox down), so it's mocked for now.
export const connectFundingSourceResponseSchema = z.object({
    fundingSourceId: z.string(),
})
export type ConnectFundingSourceApiResponse = z.infer<
    typeof connectFundingSourceResponseSchema
>
