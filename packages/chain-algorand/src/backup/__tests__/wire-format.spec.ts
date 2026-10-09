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
import {
    backupChainAdapters,
    serializeAccountForBackup,
} from '@perawallet/wallet-core-backup'
import {
    ALGORAND_ONLY_WIRE_FORMAT_ACCOUNTS,
    GOLDEN_ACCOUNT_ITEMS,
    GOLDEN_SERIALIZE_DEPS,
    WIRE_FORMAT_ACCOUNTS,
    wireItemsOf,
    type GoldenAccountKind,
} from '@perawallet/wallet-core-backup/testing'
import { algorandBackupAdapter } from '../adapter'

const KINDS = Object.keys(GOLDEN_ACCOUNT_ITEMS) as GoldenAccountKind[]

// The fixtures come from the backup source and the serializer from its build,
// whose `ItemKeyHash` brands are distinct unique symbols.
const DEPS = GOLDEN_SERIALIZE_DEPS as unknown as Parameters<
    typeof serializeAccountForBackup
>[1]

// The backup package pins these goldens against a fake adapter; this pins the
// adapter that actually writes them.
describe('algorandBackupAdapter wire format', () => {
    beforeEach(() => {
        backupChainAdapters.reset()
        backupChainAdapters.register(algorandBackupAdapter)
    })

    it.each(KINDS)(
        'serializes a %s account to the golden items',
        async kind => {
            const serialized = await serializeAccountForBackup(
                WIRE_FORMAT_ACCOUNTS[kind],
                DEPS,
            )

            expect(wireItemsOf(serialized)).toEqual(GOLDEN_ACCOUNT_ITEMS[kind])
        },
    )

    it.each(KINDS)(
        'serializes an Algorand-only %s account to the same golden items',
        async kind => {
            const serialized = await serializeAccountForBackup(
                ALGORAND_ONLY_WIRE_FORMAT_ACCOUNTS[kind],
                DEPS,
            )

            expect(wireItemsOf(serialized)).toEqual(GOLDEN_ACCOUNT_ITEMS[kind])
        },
    )
})
