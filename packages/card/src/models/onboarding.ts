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

// Declared in flow order, which is the fallback when Baanx sends no `phase`:
// the forms come first, KYC runs once they are in, and the account (and the
// session) only exists after KYC verifies.
export const OnboardingStep = {
    EmailSend: 'EMAIL_SEND',
    EmailVerify: 'EMAIL_VERIFY',
    PhoneSend: 'PHONE_SEND',
    PhoneVerify: 'PHONE_VERIFY',
    PersonalDetails: 'PERSONAL_DETAILS',
    /** BoP residents only; Baanx asks for it through `phase`. */
    AdditionalDetails: 'ADDITIONAL_DETAILS',
    Address: 'ADDRESS',
    /** US residents shipping the card somewhere other than their residence. */
    MailingAddress: 'MAILING_ADDRESS',
    Verification: 'VERIFICATION',
    Completed: 'COMPLETED',
} as const
export type OnboardingStep =
    (typeof OnboardingStep)[keyof typeof OnboardingStep]

/** Card issuer serving a country's residents, from GET /v1/auth/settings. */
export const CardProvider = {
    Monavate: 'monavate',
    Galileo: 'galileo',
    ConnectFinancial: 'connect_financial',
} as const
export type CardProvider = (typeof CardProvider)[keyof typeof CardProvider]

/** A signup-eligible country from GET /v1/auth/settings. */
export type SupportedCountry = {
    id: string
    /** ISO 3166-1 alpha-2. */
    iso3166alpha2: string
    name: string
    /** International dialing code without the leading '+'. */
    callingCode: string
    canSignUp: boolean
    /** Null when Baanx sends none or a provider we don't model. */
    cardProvider: Nullable<CardProvider>
}

/**
 * A `{ key, name }` choice from GET /v1/auth/settings. The key is what the
 * register endpoints accept; `name` is Baanx's English label, shown verbatim.
 */
export type RegistrationOption = {
    key: string
    name: string
}

/** A US state from GET /v1/auth/settings (US environments only). */
export type SupportedUsState = {
    id: string
    name: string
    postalAbbreviation: string
    canSignUp: boolean
}

/** The settings lists made of {@link RegistrationOption}s. */
export type RegistrationOptionList =
    | 'occupations'
    | 'sourcesOfWealth'
    | 'businessSectors'
    | 'employmentSectors'
    | 'employmentStatuses'

