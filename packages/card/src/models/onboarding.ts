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
import type { Nullable } from '@perawallet/wallet-core-shared'

// Declared in flow order: KYC (Verification) runs after phone verify and
// before personal details; address is the final step and issues the session.
export const OnboardingStep = {
    EmailSend: 'EMAIL_SEND',
    EmailVerify: 'EMAIL_VERIFY',
    PhoneSend: 'PHONE_SEND',
    PhoneVerify: 'PHONE_VERIFY',
    Verification: 'VERIFICATION',
    PersonalDetails: 'PERSONAL_DETAILS',
    Address: 'ADDRESS',
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
    /** Baanx-hosted T&C URLs by jurisdiction (US vs international). */
    termsAndConditionsUrls: {
        us: Nullable<string>
        intl: Nullable<string>
    }
}

/**
 * Geo-IP detected region from GET /v1/cards/supported-countries/ (Pera backend,
 * not Baanx). Used to preselect the user's country in the onboarding form.
 */
export type CurrentRegion = {
    /** ISO 3166-1 alpha-2. */
    iso3166alpha2: string
    name: string
}

/**
 * Veriff KYC session. During onboarding it comes from the pre-auth
 * POST /v1/auth/register/verification; post-login re-verification uses
 * GET /v1/user/verification.
 */
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

/** Validation for the Pera Card sign-in (login) screen. */
export const signInSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
})

export type SignInFormValues = z.infer<typeof signInSchema>

/** Validation for the forgot-password email screen. */
export const forgotPasswordEmailSchema = z.object({
    email: z.string().trim().email(),
})

export type ForgotPasswordEmailFormValues = z.infer<
    typeof forgotPasswordEmailSchema
>

/** Validation for the phone-send onboarding step (calling code + number). */
export const phoneSendSchema = z.object({
    /** International dialing code, digits only, no leading '+'. */
    phoneCountryCode: z.string().min(1).regex(/^\d+$/),
    /** National phone number, digits only. */
    phoneNumber: z.string().trim().min(4).regex(/^\d+$/),
})

export type PhoneSendFormValues = z.infer<typeof phoneSendSchema>

/**
 * "Special character" = any non-alphanumeric character. Extracted into a named
 * constant so the password rule reads clearly — inline, the negated class is
 * easy to misread as having no special-character provision at all.
 *
 * NOTE: Baanx hasn't published its exact allowed set, so this is intentionally
 * broad to match the rule shown to the user. Tighten if the backend specifies one.
 */
const PASSWORD_SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9]/

/**
 * The individual password rules, in display order. Exported so the Create
 * Password screen's live checklist and the schema below stay in lockstep — a
 * single source of truth for "what makes a valid password". Mirrors Baanx's
 * rules: at least 15 chars with an uppercase, a lowercase, a number, and a
 * special character. (Baanx also advises avoiding common passwords; that's
 * surfaced as guidance on the screen but not enforced here.)
 */
export const PASSWORD_RULES = [
    { id: 'length', test: (value: string): boolean => value.length >= 15 },
    { id: 'uppercase', test: (value: string): boolean => /[A-Z]/.test(value) },
    { id: 'lowercase', test: (value: string): boolean => /[a-z]/.test(value) },
    { id: 'number', test: (value: string): boolean => /[0-9]/.test(value) },
    {
        id: 'special',
        test: (value: string): boolean =>
            PASSWORD_SPECIAL_CHARACTER_REGEX.test(value),
    },
] as const

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]['id']

/** Password field schema, derived from {@link PASSWORD_RULES} so the two agree. */
const passwordFieldSchema = z.string().superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
        if (!rule.test(value)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `password-${rule.id}`,
            })
        }
    }
})

/**
 * Validation for the password the user sets during email verification.
 * `password` must satisfy every {@link PASSWORD_RULES} entry and
 * `confirmPassword` must match.
 */
export const passwordSetSchema = z
    .object({
        password: passwordFieldSchema,
        confirmPassword: z.string(),
    })
    .refine(values => values.password === values.confirmPassword, {
        message: 'passwords-must-match',
        path: ['confirmPassword'],
    })

export type PasswordSetFormValues = z.infer<typeof passwordSetSchema>

/** Display format for the date of birth field, e.g. `27/02/1986`. */
const DOB_DISPLAY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** Oldest plausible birth year; anything earlier is treated as a typo. */
const DOB_MIN_YEAR = 1900

/**
 * True when a `DD/MM/YYYY` string is a real, non-future calendar date no earlier
 * than 1900. Round-trips through `Date` so impossible dates (e.g. `31/02/1990`)
 * are rejected. The 18+ minimum-age rule is enforced by Baanx, not here.
 */
const isValidPastDob = (value: string): boolean => {
    const match = DOB_DISPLAY_REGEX.exec(value)
    if (!match) return false
    const [, dd, mm, yyyy] = match
    const day = Number(dd)
    const month = Number(mm)
    const year = Number(yyyy)
    if (year < DOB_MIN_YEAR) return false
    const date = new Date(year, month - 1, day)
    const isRealDate =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    return isRealDate && date.getTime() <= Date.now()
}

/** Validation for the personal-details onboarding step. */
export const personalDetailsSchema = z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    /** Display format `DD/MM/YYYY`; converted to ISO before submission. */
    dateOfBirth: z.string().refine(isValidPastDob),
    /** ISO 3166-1 alpha-2 of the selected nationality. */
    countryOfNationality: z.string().length(2),
})

export type PersonalDetailsFormValues = z.infer<typeof personalDetailsSchema>

/**
 * Masks raw keyboard input into the `DD/MM/YYYY` shape as the user types: keeps
 * digits only, inserts `/` after the day and month, and caps at 8 digits.
 */
export const formatDobInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    return parts.filter(part => part.length > 0).join('/')
}

/** Converts a validated `DD/MM/YYYY` string to the API's ISO `YYYY-MM-DD`. */
export const dobToIsoDate = (ddmmyyyy: string): string => {
    const [dd, mm, yyyy] = ddmmyyyy.split('/')
    return `${yyyy}-${mm}-${dd}`
}

/**
 * Converts an ISO date or datetime (e.g. `1997-11-08T00:00:00.000Z`) to the
 * `DD/MM/YYYY` display format. String-only (never `new Date`) so the day can't
 * shift across timezones — the server stores a pure birth date.
 */
export const isoDateToDob = (iso: string): string => {
    const [yyyy, mm, dd] = iso.slice(0, 10).split('-')
    return `${dd}/${mm}/${yyyy}`
}

/** ISO 3166-1 alpha-2 of the United States; the only jurisdiction needing a state. */
const US_ISO = 'US'

/**
 * Validation for the residential-address onboarding step. `countryIso` is the
 * editable residence country — it drives the US-state requirement but is NOT
 * part of the address request (the API derives it from the onboarding session).
 * `usState` is required only for US residents.
 */
export const addressSchema = z
    .object({
        countryIso: z.string().length(2),
        addressLine1: z.string().trim().min(1),
        addressLine2: z.string().trim().optional(),
        city: z.string().trim().min(1),
        zip: z.string().trim().min(1),
        usState: z.string().optional(),
    })
    .superRefine((values, ctx) => {
        if (values.countryIso === US_ISO && !values.usState) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['usState'],
                message: 'us-state-required',
            })
        }
    })

export type AddressFormValues = z.infer<typeof addressSchema>
