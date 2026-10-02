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

import { describe, expect, it } from 'vitest'
import { BackupItemStatus, BackupItemType } from '../../models'
import { collectPasskeyPayloads } from '../collectPasskeyPayloads'
import type { FetchedItem, SyncItemState } from '../../models'

const KEY = 'passkeys/Y3JlZC1pZA=='
const SECRET_KEY = 'passkey-secrets/Y3JlZC1pZA=='

const payload = {
    credentialId: 'Y3JlZC1pZA==',
    origin: 'webauthn.io',
    identity: 'alice',
    counter: 0,
    publicKeySpkiDer: 'cHVi',
    seedAddress: 'SEEDADDRESS',
    displayName: 'Alice',
    createdAt: 1,
    updatedAt: 100,
}

const secret = { credentialId: 'Y3JlZC1pZA==', privateKey: 'a2V5' }

const fetchedItem = (key = KEY): FetchedItem => ({
    key,
    payload: key,
    hash: 'hash-1',
    ver: 2,
})

// The fetched payload names its key, so one decrypt serves both halves.
const deps = {
    encryptionKey: new Uint8Array(32),
    backupId: 'backup-1',
    decrypt: (ciphertext: string) =>
        JSON.stringify(ciphertext === SECRET_KEY ? secret : payload),
} as never

const trackedItem = (overrides: Partial<SyncItemState>): SyncItemState =>
    ({
        type: BackupItemType.PASSKEY,
        status: BackupItemStatus.ACTIVE,
        knownVer: 1,
        baseVer: 1,
        isDirty: false,
        localContentHash: null,
        localUpdatedAt: null,
        lastRemoteHash: 'hash-0',
        ...overrides,
    }) as SyncItemState

describe('collectPasskeyPayloads', () => {
    it('returns a decrypted credential for import and adopts the remote state', () => {
        const items: Record<string, SyncItemState> = {}

        const result = collectPasskeyPayloads({
            fetched: [fetchedItem()],
            items,
            deps,
        })

        expect(result).toEqual([{ payload, secret: null }])
        expect(items[KEY]!.label).toBe('Alice')
        expect(items[KEY]!.address).toBe(payload.credentialId)
    })

    it('joins a credential to its secret', () => {
        const items: Record<string, SyncItemState> = {}

        const result = collectPasskeyPayloads({
            fetched: [fetchedItem(SECRET_KEY), fetchedItem()],
            items,
            deps,
        })

        expect(result).toEqual([{ payload, secret }])
        expect(items[SECRET_KEY]!.address).toBe(secret.credentialId)
        expect(items[SECRET_KEY]!.knownVer).toBe(2)
    })

    it('adopts a secret whose record did not arrive without importing anything', () => {
        const items: Record<string, SyncItemState> = {}

        const result = collectPasskeyPayloads({
            fetched: [fetchedItem(SECRET_KEY)],
            items,
            deps,
        })

        expect(result).toEqual([])
        expect(items[SECRET_KEY]!.lastRemoteHash).toBe('hash-1')
    })

    it('caches the label but does not import a credential held for review', () => {
        const items = { [KEY]: trackedItem({ pendingImport: true }) }

        const result = collectPasskeyPayloads({
            fetched: [fetchedItem()],
            items,
            deps,
        })

        expect(result).toEqual([])
        expect(items[KEY]!.label).toBe('Alice')
        expect(items[KEY]!.knownVer).toBe(2)
    })

    it('keeps a newer local edit instead of importing', () => {
        const items = {
            [KEY]: trackedItem({ isDirty: true, localUpdatedAt: 999 }),
        }

        const result = collectPasskeyPayloads({
            fetched: [fetchedItem()],
            items,
            deps,
        })

        expect(result).toEqual([])
    })

    it('skips an item whose payload does not parse', () => {
        const result = collectPasskeyPayloads({
            fetched: [fetchedItem()],
            items: {},
            deps: { ...deps, decrypt: () => '{"nope":true}' } as never,
        })

        expect(result).toEqual([])
    })
})
