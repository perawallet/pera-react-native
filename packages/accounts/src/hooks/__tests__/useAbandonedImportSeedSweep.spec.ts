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

// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    sweep: vi.fn<
        (remove: (seedId: string) => Promise<void>) => Promise<void>
    >(),
    remove: vi.fn(async (_seedId: string) => {}),
    warn: vi.fn(),
    hasHydrated: vi.fn(() => false),
    onFinishHydration: vi.fn((_onHydrated: () => void) => () => {}),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({ removeKeyAndChildren: mocks.remove }),
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: mocks.warn },
}))
vi.mock('../../import-session', () => ({
    sweepAbandonedImportSeeds: mocks.sweep,
}))
vi.mock('../../import-session/provisionalImportSeeds', () => ({
    getPasskeyAnchorSeedIds: vi.fn(),
}))
vi.mock('../../store', () => ({
    useAccountsStore: {
        persist: {
            hasHydrated: mocks.hasHydrated,
            onFinishHydration: mocks.onFinishHydration,
        },
    },
}))

import { useAbandonedImportSeedSweep } from '../useAbandonedImportSeedSweep'

describe('useAbandonedImportSeedSweep', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.hasHydrated.mockReturnValue(false)
        mocks.sweep.mockResolvedValue(undefined)
    })

    it('waits for enablement and hydration, and sweeps only once', async () => {
        const { rerender } = renderHook(useAbandonedImportSeedSweep, {
            initialProps: { isEnabled: false },
        })
        expect(mocks.onFinishHydration).not.toHaveBeenCalled()
        expect(mocks.sweep).not.toHaveBeenCalled()

        rerender({ isEnabled: true })
        expect(mocks.onFinishHydration).toHaveBeenCalledOnce()
        expect(mocks.sweep).not.toHaveBeenCalled()
        const [onHydrated] = mocks.onFinishHydration.mock.calls[0]
        mocks.hasHydrated.mockReturnValue(true)
        act(onHydrated)

        expect(mocks.sweep).toHaveBeenCalledOnce()
        const [remove] = mocks.sweep.mock.calls[0]
        await remove('abandoned')
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('abandoned')

        rerender({ isEnabled: false })
        rerender({ isEnabled: true })
        expect(mocks.sweep).toHaveBeenCalledOnce()
    })

    it('logs a failed sweep without rejecting app startup', async () => {
        const error = new Error('keystore unavailable')
        mocks.hasHydrated.mockReturnValue(true)
        mocks.sweep.mockRejectedValueOnce(error)
        renderHook(useAbandonedImportSeedSweep, {
            initialProps: { isEnabled: true },
        })

        await waitFor(() =>
            expect(mocks.warn).toHaveBeenCalledExactlyOnceWith(
                'Abandoned import seed sweep failed',
                { error },
            ),
        )
    })
})
