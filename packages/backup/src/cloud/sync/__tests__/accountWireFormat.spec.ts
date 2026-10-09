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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
    accountsChainAdapters,
    buildAccount,
    DerivationTypes,
    type AccountChains,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    parseAddressPayload,
    parseSecretsPayload,
} from '../../api/payloadParsers'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { isAccountItemKey } from '../../models'
import { canonicalJson } from '../canonicalize'
import { serializeAccountForBackup } from '../serializeAccountForBackup'
import type { SerializedAccount, SerializedItem } from '../types'
import {
    GOLDEN_ACCOUNT_ITEMS,
    GOLDEN_HD,
    GOLDEN_MNEMONIC,
    GOLDEN_UPDATED_AT,
    type GoldenItem,
} from './accountWireFormat.golden'
import { stubAccountsAdapter } from '../../../__tests__/stubAccountsAdapter'

accountsChainAdapters.register(stubAccountsAdapter)

type AccountKind = keyof typeof GOLDEN_ACCOUNT_ITEMS

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

const HD_PATH = {
    account: 0,
    change: 0,
    keyIndex: 1,
    derivationType: DerivationTypes.Peikert,
}

const LEDGER = {
    manufacturer: 'ledger',
    deviceId: 'ble-1',
    deviceName: 'Ledger Nano X',
    transportType: 'ble',
} as const

const credentialBearing: Record<AccountKind, WalletAccount> = {
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

const legacyShaped: Record<AccountKind, WalletAccount> = {
    algo25: {
        id: 'algo25',
        name: 'Main',
        custody: { kind: 'local', seed: null },
        address: 'ALGO25ADDR',
        keyPairId: 'algo25-key',
    },
    quantum: {
        id: 'quantum',
        name: 'Quantum',
        custody: { kind: 'local', seed: 'quantum' },
        address: 'QUANTUMADDR',
        keyPairId: 'quantum-key',
    },
    watch: { id: 'watch', custody: { kind: 'watch' }, address: 'WATCHADDR' },
    hardware: {
        id: 'hardware',
        name: 'Ledger',
        custody: { kind: 'hardware', device: LEDGER, accountIndex: 2 },
        address: 'LEDGERADDR',
        hardwareDetails: { ...LEDGER, accountIndex: 2 },
    },
    multisig: {
        id: 'multisig',
        name: 'Shared',
        custody: { kind: 'multisig' },
        address: 'MSIGADDR',
        multisigDetails: {
            threshold: 1,
            addresses: ['MEMBERA', 'MEMBERB'],
            version: 1,
        },
    },
    hdWallet: {
        id: 'hdWallet',
        name: 'Child 1',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        address: 'HDCHILDADDR',
        keyPairId: 'hd-key',
        hdWalletDetails: HD_PATH,
    },
}

const toWire = (item: SerializedItem): GoldenItem => ({
    key: item.key,
    type: item.type,
    payload: canonicalJson(item.payload),
})

const wireItems = (serialized: SerializedAccount | null): GoldenItem[] => {
    if (serialized === null) throw new Error('account was not serialized')
    return [
        serialized.address,
        ...(serialized.secrets ? [serialized.secrets] : []),
        ...(serialized.extraItems ?? []),
    ].map(toWire)
}

const serialize = async (account: WalletAccount): Promise<GoldenItem[]> =>
    wireItems(
        await serializeAccountForBackup(account, {
            updatedAt: GOLDEN_UPDATED_AT,
            hashAddress,
            resolveMnemonic: async () => GOLDEN_MNEMONIC,
            resolveHd: async () => GOLDEN_HD,
        }),
    )

const KINDS = Object.keys(GOLDEN_ACCOUNT_ITEMS) as AccountKind[]

const GOLDEN_ITEMS: GoldenItem[] = KINDS.flatMap(kind => [
    ...GOLDEN_ACCOUNT_ITEMS[kind],
])

describe('backup account wire format', () => {
    it.each(KINDS)(
        'serializes a credential-bearing %s account to the golden items',
        async kind => {
            expect(await serialize(credentialBearing[kind])).toEqual(
                GOLDEN_ACCOUNT_ITEMS[kind],
            )
        },
    )

    it.each(KINDS)(
        'serializes a legacy-shaped %s account to the same golden items',
        async kind => {
            expect(await serialize(legacyShaped[kind])).toEqual(
                GOLDEN_ACCOUNT_ITEMS[kind],
            )
        },
    )

    it.each(GOLDEN_ITEMS)(
        'parses every field of the golden $key payload back unchanged',
        ({ key, payload }) => {
            const parsed = isAccountItemKey(key)
                ? parseAddressPayload(payload)
                : parseSecretsPayload(payload)

            expect(canonicalJson(parsed)).toBe(payload)
        },
    )
})
