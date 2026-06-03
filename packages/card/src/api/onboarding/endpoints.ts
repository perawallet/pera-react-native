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

import type { Network } from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import type {
    AddressInput,
    PersonalDetailsInput,
    RegistrationSettings,
} from '../../models'
import { registrationSettingsResponseSchema } from './schema'
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
export const sendEmailVerification = async (
    params: SendEmailVerificationParams,
): Promise<void> => {
    await postRegisterStep(
        '/v1/auth/register/email/send',
        { email: params.email },
        params,
    )
}

// Completes email verification AND sets the password / marketing consent in one
// call, per the spec.
export type VerifyEmailParams = NetworkParams & {
    email: string
    password: string
    verificationCode: string
    contactVerificationId: string
    countryOfResidence: string
    allowMarketing?: boolean
    allowSms?: boolean
}
export const verifyEmail = async (params: VerifyEmailParams): Promise<void> => {
    const { network, signal, ...body } = params
    await postRegisterStep('/v1/auth/register/email/verify', body, {
        network,
        signal,
    })
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

export type SubmitAddressParams = NetworkParams & { address: AddressInput }
export const submitAddress = async (
    params: SubmitAddressParams,
): Promise<void> => {
    await postRegisterStep('/v1/auth/register/address', params.address, params)
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
