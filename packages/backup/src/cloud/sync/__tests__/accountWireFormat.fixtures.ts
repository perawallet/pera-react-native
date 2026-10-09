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

import {
    buildAccount,
    type AccountChains,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { canonicalJson } from '../canonicalize'
import type { SerializedAccount, SerializedItem } from '../types'
import {
    type GOLDEN_ACCOUNT_ITEMS,
    GOLDEN_HD,
    GOLDEN_MNEMONIC,
    GOLDEN_UPDATED_AT,
    type GoldenItem,
} from './accountWireFormat.golden'

// Shared with the chain package's spec, which runs the real serializer over
// these accounts: the canonicalizer and hasher are pure, but the serializer
// must come from the caller so it reads the caller's adapter registry.

export type GoldenAccountKind = keyof typeof GOLDEN_ACCOUNT_ITEMS

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

// Stands in for an entry a later chain adds to an account, which must never
// reach the Algorand backup payload. It isn't a `ChainId` member, hence the
// widening cast.
const fixtureChain = (address: string, keyPairId?: string): AccountChains =>
    ({
        'fixture-chain': {
            address: `fixture-${address}`,
            ...(keyPairId ? { keyPairId: `fixture-${keyPairId}` } : {}),
        },
    }) as unknown as AccountChains

const LEDGER = {
    manufacturer: 'ledger',
    deviceId: 'ble-1',
    deviceName: 'Ledger Nano X',
    transportType: 'ble',
} as const

export const WIRE_FORMAT_ACCOUNTS: Record<GoldenAccountKind, WalletAccount> = {
    algo25: buildAccount({
        id: 'algo25',
        name: 'Main',
        custody: { kind: 'local', seed: null },
        chainId: 'algorand',
        chains: {
            algorand: { address: 'ALGO25ADDR', keyPairId: 'algo25-key' },
        },
    }),
    quantum: buildAccount({
        id: 'quantum',
        name: 'Quantum',
        custody: { kind: 'local', seed: 'quantum' },
        chainId: 'algorand',
        chains: {
            ...fixtureChain('QUANTUMADDR', 'quantum-key'),
            algorand: { address: 'QUANTUMADDR', keyPairId: 'quantum-key' },
        },
    }),
    watch: buildAccount({
        id: 'watch',
        custody: { kind: 'watch' },
        chainId: 'algorand',
        chains: {
            ...fixtureChain('WATCHADDR'),
            algorand: { address: 'WATCHADDR' },
        },
    }),
    hardware: buildAccount({
        id: 'hardware',
        name: 'Ledger',
        custody: { kind: 'hardware', device: LEDGER, accountIndex: 2 },
        chainId: 'algorand',
        chains: { algorand: { address: 'LEDGERADDR' } },
    }),
    multisig: buildAccount({
        id: 'multisig',
        name: 'Shared',
        custody: { kind: 'multisig' },
        chainId: 'algorand',
        chains: {
            algorand: {
                address: 'MSIGADDR',
                native: {
                    family: 'algorand',
                    multisig: {
                        version: 1,
                        threshold: 1,
                        addresses: ['MEMBERA', 'MEMBERB'],
                    },
                },
            },
        },
    }),
    hdWallet: buildAccount({
        id: 'hdWallet',
        name: 'Child 1',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 1 },
        },
        chainId: 'algorand',
        chains: {
            ...fixtureChain('HDCHILDADDR', 'hd-key'),
            algorand: { address: 'HDCHILDADDR', keyPairId: 'hd-key' },
        },
    }),
}

// The same accounts holding only their Algorand entry: another chain's entry
// must neither add to nor change the items.
export const ALGORAND_ONLY_WIRE_FORMAT_ACCOUNTS: Record<
    GoldenAccountKind,
    WalletAccount
> = Object.fromEntries(
    Object.entries(WIRE_FORMAT_ACCOUNTS).map(([kind, account]) => [
        kind,
        { ...account, chains: { algorand: account.chains.algorand } },
    ]),
) as Record<GoldenAccountKind, WalletAccount>

const toWire = (item: SerializedItem): GoldenItem => ({
    key: item.key,
    type: item.type,
    payload: canonicalJson(item.payload),
})

export const wireItemsOf = (
    serialized: SerializedAccount | null,
): GoldenItem[] => {
    if (serialized === null) throw new Error('account was not serialized')
    return [
        serialized.address,
        ...(serialized.secrets ? [serialized.secrets] : []),
        ...(serialized.extraItems ?? []),
    ].map(toWire)
}

/** What the golden items were serialized with. */
export const GOLDEN_SERIALIZE_DEPS = {
    updatedAt: GOLDEN_UPDATED_AT,
    hashAddress,
    resolveMnemonic: async () => GOLDEN_MNEMONIC,
    resolveHd: async () => GOLDEN_HD,
}