export type RegistrationSettings = {
    countries: SupportedCountry[]
    usStates: SupportedUsState[]
    occupations: RegistrationOption[]
    sourcesOfWealth: RegistrationOption[]
    businessSectors: RegistrationOption[]
    employmentSectors: RegistrationOption[]
    employmentStatuses: RegistrationOption[]
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
 * Hosted KYC (Sumsub) session. Before the account exists it comes from the
 * pre-auth POST /v1/auth/register/verification; with a session, from
 * GET /v1/user/verification.
 */
export type KycSession = {
    sessionUrl: string
}

export type PersonalDetailsInput = {
    onboardingId: string
    firstName: string
    /** As on the identity document; improves the KYC name match. */
    middleName?: string
    lastName: string
    /** ISO date, YYYY-MM-DD. */
    dateOfBirth: string
    countryOfNationality: string
    /**
     * ISO 3166-1 alpha-2. Baanx requires it for European/UK residents; sent
     * for everyone since the form preselects it from the residence country.
     */
    countryOfBirth: string
    /** ISO 3166-1 alpha-2, up to two besides `countryOfNationality`. */
    additionalNationalities?: string[]
    /** Portugal residents only. */
    portugalInvestmentScheme?: boolean
    /**
     * Keys from `employmentSectors` / `employmentStatuses` in the settings;
     * omitted when the environment lists none.
     */
    employmentSector?: string
    employmentStatus?: string
    /** US residents only. */
    ssn?: string
}

/** Occupation key that requires `occupationOther`. */
export const OTHER_OCCUPATION_KEY = 'other_specify_occupation'
/** Source-of-wealth key that requires `sourceOfWealthOther`. */
export const OTHER_SOURCE_OF_WEALTH_KEY = 'other_specify_source_of_wealth'

/** BoP residents only, after personal details (`phase` = `ADDITIONAL_DETAILS`). */
export type AdditionalDetailsInput = {
    onboardingId: string
    /** Tax identification number, at most 20 characters. */
    tin: string
    /** ISO 3166-1 alpha-2 of the issuing country; Baanx rejects `US`. */
    tinCountry: string
    /**
     * Keys from the matching GET /v1/auth/settings lists; omitted when the
     * environment lists none.
     */
    occupation?: string
    /** Only with {@link OTHER_OCCUPATION_KEY}. */
    occupationOther?: string
    sourceOfWealth?: string
    /** Only with {@link OTHER_SOURCE_OF_WEALTH_KEY}. */
    sourceOfWealthOther?: string
    businessSector?: string
    /** One of {@link EstimatedAnnualIncome}. */
    estimatedAnnualIncome: string
    /** ISO 3166-1 alpha-2, one to three. */
    incomeCountries: string[]
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

/** US residents shipping the card somewhere other than their residence. */
export type MailingAddressInput = {
    onboardingId: string
    addressLine1: string
    addressLine2?: string
    city: string
    zip: string
    usState: string
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

/** Baanx accepts letters, spaces, apostrophes and hyphens in a middle name. */
const MIDDLE_NAME_REGEX = /^[\p{L}\p{M} '’-]*$/u
const MIDDLE_NAME_MAX_LENGTH = 50
const MAX_ADDITIONAL_NATIONALITIES = 2

/** Validation for the personal-details onboarding step. */
const personalDetailsBaseSchema = z.object({
    firstName: z.string().trim().min(1),
    /** Optional; empty means none. */
    middleName: z
        .string()
        .trim()
        .max(MIDDLE_NAME_MAX_LENGTH)
        .regex(MIDDLE_NAME_REGEX),
    lastName: z.string().trim().min(1),
    /** Display format `DD/MM/YYYY`; converted to ISO before submission. */
    dateOfBirth: z.string().refine(isValidPastDob),
    /** ISO 3166-1 alpha-2 of the selected nationality. */
    countryOfNationality: z.string().length(2),
    /** ISO 3166-1 alpha-2 of the birth country (required by Baanx for EU/UK). */
    countryOfBirth: z.string().length(2),
    additionalNationalities: z
        .array(z.string().length(2))
        .max(MAX_ADDITIONAL_NATIONALITIES),
    /** Only sent for Portugal residents. */
    portugalInvestmentScheme: z.boolean(),
    /** Empty when the environment lists no options. */
    employmentStatus: z.string(),
    employmentSector: z.string(),
    /** Display format `XXX-XX-XXXX`; empty unless the residence is the US. */
    ssn: z.string(),
})

const SSN_DISPLAY_PATTERN = /^\d{3}-\d{2}-\d{4}$/

/**
 * Baanx requires the SSN only for US residents, so the requirement is decided
 * by the residence rather than by the record itself. Employment is required
 * only where the environment lists options for it.
 */
export const createPersonalDetailsSchema = ({
    isUsResident,
    hasEmploymentStatuses,
    hasEmploymentSectors,
}: {
    isUsResident: boolean
    hasEmploymentStatuses: boolean
    hasEmploymentSectors: boolean
}) =>
    personalDetailsBaseSchema.superRefine((values, ctx) => {
        if (hasEmploymentStatuses && !values.employmentStatus) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['employmentStatus'],
                message: 'employment-status-required',
            })
        }
        if (hasEmploymentSectors && !values.employmentSector) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['employmentSector'],
                message: 'employment-sector-required',
            })
        }
        if (isUsResident && !SSN_DISPLAY_PATTERN.test(values.ssn)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['ssn'],
                message: 'ssn-invalid',
            })
        }
        const nationalities = [
            values.countryOfNationality,
            ...values.additionalNationalities,
        ]
        if (new Set(nationalities).size !== nationalities.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['additionalNationalities'],
                message: 'nationality-duplicate',
            })
        }
    })

export const personalDetailsSchema = createPersonalDetailsSchema({
    isUsResident: false,
    hasEmploymentStatuses: true,
    hasEmploymentSectors: true,
})

export type PersonalDetailsFormValues = z.infer<
    typeof personalDetailsBaseSchema
>

/** Masks raw input into `XXX-XX-XXXX`: digits only, capped at 9. */
export const formatSsnInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 9)
    const parts = [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 9)]
    return parts.filter(part => part.length > 0).join('-')
}

/** The API takes the nine digits without separators. */
export const ssnToApi = (display: string): string => display.replace(/\D/g, '')

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

/** ISO 3166-1 alpha-2 of the United States; the only jurisdiction needing a state and an SSN. */
export const US_ISO = 'US'

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

