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
    ChainAdapterNotRegisteredError,
    DuplicateChainAdapterError,
} from '@perawallet/wallet-core-chain-contract'
import { kmsCore } from '@perawallet/wallet-core-kms'
import {
    backupAdapterFor,
    backupChainAdapters,
    backupSeedReference,
} from '../chain-adapter'
import { parseBackupEnvelope } from '../asb/parsers/parse-backup-envelope'
import { decryptBackupPayload } from '../asb/parsers/decrypt-backup-payload'
import { partitionImportableAccounts } from '../asb/utils/partition-importable-accounts'
import { fakeBackupAdapter } from './fakeBackupAdapter'

describe('backupChainAdapters', () => {
    beforeEach(() => {
        backupChainAdapters.reset()
    })

    it("resolves the legacy chain's adapter", () => {
        const adapter = fakeBackupAdapter()
        backupChainAdapters.register(adapter)

        expect(backupAdapterFor()).toBe(adapter)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => backupAdapterFor()).toThrow(ChainAdapterNotRegisteredError)
        expect(() => backupAdapterFor()).toThrow(
            'No backup adapter is registered for chain "algorand"',
        )
    })

    it('refuses a second adapter for the same chain', () => {
        backupChainAdapters.register(fakeBackupAdapter())

        expect(() => backupChainAdapters.register(fakeBackupAdapter())).toThrow(
            DuplicateChainAdapterError,
        )
    })

    it('forwards the seed reference lookup to the adapter with the shared KMS', async () => {
        const adapter = fakeBackupAdapter()
        backupChainAdapters.register(adapter)

        expect(await backupSeedReference('seed-1')).toBe('REF-seed-1')
        expect(adapter.seedReference).toHaveBeenCalledWith(kmsCore, 'seed-1')
    })

    it('forwards each secure backup step to the adapter', () => {
        const adapter = fakeBackupAdapter()
        backupChainAdapters.register(adapter)
        const indices = new Uint16Array(25)
        const envelope = { version: 1 } as never

        parseBackupEnvelope('raw')
        decryptBackupPayload(envelope, indices)
        partitionImportableAccounts([], [])

        expect(adapter.secureBackup.parseEnvelope).toHaveBeenCalledWith('raw')
        expect(adapter.secureBackup.decryptPayload).toHaveBeenCalledWith(
            envelope,
            indices,
        )
        expect(adapter.secureBackup.partitionImportable).toHaveBeenCalledWith(
            [],
            [],
        )
    })
})
