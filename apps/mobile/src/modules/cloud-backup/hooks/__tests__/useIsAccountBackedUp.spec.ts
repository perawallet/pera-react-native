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
import { useIsAccountBackedUp } from '../useIsAccountBackedUp'

const { syncStateMock } = vi.hoisted(() => {
    const live = {
        type: 'ACCOUNT',
        knownVer: 1,
        baseVer: 1,
        isDirty: false,
        status: 'ACTIVE',
        lastRemoteHash: 'h',
    }
    return {
        syncStateMock: {
            current: {
                items: {
                    'accounts/A': live,
                    'accounts/PENDING': { ...live, pendingImport: true },
                },
            },
        },
    }
})

vi.mock('@perawallet/wallet-core-backup', async () => ({
    useBackupSyncStateStore: (selector: (state: unknown) => unknown) =>
        selector({ syncState: syncStateMock.current }),
    ...(await vi.importActual<
        typeof import('../../../../../../../packages/backup/src/cloud/models/reviewBuckets')
    >('../../../../../../../packages/backup/src/cloud/models/reviewBuckets')),
}))

describe('useIsAccountBackedUp', () => {
    it('reports an address the backup holds', () => {
        const { result } = renderHook(() => useIsAccountBackedUp('A'))

        expect(result.current).toBe(true)
    })

    it('reports an unknown address and one awaiting review as not backed up', () => {
        expect(renderHook(() => useIsAccountBackedUp('B')).result.current).toBe(
            false,
        )
        expect(
            renderHook(() => useIsAccountBackedUp('PENDING')).result.current,
        ).toBe(false)
    })
})
