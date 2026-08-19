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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { readLedgerMock, resetModuleMock } = vi.hoisted(() => ({
    readLedgerMock: vi.fn(),
    resetModuleMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    KEYSTORE_MIGRATION_MODULES: [
        { id: 'com.perawallet.wallet/keystore-preflight', label: 'Preflight' },
        {
            id: '@algorandfoundation/react-native-keystore',
            label: 'Keystore core (upstream)',
        },
        { id: 'com.perawallet.wallet/keystore-repairs', label: 'Repairs' },
    ],
    readKeystoreMigrationLedger: readLedgerMock,
    resetKeystoreMigrationModule: resetModuleMock,
}))

import { useSettingsDeveloperKeystoreMigrationsScreen } from '../useSettingsDeveloperKeystoreMigrationsScreen'

const REPAIRS = 'com.perawallet.wallet/keystore-repairs'
const PREFLIGHT = 'com.perawallet.wallet/keystore-preflight'

beforeEach(() => {
    readLedgerMock.mockReset()
    resetModuleMock.mockReset()
    readLedgerMock.mockReturnValue({
        [REPAIRS]: {
            id: 3,
            name: 'mint-passkey-main-key',
            appliedAt: '2026-08-14T00:00:00.000Z',
        },
    })
})

describe('useSettingsDeveloperKeystoreMigrationsScreen', () => {
    it('maps recorded revisions onto the known modules, null when absent', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperKeystoreMigrationsScreen(),
        )

        expect(result.current.modules).toHaveLength(3)
        expect(
            result.current.modules.find(m => m.id === REPAIRS)?.revision?.id,
        ).toBe(3)
        expect(
            result.current.modules.find(m => m.id === PREFLIGHT)?.revision,
        ).toBeNull()
    })

    it('resetModule resets the target module then re-reads the ledger', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperKeystoreMigrationsScreen(),
        )

        readLedgerMock.mockReturnValue({})
        act(() => result.current.resetModule(REPAIRS))

        expect(resetModuleMock).toHaveBeenCalledWith(REPAIRS)
        expect(
            result.current.modules.find(m => m.id === REPAIRS)?.revision,
        ).toBeNull()
    })
})
