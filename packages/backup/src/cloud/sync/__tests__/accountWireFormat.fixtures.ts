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
    buildAccount as buildStampedAccount,
    type AccountChains,
    type BuildAccountInput,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { canonicalJson } from '../canonicalize'
import type { SerializedAccount, SerializedItem } from '../types'
import {
    type GOLDEN_ACCOUNT_ITEMS,
    type GOLDEN_MULTICHAIN_ITEMS,
    GOLDEN_HD,
    GOLDEN_MNEMONIC,
    GOLDEN_PRIVATE_KEY_HEX,
    GOLDEN_UPDATED_AT,
    type GoldenItem,
} from './accountWireFormat.golden'

// Shared with the chain package's spec, which runs the real serializer over
// these accounts: the canonicalizer and hasher are pure, but the serializer
// must come from the caller so it reads the caller's adapter registry.

export type GoldenAccountKind = keyof typeof GOLDEN_ACCOUNT_ITEMS
export type GoldenMultichainKind = keyof typeof GOLDEN_MULTICHAIN_ITEMS

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

// Accounts as held before chain entries recorded their enablement, so the
// goldens stay the bytes every earlier build wrote; serializeAccountItems.spec
// pins the two fields an entry that carries it adds.
const buildAccount = (input: BuildAccountInput): WalletAccount => {
    const account = buildStampedAccount(input)
    return {
        ...account,
        chains: Object.fromEntries(
            Object.entries(account.chains).map(([chainId, entry]) => {
                if (!entry) return [chainId, entry]
                const { enabledAt: _at, enabledBy: _by, ...rest } = entry
                return [chainId, rest]
            }),
        ),
    }
}

// Stands in for an entry on a chain this build doesn't back up, which must
// never reach the record. It isn't a `ChainId` member, hence the widening cast.
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

// The same accounts holding only their Algorand entry: an entry on a chain the
// backup doesn't carry must neither add to nor change the items.
export const ALGORAND_ONLY_WIRE_FORMAT_ACCOUNTS: Record<
    GoldenAccountKind,
    WalletAccount
> = Object.fromEntries(
    Object.entries(WIRE_FORMAT_ACCOUNTS).map(([kind, account]) => [
        kind,
        { ...account, chains: { algorand: account.chains.algorand } },
    ]),
) as Record<GoldenAccountKind, WalletAccount>

// Accounts on Algorand and on Ethereum, which has no backup adapter of its
// own and so gets the entries the format owns.
export const MULTICHAIN_WIRE_FORMAT_ACCOUNTS: Record<
    GoldenMultichainKind,
    WalletAccount
> = {
    hdAlgorandEthereum: buildAccount({
        id: 'hdAlgorandEthereum',
        name: 'Child 1',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 1 },
        },
        chainId: 'algorand',
        chains: {
            algorand: { address: 'HDCHILDADDR', keyPairId: 'hd-key' },
            ethereum: { address: '0xHDCHAINADDR', keyPairId: 'eth-hd' },
        },
    }),
    hdEthereumOnly: buildAccount({
        id: 'hdEthereumOnly',
        name: 'Eth child',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 2 },
        },
        chainId: 'ethereum',
        chains: {
            ethereum: { address: '0xHDONLYADDR', keyPairId: 'eth-hd-2' },
        },
    }),
    privateKeyEthereum: buildAccount({
        id: 'privateKeyEthereum',
        name: 'Imported',
        custody: { kind: 'local', seed: null },
        chainId: 'ethereum',
        chains: { ethereum: { address: '0xKEYADDR', keyPairId: 'eth-raw' } },
    }),
    watchAlgorandEthereum: buildAccount({
        id: 'watchAlgorandEthereum',
        custody: { kind: 'watch' },
        chainId: 'algorand',
        chains: {
            algorand: { address: 'WATCHADDR' },
            ethereum: { address: '0xWATCHADDR' },
        },
    }),
}

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
        serialized.record,
        ...(serialized.secrets ? [serialized.secrets] : []),
        ...(serialized.extraItems ?? []),
    ].map(toWire)
}

/** What the golden items were serialized with. */
export const GOLDEN_SERIALIZE_DEPS = {
    chainId: 'algorand' as const,
    updatedAt: GOLDEN_UPDATED_AT,
    hashAddress,
    resolveMnemonic: async () => GOLDEN_MNEMONIC,
    resolveHd: async () => GOLDEN_HD,
    resolvePrivateKey: async () =>
        Uint8Array.from(GOLDEN_PRIVATE_KEY_HEX.match(/../g) ?? [], byte =>
            Number.parseInt(byte, 16),
        ),
}
