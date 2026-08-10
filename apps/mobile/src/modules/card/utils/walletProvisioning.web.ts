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

// Web twin of walletProvisioning.ts: OS wallets don't exist on web, and the
// native library crashes at import time there, so no runtime import of it —
// type-only imports are erased at compile time.
import type {
    CardStatus,
    TokenizationStatus,
} from '@expensify/react-native-wallet'

/** True when this build can load the native wallet module at all (not web). */
export const isNativeWalletSupported = false

export const checkWalletAvailability = (): Promise<boolean> =>
    Promise.resolve(false)

export const getCardStatusBySuffix = (
    _last4Digits: string,
): Promise<CardStatus> => Promise.resolve('not found')

export const addCardToAppleWallet = (): Promise<TokenizationStatus> =>
    Promise.reject(new Error('Wallet provisioning is not supported on web'))

export const addCardToGoogleWallet = (): Promise<TokenizationStatus> =>
    Promise.reject(new Error('Wallet provisioning is not supported on web'))
