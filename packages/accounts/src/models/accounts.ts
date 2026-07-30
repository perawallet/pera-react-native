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
import type { Network } from '@perawallet/wallet-core-shared'

export const DerivationTypes = {
    Khovratovich: 32,
    Peikert: 9,
} as const

export type DerivationType =
    (typeof DerivationTypes)[keyof typeof DerivationTypes]

export const AccountTypes = {
    algo25: 'algo25',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    multisig: 'multisig',
    watch: 'watch',
    quantum: 'quantum',
} as const

export type AccountType = (typeof AccountTypes)[keyof typeof AccountTypes]

/**
 * Precedence used to resolve two accounts that share an address: higher wins.
 *
 * `quantum` ranks highest because misreporting it is the expensive failure —
 * the backend prices a quantum account's swap quotes at the Ed25519 minimum
 * fee and the chain rejects the swap, with no client-side symptom. `watch`
 * ranks lowest because it carries no signing capability, so dropping it in
 * favour of anything else can only ever gain the user capability.
 *
 * In practice only `watch` can genuinely collide with another type — an
 * Algorand address is derived from its key, so one address cannot be two
 * different signing schemes — but the order is total so the rule stays
 * deterministic rather than a special case.
 *
 * `as const` is load-bearing, not decoration: `satisfies Record<K, number>`
 * alone widens every value to `number`, which would make the cross-enum
 * equality assertion in `device-accounts.ts` pass vacuously. The literal types
 * are what make a reordering of one table a compile error.
 *
 * Mirrored, over the wire enum, by `DEVICE_ACCOUNT_TYPE_RANK` in
 * `@perawallet/wallet-core-device`. The two are held in sync by that
 * assertion — update both together.
 */
export const ACCOUNT_TYPE_RANK = {
    quantum: 6,
    hardware: 5,
    hdWallet: 4,
    algo25: 3,
    multisig: 2,
    watch: 1,
} as const satisfies Record<AccountType, number>

export type ImportAccountType = 'hdWallet' | 'algo25' | 'quantum'

export type HDWalletDetails = {
    account: number
    change: number
    keyIndex: number
    derivationType: DerivationType
}

export type MultiSigDetails = {
    threshold: number
    addresses: string[]
    /** Algorand multisig version byte. Always 1 today. */
    version: number
}

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

export type WalletAccount =
    | Algo25Account
    | HDWalletAccount
    | MultiSigAccount
    | HardwareWalletAccount
    | WatchAccount
    | QuantumAccount

export type BaseWalletAccount = {
    /**
     * Stable unique identifier for the account, independent of any on-chain
     * address. Every wallet account has one so it can always be referenced
     * (and so future account kinds without an address — e.g. vIBANs, cards —
     * still fit this shape). May coincide with an Indexer account id.
     */
    id: string
    name?: string
    type: AccountType
    /**
     * On-chain Algorand address. Required for every account kind that exists
     * today (all of them are on-chain), so it is redeclared as required on each
     * concrete type below. Optional here so future off-chain account kinds can
     * omit it.
     */
    address?: string
    keyPairId?: string
    /**
     * Mirror of the on-chain auth-addr for the ACTIVE network — the value
     * badges, pickers, and signer resolution read. Re-derived from
     * `rekeyAddressByNetwork` on every network switch and sync tick.
     */
    rekeyAddress?: string
    /**
     * Per-network auth-addr state (rekeys are per-network on-chain: a
     * mainnet rekey does not affect testnet). Absent on accounts persisted
     * before this field existed — for those the mirror is left as-is until
     * a sync tick writes the map (self-healing, seconds).
     */
    rekeyAddressByNetwork?: Partial<Record<Network, string>>
}

export type Algo25Account = BaseWalletAccount & {
    type: typeof AccountTypes.algo25
    address: string
    keyPairId: string
}

/**
 * Account backed by a post-quantum signature keypair. Flat and single-key
 * like {@link Algo25Account}: the key material lives in the KMS under
 * `keyPairId`; there is no derivation path or device metadata. The concrete
 * signature scheme (Falcon today) is a KMS / signing-pipeline detail that the
 * model deliberately does not encode, so the scheme can change without a
 * data migration.
 */
export type QuantumAccount = BaseWalletAccount & {
    type: typeof AccountTypes.quantum
    address: string
    keyPairId: string
}

export type HDWalletAccount = BaseWalletAccount & {
    type: typeof AccountTypes.hdWallet
    address: string
    hdWalletDetails: HDWalletDetails
    keyPairId: string
}

export type MultiSigAccount = BaseWalletAccount & {
    type: typeof AccountTypes.multisig
    address: string
    multisigDetails: MultiSigDetails
}

export type HardwareWalletAccount = BaseWalletAccount & {
    type: typeof AccountTypes.hardware
    address: string
    hardwareDetails: HardwareWalletDetails
}

export type WatchAccount = BaseWalletAccount & {
    type: typeof AccountTypes.watch
    address: string
}

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
