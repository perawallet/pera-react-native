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

// Stub for `@expensify/react-native-wallet`: the real module resolves its
// TurboModule and constructs a NativeEventEmitter at import time — neither
// exists under react-native-web/jsdom. Defaults mirror a dormant device
// (wallet unavailable), so suites exercise the manual-instructions fallback.
// Types are declared locally: importing them from the real package would
// resolve back to this stub through the alias.

type CardStatus =
    | 'not found'
    | 'requireActivation'
    | 'pending'
    | 'active'
    | 'suspended'
    | 'deactivated'
type TokenizationStatus = 'canceled' | 'success' | 'error'
type TokenInfo = { identifier: string; lastDigits: string; tokenState: number }

export const AddToWalletButton = () => null

export const checkWalletAvailability = (): Promise<boolean> =>
    Promise.resolve(false)

export const getSecureWalletInfo = (): Promise<{
    deviceID: string
    walletAccountID: string
}> => Promise.resolve({ deviceID: '', walletAccountID: '' })

export const getCardStatusBySuffix = (
    _last4Digits: string,
): Promise<CardStatus> => Promise.resolve('not found')

export const getCardStatusByIdentifier = (
    _identifier: string,
    _tsp: string,
): Promise<CardStatus> => Promise.resolve('not found')

export const addCardToAppleWallet = (): Promise<TokenizationStatus> =>
    Promise.resolve('canceled')

export const addCardToGoogleWallet = (): Promise<TokenizationStatus> =>
    Promise.resolve('canceled')

export const resumeAddCardToGoogleWallet = (): Promise<TokenizationStatus> =>
    Promise.resolve('canceled')

export const listTokens = (): Promise<TokenInfo[]> => Promise.resolve([])

export const addListener = (): { remove: () => void } => ({
    remove: () => {},
})

export const removeListener = (): void => {}
