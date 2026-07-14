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

import {
    toEnumValueOrNull,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { getCardApiError, isConflictError, isDuplicateError } from '../errors'
import { getCardTransport } from '../transport'
import { VerificationState } from '../../models'
import type {
    AddressInput,
    PersonalDetailsInput,
    RegistrationSettings,
    VeriffSession,
} from '../../models'
import {
    addressResponseSchema,
    connectFundingSourceResponseSchema,
    consentResponseSchema,
    onboardingDetailsResponseSchema,
    registerVerificationResponseSchema,
    registrationSettingsResponseSchema,
    sendEmailVerificationResponseSchema,
    verifyEmailResponseSchema,
} from './schema'
import { transformRegistrationSettings } from './transformers'

type NetworkParams = {
    network: Network
    signal?: AbortSignal
}

const postRegisterStep = <TData>(
    path: string,
    data: TData,
    { network, signal }: NetworkParams,
): Promise<unknown> =>
    getCardTransport().request({ network, method: 'POST', path, data, signal })

export type SendEmailVerificationParams = NetworkParams & { email: string }
export type SendEmailVerificationResult = { contactVerificationId: string }
export const sendEmailVerification = async (
    params: SendEmailVerificationParams,
): Promise<SendEmailVerificationResult> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: '/v1/auth/register/email/send',
        data: { email: params.email },
        signal: params.signal,
    })
    return sendEmailVerificationResponseSchema.parse(response.data)
}

// Completes email verification AND sets the password / consent flags in one
// call, per the spec; returns the onboarding id later steps require. Baanx
// requires both `allowMarketing` and `allowSms` here (they're collected on the
// Set-Password screen), so they're modelled as required, not optional.
export type VerifyEmailParams = NetworkParams & {
    email: string
    password: string
    verificationCode: string
    contactVerificationId: string
    countryOfResidence: string
    allowMarketing: boolean
    allowSms: boolean
}
export type VerifyEmailResult = {
    /** Null when the email already has an account (see `hasAccount`). */
    onboardingId: Nullable<string>
    /** True when the email is already registered — the caller routes to sign-in. */
    hasAccount: boolean
}
export const verifyEmail = async (
    params: VerifyEmailParams,
): Promise<VerifyEmailResult> => {
    const { network, signal, ...body } = params
    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/auth/register/email/verify',
        data: body,
        signal,
    })
    const parsed = verifyEmailResponseSchema.parse(response.data)
    return {
        onboardingId: parsed.onboardingId ?? null,
        hasAccount: parsed.hasAccount ?? false,
    }
}

export type SendPhoneVerificationParams = NetworkParams & {
    phoneCountryCode: string
    phoneNumber: string
    contactVerificationId: string
}
export const sendPhoneVerification = async (
    params: SendPhoneVerificationParams,
): Promise<void> => {
    const { network, signal, ...body } = params
    await postRegisterStep('/v1/auth/register/phone/send', body, {
        network,
        signal,
    })
}

export type VerifyPhoneParams = NetworkParams & {
    onboardingId: string
    phoneCountryCode: string
    phoneNumber: string
    contactVerificationId: string
    verificationCode: string
}
export const verifyPhone = async (params: VerifyPhoneParams): Promise<void> => {
    const { network, signal, ...body } = params
    await postRegisterStep('/v1/auth/register/phone/verify', body, {
        network,
        signal,
    })
}

export type SubmitPersonalDetailsParams = NetworkParams & {
    details: PersonalDetailsInput
}
export const submitPersonalDetails = async (
    params: SubmitPersonalDetailsParams,
): Promise<void> => {
    await postRegisterStep(
        '/v1/auth/register/personal-details',
        params.details,
        params,
    )
}

export type StartRegisterVerificationParams = NetworkParams & {
    onboardingId: string
}
/**
 * Starts the onboarding KYC session (step 3 of registration, after phone
 * verification). Pre-auth — only the client key is required. The caller opens
 * the returned Veriff `sessionUrl`, then polls `fetchOnboardingDetails` for the
 * `verificationState` to transition.
 */
export const startRegisterVerification = async (
    params: StartRegisterVerificationParams,
): Promise<VeriffSession> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: '/v1/auth/register/verification',
        data: { onboardingId: params.onboardingId },
        signal: params.signal,
    })
    return registerVerificationResponseSchema.parse(response.data)
}

