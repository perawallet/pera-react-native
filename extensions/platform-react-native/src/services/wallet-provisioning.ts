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
    WalletProvisioningAppleCardData,
    WalletProvisioningApplePayload,
    WalletProvisioningCardStatus,
    WalletProvisioningGoogleCardData,
    WalletProvisioningService,
    WalletProvisioningTokenizationStatus,
} from '@perawallet/wallet-extension-platform'

// @expensify/react-native-wallet constructs a NativeEventEmitter at module
// scope, which throws on iOS when the binary doesn't bundle the RNWallet
// TurboModule (e.g. a dev client built before the dependency landed) — an
// eager import would crash the whole app at boot. Load lazily so "module
// missing" degrades to the probes' unavailable answers instead.
const loadWallet = async () => {
    try {
        return await import('@expensify/react-native-wallet')
    } catch {
        return null
    }
}

export class RNWalletProvisioningService implements WalletProvisioningService {
    // The probes never reject: besides the load failure above, the library
    // itself rejects when the JS loads but the TurboModule is absent (e.g.
    // react-native-web), and TapAndPay errors on unallowlisted builds. All of
    // those mean the same thing to callers — can't provision here.
    async checkWalletAvailability(): Promise<boolean> {
        try {
            const wallet = await loadWallet()
            if (!wallet) return false
            return await wallet.checkWalletAvailability()
        } catch {
            return false
        }
    }

    async getCardStatusBySuffix(
        last4Digits: string,
    ): Promise<WalletProvisioningCardStatus> {
        try {
            const wallet = await loadWallet()
            if (!wallet) return 'not found'
            return await wallet.getCardStatusBySuffix(last4Digits)
        } catch {
            return 'not found'
        }
    }

    async addCardToAppleWallet(
        cardData: WalletProvisioningAppleCardData,
        issuerEncryptPayloadCallback: (
            nonce: string,
            nonceSignature: string,
            certificates: string[],
        ) => Promise<WalletProvisioningApplePayload>,
    ): Promise<WalletProvisioningTokenizationStatus> {
        const wallet = await loadWallet()
        // Unreachable while availability reports false; reject so a caller
        // that somehow gets here lands on its fallback path.
        if (!wallet) throw new Error('Native wallet module is unavailable')
        return wallet.addCardToAppleWallet(
            cardData,
            issuerEncryptPayloadCallback,
        )
    }

    async addCardToGoogleWallet(
        cardData: WalletProvisioningGoogleCardData,
    ): Promise<WalletProvisioningTokenizationStatus> {
        const wallet = await loadWallet()
        if (!wallet) throw new Error('Native wallet module is unavailable')
        return wallet.addCardToGoogleWallet(cardData)
    }
}
