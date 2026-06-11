/*
 Copyright 2022-2025 Pera Wallet, LDA
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

// GET /v1/auth/settings. We model the country/state lists the signup UI needs;
// the rich `links`/`config` blocks are ignored for now.
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

export const registrationSettingsResponseSchema = z.object({
    countries: z.array(supportedCountrySchema).optional().nullable(),
    usStates: z.array(supportedUsStateSchema).optional().nullable(),
})
export type RegistrationSettingsApiResponse = z.infer<
    typeof registrationSettingsResponseSchema
>

// POST /v1/auth/register/email/send — returns the id later steps thread through.
export const sendEmailVerificationResponseSchema = z.object({
    contactVerificationId: z.string(),
})

// POST /v1/auth/register/email/verify — returns the onboarding id every later
// registration step requires.
export const verifyEmailResponseSchema = z.object({
    onboardingId: z.string(),
})

// POST /v1/auth/register/address — issues the bearer token the post-address
// authenticated calls (GET /v1/user, GET /v1/user/verification) require.
// `accessToken` is null only when US AND isSameMailingAddress=false (a mailing
// address is still owed). The response also carries a `user` block, but the
// verification step reads `verificationState` from GET /v1/user, so we don't
// re-model it here.
export const addressResponseSchema = z.object({
    accessToken: z.string().nullable(),
    onboardingId: z.string(),
})
export type AddressApiResponse = z.infer<typeof addressResponseSchema>
