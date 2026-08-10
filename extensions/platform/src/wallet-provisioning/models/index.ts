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

/** State of a payment card inside the OS wallet (Apple/Google Wallet). */
export type WalletProvisioningCardStatus =
    | 'not found'
    | 'requireActivation'
    | 'pending'
    | 'active'
    | 'suspended'
    | 'deactivated'

export type WalletProvisioningTokenizationStatus =
    | 'canceled'
    | 'success'
    | 'error'

export type WalletProvisioningAppleCardData = {
    /** Card network name the wallet expects, e.g. "MASTERCARD". */
    network: string
    cardHolderName: string
    lastDigits: string
    /** Display name shown in the OS wallet sheet. */
    cardDescription: string
}

/** Encrypted pass data the issuer returns for Apple in-app provisioning. */
export type WalletProvisioningApplePayload = {
    encryptedPassData: string
    activationData: string
    ephemeralPublicKey: string
}

export type WalletProvisioningUserAddress = {
    name: string
    addressOne: string
    addressTwo?: string
    administrativeArea: string
    locality: string
    countryCode: string
    postalCode: string
    phoneNumber: string
}

export type WalletProvisioningGoogleCardData = {
    network: string
    /** Base64 opaque payment card blob from the issuer. */
    opaquePaymentCard: string
    cardHolderName: string
    lastDigits: string
    userAddress: WalletProvisioningUserAddress
}

/**
 * Native push provisioning into the OS wallet. Only the React Native platform
 * has a real implementation; the probes report unavailable everywhere the
 * capability (or the native module itself) is missing, so callers can gate on
 * them without platform checks.
 */
export interface WalletProvisioningService {
    /** True when this build + device can push provision (gated by the Apple
     * entitlement / Google TapAndPay allowlisting). Never rejects — any
     * failure reports false. */
    checkWalletAvailability(): Promise<boolean>
    /** State of the card with this PAN suffix in the OS wallet. Never
     * rejects — any failure reports 'not found'. */
    getCardStatusBySuffix(
        last4Digits: string,
    ): Promise<WalletProvisioningCardStatus>
    /** Runs Apple's add-card sheet; the issuer callback supplies the
     * encrypted pass data mid-flow. Rejects when the native module is
     * missing. */
    addCardToAppleWallet(
        cardData: WalletProvisioningAppleCardData,
        issuerEncryptPayloadCallback: (
            nonce: string,
            nonceSignature: string,
            certificates: string[],
        ) => Promise<WalletProvisioningApplePayload>,
    ): Promise<WalletProvisioningTokenizationStatus>
    /** Runs Google's add-card flow from the issuer's opaque payment card
     * (required up front, unlike Apple). Rejects when the native module is
     * missing. */
    addCardToGoogleWallet(
        cardData: WalletProvisioningGoogleCardData,
    ): Promise<WalletProvisioningTokenizationStatus>
}
