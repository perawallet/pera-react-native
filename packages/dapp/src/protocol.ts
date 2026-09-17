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

export const DAPP_KIND = 'dapp' as const

export const DAPP_METHODS = [
    'connect',
    'disconnect',
    'getAddresses',
    'requestTransactionSigning',
    'requestDataSigning',
] as const
export type DappMethod = (typeof DAPP_METHODS)[number]

export const DAPP_NOTIFICATIONS = {
    accountsChanged: 'accountsChanged',
    networkChanged: 'networkChanged',
    disconnect: 'disconnect',
} as const

export const DAPP_PROVIDER_VERSION = '1' as const

// A user deliberating over an approval, not a wire round-trip: minutes, not
// the 8 s pairing budget WalletConnect uses for its handshake.
export const DAPP_PROPOSAL_TTL_MS = 5 * 60_000
export const DAPP_REQUEST_TTL_MS = 5 * 60_000
// Page-side backstop; strictly longer than the handler's own expiry so the
// handler's terminal answer always wins when both are racing.
export const DAPP_PAGE_TIMEOUT_MS = DAPP_REQUEST_TTL_MS + 10_000

export const MAX_DAPP_REQUEST_JSON_LENGTH = 1_048_576
