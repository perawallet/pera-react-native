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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { PeraWebBackupAccount } from '../../models'

const mocks = vi.hoisted(() => ({
    importFromSeed: vi.fn(),
}))

vi.mock('../../../shared', () => ({
    useImportAlgo25FromSeed: () => ({ importFromSeed: mocks.importFromSeed }),
}))

import { usePeraWebAccountImport } from '../usePeraWebAccountImport'

const account = (
    overrides: Partial<PeraWebBackupAccount> = {},
): PeraWebBackupAccount => ({
    address: 'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
    name: 'Pera Web Account',
    accountType: 'single',
    privateKey: new Uint8Array(32).fill(3),
    metadata: null,
    ...overrides,
})

const renderImport = () =>
    renderHook(() => usePeraWebAccountImport()).result.current.importAccount

beforeEach(() => {
    vi.clearAllMocks()
})

describe('usePeraWebAccountImport', () => {
    it('delegates to the shared algo25-from-seed import with mapped fields', async () => {
        const imported = { address: 'A' }
        mocks.importFromSeed.mockResolvedValue(imported)
        const acc = account()

        const importAccount = renderImport()
        const result = await importAccount(acc)

        expect(mocks.importFromSeed).toHaveBeenCalledWith({
            address: acc.address,
            privateKey: acc.privateKey,
            name: acc.name,
        })
        expect(result).toBe(imported)
    })

    it('throws without importing when the decrypted private key is missing', async () => {
        const importAccount = renderImport()

        await expect(
            importAccount(account({ privateKey: null })),
        ).rejects.toThrow('missing private_key')
        expect(mocks.importFromSeed).not.toHaveBeenCalled()
    })
})
