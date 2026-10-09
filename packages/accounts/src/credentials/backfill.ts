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

import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import type {
    AccountChains,
    AccountCustody,
    AccountType,
    BaseWalletAccount,
    HardwareWalletDetails,
    HDWalletDetails,
    MultiSigAccount,
    MultiSigDetails,
    WalletAccount,
} from '../models'
import { buildAccount } from './buildAccount'

/** `algo25` is only ever read: it is what a standalone account was persisted as. */
export type LegacyAccountType = Exclude<AccountType, 'standalone'> | 'algo25'

export type CustodyFields = {
    custody: AccountCustody
    chains: AccountChains
}

/** An account as store v0-v2 persisted it: `type` is authoritative and `custody` may be absent or stale. */
export type PersistedAccountRecord = Omit<BaseWalletAccount, 'custody'> & {
    address: string
    type?: LegacyAccountType
    custody?: AccountCustody
    hdWalletDetails?: HDWalletDetails
    hardwareDetails?: HardwareWalletDetails
    multisigDetails?: MultiSigDetails
}

/**
 * `undefined` for a shape that can't keep its kind without inventing an HD
 * index or a device. A record missing only its key or multisig details keeps
 * its kind without them; `useMultisigDetailsBackfill` heals the multisig.
 */
export const custodyFromLegacy = (
    account: PersistedAccountRecord,
): CustodyFields | undefined => {
    const { address } = account
    const keyed = account.keyPairId
        ? { address, keyPairId: account.keyPairId }
        : { address }
    switch (account.type) {
        case 'algo25': {
            return {
                custody: { kind: 'local', seed: null },
                chains: { [LEGACY_CHAIN_ID]: keyed },
            }
        }
        case 'quantum': {
            return {
                custody: { kind: 'local', seed: 'quantum' },
                chains: { [LEGACY_CHAIN_ID]: keyed },
            }
        }
        case 'hdWallet': {
            if (!account.hdWalletDetails) return undefined
            const { account: hdAccount, keyIndex } = account.hdWalletDetails
            return {
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: hdAccount, keyIndex },
                },
                chains: { [LEGACY_CHAIN_ID]: keyed },
            }
        }
        case 'hardware': {
            if (!account.hardwareDetails) return undefined
            const { accountIndex, ...device } = account.hardwareDetails
            return {
                custody: { kind: 'hardware', device, accountIndex },
                chains: { [LEGACY_CHAIN_ID]: { address } },
            }
        }
        case 'multisig': {
            if (!account.multisigDetails) {
                return {
                    custody: { kind: 'multisig' },
                    chains: { [LEGACY_CHAIN_ID]: { address } },
                }
            }
            const { threshold, addresses, version } = account.multisigDetails
            return {
                custody: { kind: 'multisig' },
                chains: {
                    [LEGACY_CHAIN_ID]: {
                        address,
                        native: {
                            family: 'algorand',
                            multisig: {
                                version,
                                threshold,
                                addresses: [...addresses],
                            },
                        },
                    },
                },
            }
        }
        case 'watch': {
            return {
                custody: { kind: 'watch' },
                chains: { [LEGACY_CHAIN_ID]: { address } },
            }
        }
        default: {
            return undefined
        }
    }
}

/**
 * Idempotent: an existing `custody` wins over a contradicting `type`. A record
 * that doesn't decode becomes a watch account, since a `keyPairId` left on it
 * would read as signable (`hasSigningKeys`).
 */
export const toCurrentAccount = (
    record: PersistedAccountRecord,
): WalletAccount => {
    const rest = { ...record }
    delete rest.type
    if (rest.custody) return rest as WalletAccount
    const fields = custodyFromLegacy(record)
    if (fields) return { ...rest, ...fields } as WalletAccount
    return {
        id: record.id,
        ...(record.name !== undefined ? { name: record.name } : {}),
        address: record.address,
        custody: { kind: 'watch' },
        chains: { [LEGACY_CHAIN_ID]: { address: record.address } },
    }
}

/** Heals a multisig persisted before `multisigDetails` existed. */
export const withLegacyMultisigDetails = (
    account: MultiSigAccount,
    details: MultiSigDetails,
): MultiSigAccount =>
    buildAccount({
        id: account.id,
        name: account.name,
        custody: { kind: 'multisig' },
        chainId: LEGACY_CHAIN_ID,
        chains: {
            ...account.chains,
            [LEGACY_CHAIN_ID]: {
                address: account.address,
                native: {
                    family: 'algorand',
                    multisig: { ...details, addresses: [...details.addresses] },
                },
            },
        },
    })
