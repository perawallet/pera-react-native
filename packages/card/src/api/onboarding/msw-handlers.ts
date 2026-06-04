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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    registrationSettingsResponseSchema,
    type RegistrationSettingsApiResponse,
} from './schema'

const successPost = (path: string): HttpHandler =>
    http.post(path, () => HttpResponse.json({ success: true }))

export const mockSendEmailVerification = (): HttpHandler =>
    successPost('*/v1/auth/register/email/send')
export const mockVerifyEmail = (): HttpHandler =>
    successPost('*/v1/auth/register/email/verify')
export const mockSendPhoneVerification = (): HttpHandler =>
    successPost('*/v1/auth/register/phone/send')
export const mockVerifyPhone = (): HttpHandler =>
    successPost('*/v1/auth/register/phone/verify')
export const mockSubmitPersonalDetails = (): HttpHandler =>
    successPost('*/v1/auth/register/personal-details')
export const mockSubmitAddress = (): HttpHandler =>
    successPost('*/v1/auth/register/address')

export type MockGetRegistrationSettingsParams = {
    response: RegistrationSettingsApiResponse
    status?: number
}
export const mockGetRegistrationSettings = ({
    response,
    status = 200,
}: MockGetRegistrationSettingsParams): HttpHandler => {
    validateMockResponse(
        registrationSettingsResponseSchema,
        response,
        'mockGetRegistrationSettings',
    )
    return http.get('*/v1/auth/settings', () =>
        HttpResponse.json(response, { status }),
    )
}