/** The mailing step exists only for US residents, so the state is always required. */
export const mailingAddressSchema = z.object({
    addressLine1: z.string().trim().min(1),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().min(1),
    zip: z.string().trim().min(1),
    usState: z.string().min(1),
})

export type MailingAddressFormValues = z.infer<typeof mailingAddressSchema>

/**
 * Baanx's annual income bands, in display order and always shown in USD. Its
 * spec only shows `between_20k_and_50k`; the other keys follow that pattern
 * and are unconfirmed.
 */
export const EstimatedAnnualIncome = {
    LessThan20k: 'less_than_20k',
    Between20kAnd50k: 'between_20k_and_50k',
    Between50kAnd100k: 'between_50k_and_100k',
    MoreThan100k: 'more_than_100k',
} as const
export type EstimatedAnnualIncome =
    (typeof EstimatedAnnualIncome)[keyof typeof EstimatedAnnualIncome]

export const ESTIMATED_ANNUAL_INCOME_BANDS: readonly EstimatedAnnualIncome[] =
    Object.values(EstimatedAnnualIncome)

export const isEstimatedAnnualIncome = (
    value: unknown,
): value is EstimatedAnnualIncome =>
    ESTIMATED_ANNUAL_INCOME_BANDS.includes(value as EstimatedAnnualIncome)

// Typed boolean so zod keeps the field a string (TS infers a guard from a bare
// arrow): the form starts blank until a band is picked.
export const estimatedAnnualIncomeSchema = z
    .string()
    .refine((value): boolean => isEstimatedAnnualIncome(value))

const TIN_MAX_LENGTH = 20
const OTHER_TEXT_MAX_LENGTH = 100
const MAX_INCOME_COUNTRIES = 3

const additionalDetailsBaseSchema = z.object({
    tin: z.string().trim().min(1).max(TIN_MAX_LENGTH),
    tinCountry: z.string().length(2),
    /** Option keys; empty when the environment lists no options. */
    occupation: z.string(),
    /** Empty unless the occupation is {@link OTHER_OCCUPATION_KEY}. */
    occupationOther: z.string().trim().max(OTHER_TEXT_MAX_LENGTH),
    sourceOfWealth: z.string(),
    /** Empty unless the source is {@link OTHER_SOURCE_OF_WEALTH_KEY}. */
    sourceOfWealthOther: z.string().trim().max(OTHER_TEXT_MAX_LENGTH),
    businessSector: z.string(),
    estimatedAnnualIncome: estimatedAnnualIncomeSchema,
    incomeCountries: z
        .array(z.string().length(2))
        .min(1)
        .max(MAX_INCOME_COUNTRIES),
})

/**
 * Validation for the additional-details onboarding step. Like employment in
 * personal details, an option is required only where the environment lists
 * options for it.
 */
export const createAdditionalDetailsSchema = ({
    hasOccupations,
    hasSourcesOfWealth,
    hasBusinessSectors,
}: {
    hasOccupations: boolean
    hasSourcesOfWealth: boolean
    hasBusinessSectors: boolean
}) =>
    additionalDetailsBaseSchema.superRefine((values, ctx) => {
        const requiredOptions = [
            ['occupation', hasOccupations, 'occupation-required'],
            ['sourceOfWealth', hasSourcesOfWealth, 'source-of-wealth-required'],
            ['businessSector', hasBusinessSectors, 'business-sector-required'],
        ] as const
        for (const [field, isListed, message] of requiredOptions) {
            if (isListed && !values[field]) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [field],
                    message,
                })
            }
        }
        if (values.tinCountry === US_ISO) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['tinCountry'],
                message: 'tin-country-unsupported',
            })
        }
        if (
            values.occupation === OTHER_OCCUPATION_KEY &&
            !values.occupationOther
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['occupationOther'],
                message: 'occupation-other-required',
            })
        }
        if (
            values.sourceOfWealth === OTHER_SOURCE_OF_WEALTH_KEY &&
            !values.sourceOfWealthOther
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['sourceOfWealthOther'],
                message: 'source-of-wealth-other-required',
            })
        }
        if (
            new Set(values.incomeCountries).size !==
            values.incomeCountries.length
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['incomeCountries'],
                message: 'income-country-duplicate',
            })
        }
    })

export const additionalDetailsSchema = createAdditionalDetailsSchema({
    hasOccupations: true,
    hasSourcesOfWealth: true,
    hasBusinessSectors: true,
})

export type AdditionalDetailsFormValues = z.infer<
    typeof additionalDetailsBaseSchema
>
