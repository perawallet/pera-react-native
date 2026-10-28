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

import { beforeEach, describe, expect, it } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    parseAccountRecordPayload,
    parseAddressPayload,
    parseSecretsPayload,
} from '../../api/payloadParsers'
import { isAccountItemKey, isAccountRecordKey } from '../../models'
import { canonicalJson } from '../canonicalize'
import { serializeAccountForBackup } from '../serializeAccountForBackup'
import {
    GOLDEN_ACCOUNT_ITEMS,
    GOLDEN_LEGACY_ACCOUNT_ITEMS,
    GOLDEN_MULTICHAIN_ITEMS,
    type GoldenItem,
} from './accountWireFormat.golden'
import {
    ALGORAND_ONLY_WIRE_FORMAT_ACCOUNTS,
    GOLDEN_SERIALIZE_DEPS,
    MULTICHAIN_WIRE_FORMAT_ACCOUNTS,
    WIRE_FORMAT_ACCOUNTS,
    wireItemsOf,
    type GoldenAccountKind,
    type GoldenMultichainKind,
} from './accountWireFormat.fixtures'
import { backupChainAdapters } from '../../../chain-adapter'
import { fakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import {
    registerAlgorandAccountsAdapter,
    registerEthereumAccountsAdapter,
    registerEthereumBackupChain,
} from '../../../__tests__/backupChainFixtures'

// A chain is backed up only with an accounts adapter registered for it.
registerAlgorandAccountsAdapter()
registerEthereumAccountsAdapter()

const serialize = async (account: WalletAccount): Promise<GoldenItem[]> =>
    wireItemsOf(await serializeAccountForBackup(account, GOLDEN_SERIALIZE_DEPS))

const parse = ({ key, payload }: GoldenItem) =>
    isAccountRecordKey(key)
        ? parseAccountRecordPayload(payload)
        : isAccountItemKey(key)
          ? parseAddressPayload(payload)
          : parseSecretsPayload(payload)

const KINDS = Object.keys(GOLDEN_ACCOUNT_ITEMS) as GoldenAccountKind[]
const MULTICHAIN_KINDS = Object.keys(
    GOLDEN_MULTICHAIN_ITEMS,
) as GoldenMultichainKind[]

const GOLDEN_ITEMS: GoldenItem[] = [
    ...KINDS.flatMap(kind => [...GOLDEN_ACCOUNT_ITEMS[kind]]),
    ...MULTICHAIN_KINDS.flatMap(kind => [...GOLDEN_MULTICHAIN_ITEMS[kind]]),
]
const LEGACY_ITEMS: GoldenItem[] = (
    Object.keys(GOLDEN_LEGACY_ACCOUNT_ITEMS) as GoldenAccountKind[]
).flatMap(kind => [...GOLDEN_LEGACY_ACCOUNT_ITEMS[kind]])

describe('backup account wire format', () => {
    beforeEach(() => {
        backupChainAdapters.reset()
        backupChainAdapters.register(fakeBackupAdapter())
        registerEthereumBackupChain()
    })

    it.each(KINDS)(
        'serializes a credential-bearing %s account to the golden items',
        async kind => {
            expect(await serialize(WIRE_FORMAT_ACCOUNTS[kind])).toEqual(
                GOLDEN_ACCOUNT_ITEMS[kind],
            )
        },
    )

    it.each(KINDS)(
        'serializes an Algorand-only %s account to the same golden items',
        async kind => {
            expect(
                await serialize(ALGORAND_ONLY_WIRE_FORMAT_ACCOUNTS[kind]),
            ).toEqual(GOLDEN_ACCOUNT_ITEMS[kind])
        },
    )

    it.each(MULTICHAIN_KINDS)(
        'serializes a %s account to one record across its chains',
        async kind => {
            expect(
                await serialize(MULTICHAIN_WIRE_FORMAT_ACCOUNTS[kind]),
            ).toEqual(GOLDEN_MULTICHAIN_ITEMS[kind])
        },
    )

    it.each(GOLDEN_ITEMS)(
        'parses every field of the golden $key payload back unchanged',
        item => {
            expect(canonicalJson(parse(item))).toBe(item.payload)
        },
    )

    it.each(LEGACY_ITEMS)(
        'still parses the legacy $key payload unchanged',
        item => {
            expect(canonicalJson(parse(item))).toBe(item.payload)
        },
    )
})