export type FetchOnboardingDetailsParams = NetworkParams & {
    onboardingId: string
}
export type OnboardingDetails = {
    /**
     * Modelled KYC state; null when Baanx returns a state we don't model, so
     * consumers can tell "not yet verified" from "unknown server state".
     */
    verificationState: Nullable<VerificationState>
    /** Profile fields prefilled into the personal-details form when present. */
    firstName: Nullable<string>
    lastName: Nullable<string>
    /** ISO datetime as returned by Baanx; the date part is the birth date. */
    dateOfBirth: Nullable<string>
    /** ISO 3166-1 alpha-2; null until the user provides it. */
    countryOfNationality: Nullable<string>
}
/** Pre-auth onboarding status — polled for KYC and read to prefill the form. */
export const fetchOnboardingDetails = async (
    params: FetchOnboardingDetailsParams,
): Promise<OnboardingDetails> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'GET',
        path: '/v1/auth/register',
        params: { onboardingId: params.onboardingId },
        signal: params.signal,
    })
    const parsed = onboardingDetailsResponseSchema.parse(response.data)
    return {
        // An unrecognised state maps to null, not UNVERIFIED — coercing would
        // eventually route a progressing user into re-minting a Veriff session.
        verificationState: toEnumValueOrNull(
            VerificationState,
            parsed.verificationState,
        ),
        firstName: parsed.firstName ?? null,
        lastName: parsed.lastName ?? null,
        dateOfBirth: parsed.dateOfBirth ?? null,
        countryOfNationality: parsed.countryOfNationality ?? null,
    }
}

export type SubmitAddressParams = NetworkParams & { address: AddressInput }
// The final registration step. Unlike the other register steps its response
// matters: it carries the `accessToken` that authenticates the post-onboarding
// user endpoints plus the permanent `userId` the consent-link step binds to, so
// we parse and return them rather than discarding the body via `postRegisterStep`.
export type SubmitAddressResult = {
    accessToken: string | null
    onboardingId: string
    /** Permanent user id (`user.id`); null until Baanx returns the user block. */
    userId: string | null
}
export const submitAddress = async (
    params: SubmitAddressParams,
): Promise<SubmitAddressResult> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: '/v1/auth/register/address',
        data: params.address,
        signal: params.signal,
    })
    const parsed = addressResponseSchema.parse(response.data)
    return {
        accessToken: parsed.accessToken,
        onboardingId: parsed.onboardingId,
        userId: parsed.user?.id ?? null,
    }
}

// POST /v2/consent/onboarding. Jurisdiction policy: US residents use 'US',
// everyone else 'global'. Casing must match Baanx's enum exactly ('US' | 'global').
export type ConsentPolicyType = 'US' | 'global'

type ConsentType =
    | 'termsAndPrivacy'
    | 'marketingNotifications'
    | 'smsNotifications'
    | 'emailNotifications'
    | 'eSignAct'
type Consent = {
    consentType: ConsentType
    consentStatus: 'granted' | 'denied'
}

export type OnboardingConsentInput = {
    onboardingId: string
    tenantId: string
    policyType: ConsentPolicyType
    /** Both T&C boxes accepted (they gate the Continue button). */
    termsAccepted: boolean
    /** Marketing opt-in (from the Set-Password screen); drives marketing + email. */
    allowMarketing: boolean
    /** SMS opt-in (from the Set-Password screen); drives the SMS consent. */
    allowSms: boolean
}

/**
 * Maps the address-step checkboxes to Baanx's required consent set. Both
 * policies require terms + the three notification channels; `US` additionally
 * requires the e-sign consent.
 */
export const buildOnboardingConsentBody = (input: OnboardingConsentInput) => {
    const {
        onboardingId,
        tenantId,
        policyType,
        termsAccepted,
        allowMarketing,
        allowSms,
    } = input
    const status = (granted: boolean): Consent['consentStatus'] =>
        granted ? 'granted' : 'denied'
    const consents: Consent[] = [
        {
            consentType: 'termsAndPrivacy',
            consentStatus: status(termsAccepted),
        },
        {
            consentType: 'marketingNotifications',
            consentStatus: status(allowMarketing),
        },
        {
            consentType: 'smsNotifications',
            consentStatus: status(allowSms),
        },
        {
            consentType: 'emailNotifications',
            consentStatus: status(allowMarketing),
        },
        ...(policyType === 'US'
            ? [
                  {
                      consentType: 'eSignAct' as const,
                      consentStatus: status(termsAccepted),
                  },
              ]
            : []),
    ]
    return { onboardingId, tenantId, policyType, consents }
}

