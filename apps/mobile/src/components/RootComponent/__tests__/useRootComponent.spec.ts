/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRootComponent } from '../useRootComponent'

const mocks = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }))

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => ({ start: mocks.start, stop: mocks.stop }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => [],
}))

vi.mock('@perawallet/wallet-core-migrate', () => ({
    useNeedsMigration: () => ({ isChecking: true, needsMigration: false }),
}))

describe('useRootComponent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('holds the background poll while the migration is still running', () => {
        renderHook(() => useRootComponent())

        expect(mocks.stop).toHaveBeenCalled()
        expect(mocks.start).not.toHaveBeenCalled()
    })
})
