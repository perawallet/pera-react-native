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
    AccountChains,
    AccountCustody,
    ChainAccount,
    DecodedAccountRecord,
    HardwareWalletDetails,
} from '@perawallet/wallet-core-accounts'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import type {
    AccountType,
    HDWalletDetails,
    MultiSigDetails,
} from './vocabulary'

/** An account as store v0-v3 persisted it: the legacy fields are Algorand's, beside a `custody` and `chains` that may be absent or stale. */
type LegacyRecord = {
    address?: unknown
    keyPairId?: unknown
    type?: AccountType
    custody?: AccountCustody
    chains?: AccountChains
    hdWalletDetails?: HDWalletDetails
    hardwareDetails?: HardwareWalletDetails
    multisigDetails?: MultiSigDetails
}

const asLegacyRecord = (raw: unknown): LegacyRecord | undefined =>
    typeof raw === 'object' && raw !== null ? (raw as LegacyRecord) : undefined

const entryOf = (record: LegacyRecord): ChainAccount | undefined => {
    if (typeof record.address !== 'string') return undefined
    const { multisigDetails } = record
    return {
        address: record.address,
        ...(typeof record.keyPairId === 'string'
            ? { keyPairId: record.keyPairId }
            : {}),
        ...(multisigDetails
            ? {
                  native: {
                      family: 'algorand' as const,
                      multisig: {
                          version: multisigDetails.version,
                          threshold: multisigDetails.threshold,
                          addresses: [...multisigDetails.addresses],
                      },
                  },
              }
            : {}),
    }
}

/**
 * `undefined` for a shape that can't keep its kind without inventing an HD
 * index or a device. A record missing only its key or multisig parameters
 * keeps its kind without them; the multisig backfill heals the parameters.
 */
const custodyFromType = (record: LegacyRecord): AccountCustody | undefined => {
    switch (record.type) {
        case 'algo25':
        case 'quantum': {
            return { kind: 'local', seed: record.type }
        }
        case 'hdWallet': {
            if (!record.hdWalletDetails) return undefined
            const { account, keyIndex } = record.hdWalletDetails
            return { kind: 'local', seed: 'bip39', hd: { account, keyIndex } }
        }
        case 'hardware': {
            if (!record.hardwareDetails) return undefined
            const { accountIndex, ...device } = record.hardwareDetails
            return { kind: 'hardware', device, accountIndex }
        }
        case 'multisig':
        case 'watch': {
            return { kind: record.type }
        }
        default: {
            return undefined
        }
    }
}

/**
 * An existing `custody` wins over a contradicting `type`, and existing chain
 * entries over the top-level fields. A record whose kind doesn't decode
 * becomes a watch account with no key, since a key left on it would read as
 * signable; the user keeps its address and balance either way.
 */
export const decodeAlgorandLegacyRecord = (
    raw: unknown,
): DecodedAccountRecord | undefined => {
    const record = asLegacyRecord(raw)
    if (!record) return undefined
    const entry = record.chains?.[ALGORAND_CHAIN_ID] ?? entryOf(record)
    if (!entry) return undefined
    const custody = record.custody ?? custodyFromType(record)
    if (custody) {
        // Only a local account signs with a key of its own.
        const { keyPairId, ...keyless } = entry
        return {
            custody,
            chains: {
                ...record.chains,
                [ALGORAND_CHAIN_ID]:
                    custody.kind === 'local' && keyPairId
                        ? { ...keyless, keyPairId }
                        : keyless,
            },
        }
    }
    return {
        custody: { kind: 'watch' },
        chains: { [ALGORAND_CHAIN_ID]: { address: entry.address } },
    }
}
