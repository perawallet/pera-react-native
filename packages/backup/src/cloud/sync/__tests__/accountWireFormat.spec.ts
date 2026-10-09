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

import { beforeEach, describe, expect, it } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    parseAddressPayload,
    parseSecretsPayload,
} from '../../api/payloadParsers'
import { isAccountItemKey } from '../../models'
import { canonicalJson } from '../canonicalize'
import { serializeAccountForBackup } from '../serializeAccountForBackup'
import {
    GOLDEN_ACCOUNT_ITEMS,
    type GoldenItem,
} from './accountWireFormat.golden'
import {
    ALGORAND_ONLY_WIRE_FORMAT_ACCOUNTS,
    GOLDEN_SERIALIZE_DEPS,
    WIRE_FORMAT_ACCOUNTS,
    wireItemsOf,
    type GoldenAccountKind,
} from './accountWireFormat.fixtures'
import { backupChainAdapters } from '../../../chain-adapter'
import { fakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'

const serialize = async (account: WalletAccount): Promise<GoldenItem[]> =>
    wireItemsOf(await serializeAccountForBackup(account, GOLDEN_SERIALIZE_DEPS))

const KINDS = Object.keys(GOLDEN_ACCOUNT_ITEMS) as GoldenAccountKind[]

const GOLDEN_ITEMS: GoldenItem[] = KINDS.flatMap(kind => [
    ...GOLDEN_ACCOUNT_ITEMS[kind],
])

describe('backup account wire format', () => {
    beforeEach(() => {
        backupChainAdapters.reset()
        backupChainAdapters.register(fakeBackupAdapter())
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
