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

import type {
    WalletProvisioningApplePayload,
    WalletProvisioningUserAddress,
} from '@perawallet/wallet-extension-platform'

/**
 * Raised while the Baanx provisioning-payload endpoints don't exist yet
 * (blocked on Apple/Google accreditation). Callers treat it as "native flow
 * can't complete" and fall back to the manual instructions sheet.
 */
export class ProvisioningPayloadUnavailableError extends Error {
    constructor() {
        super('Card provisioning payload endpoint is not available yet')
        this.name = 'ProvisioningPayloadUnavailableError'
    }
}

/** Apple hands these to the issuer, which returns the encrypted pass data. */
export type AppleProvisioningPayloadRequest = {
    nonce: string
    nonceSignature: string
    certificates: string[]
}

/** Everything Baanx must supply for Google push provisioning. */
export type GoogleProvisioningPayload = {
    /** Card network name the TapAndPay SDK expects, e.g. "MASTERCARD". */
    network: string
    /** Base64 opaque payment card blob from the issuer. */
    opaquePaymentCard: string
    cardHolderName: string
    userAddress: WalletProvisioningUserAddress
}

// TODO(card): implement against the backend proxy for Baanx's provisioning
// payload endpoints once accreditation lands — until then the native add flow
// is unreachable anyway (no Apple entitlement / TapAndPay allowlisting).
export const fetchAppleProvisioningPayload = (
    _request: AppleProvisioningPayloadRequest,
): Promise<WalletProvisioningApplePayload> =>
    Promise.reject(new ProvisioningPayloadUnavailableError())

export const fetchGoogleProvisioningPayload =
    (): Promise<GoogleProvisioningPayload> =>
        Promise.reject(new ProvisioningPayloadUnavailableError())
