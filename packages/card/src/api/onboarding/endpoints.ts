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

import { toEnumValue, type Network } from '@perawallet/wallet-core-shared'
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
export type OnboardingDetails = { verificationState: VerificationState }
/** Pre-auth onboarding status — polled to detect KYC completion. */
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
