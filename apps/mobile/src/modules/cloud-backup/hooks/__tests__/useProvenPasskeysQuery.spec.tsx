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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const { useProvenPasskeysForBackupQueryMock } = vi.hoisted(() => ({
    useProvenPasskeysForBackupQueryMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useProvenPasskeysForBackupQuery: useProvenPasskeysForBackupQueryMock,
}))

import { useProvenPasskeysQuery } from '../useProvenPasskeysQuery'

describe('useProvenPasskeysQuery', () => {
    it('asks the package for the legacy chain and returns its result as is', () => {
        const packageResult = {
            passkeys: [{ credentialId: 'a' }],
            isLoading: false,
            isResolved: true,
        }
        useProvenPasskeysForBackupQueryMock.mockReturnValue(packageResult)

        const { result } = renderHook(() => useProvenPasskeysQuery())

        expect(useProvenPasskeysForBackupQueryMock).toHaveBeenCalledWith(
            LEGACY_CHAIN_ID,
        )
        expect(result.current).toBe(packageResult)
    })
})
