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
    toEnumValue,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { getCardApiError, isDuplicateError } from '../errors'
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

// Completes email verification AND sets the password / marketing consent in one
// call, per the spec; returns the onboarding id later steps require.
export type VerifyEmailParams = NetworkParams & {
    email: string
    password: string
    verificationCode: string
    contactVerificationId: string
    countryOfResidence: string
    allowMarketing?: boolean
    allowSms?: boolean
}
export type VerifyEmailResult = { onboardingId: string }
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
    return verifyEmailResponseSchema.parse(response.data)
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
    verificationState: VerificationState
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
        // Unknown/missing state falls back to Unverified — never report KYC
        // progress on a state we don't recognise.
        verificationState: toEnumValue(
            VerificationState,
            parsed.verificationState,
            VerificationState.Unverified,
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
// user endpoints, so we parse and return it rather than discarding the body
// via `postRegisterStep`.
export type SubmitAddressResult = {
    accessToken: string | null
    onboardingId: string
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
    return addressResponseSchema.parse(response.data)
}

// POST /v2/consent/onboarding. Jurisdiction policy: US residents use 'us',
// everyone else 'global'.
export type ConsentPolicyType = 'us' | 'global'

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
    /** The single marketing checkbox; drives all notification consents. */
    allowMarketing: boolean
}

/**
 * Maps the address-step checkboxes to Baanx's required consent set. Both
 * policies require terms + the three notification channels; `us` additionally
 * requires the e-sign consent.
 */
export const buildOnboardingConsentBody = (input: OnboardingConsentInput) => {
    const {
        onboardingId,
        tenantId,
        policyType,
        termsAccepted,
        allowMarketing,
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
            consentStatus: status(allowMarketing),
        },
        {
            consentType: 'emailNotifications',
            consentStatus: status(allowMarketing),
        },
        ...(policyType === 'us'
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

// Records the user's onboarding consents on the final address step. The tenant
// id is build-time config (per network), like the Baanx client key.
export type SubmitOnboardingConsentParams = NetworkParams &
    Omit<OnboardingConsentInput, 'tenantId'>
export const submitOnboardingConsent = async (
    params: SubmitOnboardingConsentParams,
): Promise<void> => {
    const { network, signal, ...rest } = params
    const body = buildOnboardingConsentBody({
        ...rest,
        tenantId: getNetworkConfig(network).baanxTenantId,
    })
    try {
        await postRegisterStep('/v2/consent/onboarding', body, {
            network,
            signal,
        })
    } catch (error) {
        // Consent is non-idempotent on Baanx: a retried submit (e.g. after the
        // address step failed and the user taps Continue again) returns
        // "Duplicate onboardingId". The consent set already exists — the desired
        // end state — so treat it as success and let the address step proceed.
        const apiError = await getCardApiError(error)
        if (isDuplicateError(apiError)) return
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
