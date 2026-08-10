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

// @expensify/react-native-wallet constructs a NativeEventEmitter at module
// scope, which throws on iOS when the binary doesn't bundle the RNWallet
// TurboModule (e.g. a dev client built before this dependency landed) — an
// eager import would crash the whole app at boot. Loading lazily turns
// "module missing" into a rejected promise that the availability query treats
// as unavailable, so those builds just keep the manual-instructions fallback.
// (Web builds resolve walletProvisioning.web.ts instead and never load it;
// vitest aliases the library to a stub.)
import type {
    AndroidCardData,
    CardStatus,
    IOSCardData,
    IOSEncryptPayload,
    TokenizationStatus,
} from '@expensify/react-native-wallet'

/** True when this build can load the native wallet module at all (not web). */
export const isNativeWalletSupported = true

// Resolves null when the library can't even evaluate (binary without the
// TurboModule): that's a supported state, not an error — the read APIs below
// map it to their "unavailable" values so the global query error logger stays
// quiet on such builds.
const loadWallet = async () => {
    try {
        return await import('@expensify/react-native-wallet')
    } catch {
        return null
    }
}

export const checkWalletAvailability = async (): Promise<boolean> => {
    const wallet = await loadWallet()
    if (!wallet) return false
    return wallet.checkWalletAvailability()
}

export const getCardStatusBySuffix = async (
    last4Digits: string,
): Promise<CardStatus> => {
    const wallet = await loadWallet()
    if (!wallet) return 'not found'
    return wallet.getCardStatusBySuffix(last4Digits)
}

export const addCardToAppleWallet = async (
    cardData: IOSCardData,
    issuerEncryptPayloadCallback: (
        nonce: string,
        nonceSignature: string,
        certificates: string[],
    ) => Promise<IOSEncryptPayload>,
): Promise<TokenizationStatus> => {
    const wallet = await loadWallet()
    // Unreachable while availability reports false; reject so a caller that
    // somehow gets here lands on the manual-instructions fallback.
    if (!wallet) throw new Error('Native wallet module is unavailable')
    return wallet.addCardToAppleWallet(cardData, issuerEncryptPayloadCallback)
}

export const addCardToGoogleWallet = async (
    cardData: AndroidCardData,
): Promise<TokenizationStatus> => {
    const wallet = await loadWallet()
    if (!wallet) throw new Error('Native wallet module is unavailable')
    return wallet.addCardToGoogleWallet(cardData)
}
