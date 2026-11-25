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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
    const records = new Map<string, string>()
    const calls: string[] = []
    return {
        records,
        calls,
        storage: {
            getAllKeys: () => Array.from(records.keys()),
            clearAll: vi.fn(() => {
                calls.push('clearAll')
                records.clear()
            }),
            trim: vi.fn(() => {
                calls.push('trim')
            }),
        },
        destroyMasterKey: vi.fn(async () => {
            calls.push('destroyMasterKey')
        }),
    }
})

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    storage: mocks.storage,
    destroyMasterKey: mocks.destroyMasterKey,
}))

import { wipeKeystoreStorage } from '../maintenance'

describe('wipeKeystoreStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.records.clear()
        mocks.calls.length = 0
    })

    it('removes sealed, metadata and flat leftover records, then destroys the master key', async () => {
        mocks.records.set('m/seed-1', 'sealed')
        mocks.records.set('k/seed-1', 'meta')
        mocks.records.set('flat-leftover', 'sealed-legacy')

        await wipeKeystoreStorage()

        expect(mocks.storage.getAllKeys()).toEqual([])
        expect(mocks.calls).toEqual(['clearAll', 'trim', 'destroyMasterKey'])
    })

    it('keeps the master key when the records could not be removed', async () => {
        mocks.storage.clearAll.mockImplementationOnce(() => {
            throw new Error('mmkv write failed')
        })

        await expect(wipeKeystoreStorage()).rejects.toThrow('mmkv write failed')

        expect(mocks.destroyMasterKey).not.toHaveBeenCalled()
    })

    it('keeps the master key when the record clear was silently incomplete', async () => {
        mocks.records.set('m/seed-1', 'sealed')
        mocks.storage.clearAll.mockImplementationOnce(() => {})

        await expect(wipeKeystoreStorage()).rejects.toThrow(
            'Keystore records remain',
        )

        expect(mocks.destroyMasterKey).not.toHaveBeenCalled()
    })

    it('removes a record written while the master key was being destroyed', async () => {
        mocks.destroyMasterKey.mockImplementationOnce(async () => {
            mocks.calls.push('destroyMasterKey')
            mocks.records.set('m/seed-2', 'sealed-by-destroyed-key')
        })

        await wipeKeystoreStorage()

        expect(mocks.storage.getAllKeys()).toEqual([])
        expect(mocks.calls).toEqual([
            'clearAll',
            'trim',
            'destroyMasterKey',
            'clearAll',
            'trim',
        ])
    })

    it('counts the wipe done when a master-key copy outlives its cleared records', async () => {
        mocks.records.set('m/seed-1', 'sealed')
        mocks.destroyMasterKey.mockRejectedValueOnce(new Error('keychain busy'))

        await expect(wipeKeystoreStorage()).resolves.toBeUndefined()

        expect(mocks.storage.getAllKeys()).toEqual([])
        expect(mocks.storage.trim).toHaveBeenCalledOnce()
    })
})
