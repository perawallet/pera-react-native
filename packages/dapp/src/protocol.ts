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

import { EIP1193_SIGNING_METHODS } from './eip1193Protocol'

export const DAPP_KIND = 'dapp' as const

export const DAPP_METHODS = [
    'connect',
    'disconnect',
    'getAddresses',
    'getEmptySignatures',
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

/**
 * The page providers sharing the one page-to-wallet channel. Every hop is
 * tagged, because `window.pera` and EIP-1193 reuse event names
 * (`accountsChanged`, `disconnect`) that must never cross between them.
 */
export const DAPP_PROVIDERS = ['pera', 'eip1193'] as const
export type DappProvider = (typeof DAPP_PROVIDERS)[number]

export const isDappProvider = (value: unknown): value is DappProvider =>
    (DAPP_PROVIDERS as readonly unknown[]).includes(value)

// A user deliberating over an approval, not a wire round-trip: minutes, not
// the 8 s pairing budget WalletConnect uses for its handshake.
export const DAPP_PROPOSAL_TTL_MS = 5 * 60_000
export const DAPP_REQUEST_TTL_MS = 5 * 60_000
// How long an EIP-1193 signing request may stay on screen. Only a lost
// approval window should reach it: expiring sooner could withdraw the window
// under a broadcast that still goes out. Kept under the approval bridge's
// service-worker keepalive, so the window is withdrawn before an idled worker
// can drop an Approve whose send has already gone out.
export const DAPP_APPROVAL_TTL_MS = 14 * 60_000
// Page-side backstops; strictly longer than the handler's own expiry so the
// handler's terminal answer always wins when both are racing. An EIP-1193
// signing request can wait out its queue TTL and then its approval TTL.
export const DAPP_PAGE_TIMEOUT_MS = DAPP_REQUEST_TTL_MS + 10_000
export const DAPP_SIGNING_PAGE_TIMEOUT_MS =
    DAPP_REQUEST_TTL_MS + DAPP_APPROVAL_TTL_MS + 10_000

export const dappPageTimeoutMs = (
    provider: DappProvider,
    method: string,
): number =>
    provider === 'eip1193' && EIP1193_SIGNING_METHODS.includes(method)
        ? DAPP_SIGNING_PAGE_TIMEOUT_MS
        : DAPP_PAGE_TIMEOUT_MS

export const MAX_DAPP_REQUEST_JSON_LENGTH = 1_048_576
