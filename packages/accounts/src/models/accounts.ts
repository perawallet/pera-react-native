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
    HardwareWalletManufacturer,
    LedgerTransportType,
} from '@perawallet/wallet-core-hardware-wallet'
import type { AccountChains, AccountCustody } from './credentials'

export type HardwareWalletDetails = {
    manufacturer: HardwareWalletManufacturer
    /** Device identifier for reconnection (e.g. BLE device ID, USB descriptor id) */
    deviceId: string
    /** User-visible device name (e.g. "Ledger Nano X") */
    deviceName: string
    /** Sequential account index on the hardware wallet device (0, 1, 2...) */
    accountIndex: number
    /** Transport used to reach the device. */
    transportType: LedgerTransportType
}

export type WalletAccount = {
    /**
     * Stable unique identifier for the account, independent of any on-chain
     * address, so an account is referenced the same way on every chain.
     */
    id: string
    name?: string
    /** How the account is held; the same on every chain. */
    custody: AccountCustody
    /** Everything that varies by chain, keyed by chain id. */
    chains: AccountChains
}

/** The account narrowed to one custody kind, as `hasCustody` narrows it. */
export type AccountWithCustody<K extends AccountCustody['kind']> =
    WalletAccount & { custody: Extract<AccountCustody, { kind: K }> }

export type LocalAccount = AccountWithCustody<'local'>
export type HardwareWalletAccount = AccountWithCustody<'hardware'>
export type MultiSigAccount = AccountWithCustody<'multisig'>
export type WatchAccount = AccountWithCustody<'watch'>

export type AccountAddress = string

export const AccountSortModes = {
    alphabeticalAsc: 'alphabeticalAsc',
    alphabeticalDesc: 'alphabeticalDesc',
    balanceAsc: 'balanceAsc',
    balanceDesc: 'balanceDesc',
    manual: 'manual',
} as const

export type AccountSortMode =
    (typeof AccountSortModes)[keyof typeof AccountSortModes]

export const LaunchAccountModes = {
    /** Whichever account was active when the app was last closed. */
    lastUsed: 'lastUsed',
    /** A user-pinned account, re-selected on every cold start. */
    specific: 'specific',
} as const

export type LaunchAccountMode =
    (typeof LaunchAccountModes)[keyof typeof LaunchAccountModes]