// Step 1 of Baanx's two-step consent flow: create the consent set during
// registration (before the address step). The tenant id is build-time config
// (per network), like the Baanx client key. Returns the `consentSetId` the link
// step (below) binds to the user once the address step issues the userId.
export type SubmitOnboardingConsentParams = NetworkParams &
    Omit<OnboardingConsentInput, 'tenantId'>
export type SubmitOnboardingConsentResult = {
    /** Null when Baanx omitted it (e.g. a duplicate-onboardingId retry). */
    consentSetId: string | null
}
export const submitOnboardingConsent = async (
    params: SubmitOnboardingConsentParams,
): Promise<SubmitOnboardingConsentResult> => {
    const { network, signal, ...rest } = params
    const body = buildOnboardingConsentBody({
        ...rest,
        tenantId: getNetworkConfig(network).baanxTenantId,
    })
    try {
        const response = await postRegisterStep(
            '/v2/consent/onboarding',
            body,
            { network, signal },
        )
        // Lenient: the consentSetId is best-effort (the link step skips when it's
        // absent), so an unexpected body shape must not fail the address finalize.
        const parsed = consentResponseSchema.safeParse(
            (response as { data?: unknown }).data,
        )
        return {
            consentSetId: parsed.success ? parsed.data.consentSetId : null,
        }
    } catch (error) {
        // Consent creation is non-idempotent on Baanx: a retried submit (e.g.
        // after the address step failed and the user taps Continue again)
        // returns "Duplicate onboardingId". The consent set already exists — the
        // desired end state — so treat it as success. We have no id to return
        // here; the link step falls back to the one stashed on the first create.
        const apiError = await getCardApiError(error)
        if (isDuplicateError(apiError)) return { consentSetId: null }
        throw error
    }
}

// Step 2 of Baanx's two-step consent flow: link the consent set created above to
// the permanent user id the address step issues. Idempotent — Baanx returns 409
// Conflict if the set is already linked (the desired end state), which we swallow.
// Deliberately NOT `authenticated`: per the Baanx api-reference
// (api-reference/consent/link-user-to-consent) this endpoint uses API-key
// headers only — no user Bearer — even though it runs after the token exists.
export type LinkOnboardingConsentParams = NetworkParams & {
    consentSetId: string
    userId: string
}
export const linkOnboardingConsent = async (
    params: LinkOnboardingConsentParams,
): Promise<void> => {
    const { network, signal, consentSetId, userId } = params
    try {
        await getCardTransport().request({
            network,
            method: 'PATCH',
            path: `/v2/consent/onboarding/${consentSetId}`,
            data: { userId },
            signal,
        })
    } catch (error) {
        const apiError = await getCardApiError(error)
        if (isConflictError(apiError)) return
        throw error
    }
}

// Connects a Pera (Algorand) account as the card's funding source on the setup
// checklist's Connect Funds step. Authenticated (the transport attaches the
// bearer issued by the address step). ASSUMPTION: the exact contract is pending
// the live Baanx API (sandbox down) — it's mocked in installCardDevMocks for now.
export type ConnectFundingSourceParams = NetworkParams & { address: string }
export type ConnectFundingSourceResult = { fundingSourceId: string }
export const connectFundingSource = async (
    params: ConnectFundingSourceParams,
): Promise<ConnectFundingSourceResult> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: '/v1/card/funding-source',
        authenticated: true,
        data: { address: params.address },
        signal: params.signal,
    })
    return connectFundingSourceResponseSchema.parse(response.data)
}

export const fetchRegistrationSettings = async (
    params: NetworkParams,
): Promise<RegistrationSettings> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'GET',
        path: '/v1/auth/settings',
        signal: params.signal,
    })
    return transformRegistrationSettings(
        registrationSettingsResponseSchema.parse(response.data),
    )
}
