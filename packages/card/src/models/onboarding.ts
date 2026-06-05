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

export const OnboardingStep = {
    EmailSend: 'EMAIL_SEND',
    EmailVerify: 'EMAIL_VERIFY',
    PhoneSend: 'PHONE_SEND',
    PhoneVerify: 'PHONE_VERIFY',
    PersonalDetails: 'PERSONAL_DETAILS',
    Address: 'ADDRESS',
    Verification: 'VERIFICATION',
    Completed: 'COMPLETED',
} as const
export type OnboardingStep =
    (typeof OnboardingStep)[keyof typeof OnboardingStep]

/** A signup-eligible country from GET /v1/auth/settings. */
export type SupportedCountry = {
    id: string
    /** ISO 3166-1 alpha-2. */
    iso3166alpha2: string
    name: string
    /** International dialing code without the leading '+'. */
    callingCode: string
    canSignUp: boolean
}

/** A US state from GET /v1/auth/settings (US environments only). */
export type SupportedUsState = {
    id: string
    name: string
    postalAbbreviation: string
    canSignUp: boolean
}

export type RegistrationSettings = {
    countries: SupportedCountry[]
    usStates: SupportedUsState[]
}

/** Veriff KYC session from GET /v1/user/verification. */
export type VeriffSession = {
    sessionUrl: string
}

export type PersonalDetailsInput = {
    onboardingId: string
    firstName: string
    lastName: string
    /** ISO date, YYYY-MM-DD. */
    dateOfBirth: string
    countryOfNationality: string
    /** US residents only. */
    ssn?: string
}

export type AddressInput = {
    onboardingId: string
    addressLine1: string
    addressLine2?: string
    city: string
    zip: string
    /** US residents only. */
    usState?: string
    /** When true, the mailing address equals the residential address. */
    isSameMailingAddress: boolean
}

/** Validation for the email-send onboarding step (email + country). */
export const emailSendSchema = z.object({
    email: z.string().trim().email(),
    /** ISO 3166-1 alpha-2 of the selected country of residence. */
    countryIso: z.string().length(2),
})

export type EmailSendFormValues = z.infer<typeof emailSendSchema>
