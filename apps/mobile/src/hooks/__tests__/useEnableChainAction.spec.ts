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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useEnableChainAction } from '../useEnableChainAction'

const mocks = vi.hoisted(() => ({
    enableChain: vi.fn(),
    showError: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useEnableChain: () => mocks.enableChain,
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

const ETHEREUM = 'ethereum' as ChainId

describe('useEnableChainAction', () => {
    let pendingFrames: FrameRequestCallback[]

    const flushFrame = () =>
        act(() => {
            pendingFrames.splice(0).forEach(frame => frame(0))
        })

    beforeEach(() => {
        vi.clearAllMocks()
        pendingFrames = []
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
            frame => pendingFrames.push(frame),
        )
    })

    it('shows the chain as enabling before it starts deriving on the next frame', async () => {
        mocks.enableChain.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() => useEnableChainAction('Failed'))

        act(() => {
            result.current.enableChain('hd', ETHEREUM)
        })

        expect(result.current.enablingChainId).toBe(ETHEREUM)
        expect(mocks.enableChain).not.toHaveBeenCalled()

        await flushFrame()

        await waitFor(() =>
            expect(mocks.enableChain).toHaveBeenCalledWith(
                'hd',
                ETHEREUM,
                'user',
            ),
        )
    })

    it('enables the chain for the user and hands back the account', async () => {
        const enabled = { id: 'hd' }
        mocks.enableChain.mockResolvedValue(enabled)
        const onEnabled = vi.fn()
        const { result } = renderHook(() => useEnableChainAction('Failed'))

        act(() => {
            result.current.enableChain('hd', ETHEREUM, onEnabled)
        })

        expect(result.current.enablingChainId).toBe(ETHEREUM)
        await flushFrame()
        await waitFor(() =>
            expect(mocks.enableChain).toHaveBeenCalledWith(
                'hd',
                ETHEREUM,
                'user',
            ),
        )
        await waitFor(() => expect(onEnabled).toHaveBeenCalledWith(enabled))
        await waitFor(() =>
            expect(result.current.enablingChainId).toBeUndefined(),
        )
    })

    it('enables once when called twice before it settles', async () => {
        mocks.enableChain.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() => useEnableChainAction('Failed'))

        act(() => {
            result.current.enableChain('hd', ETHEREUM)
            result.current.enableChain('hd', ETHEREUM)
        })
        await flushFrame()

        await waitFor(() => expect(mocks.enableChain).toHaveBeenCalledTimes(1))
    })

    it('reports a failure under the given title and allows another try', async () => {
        const error = new Error('duplicate')
        mocks.enableChain.mockRejectedValueOnce(error)
        const onEnabled = vi.fn()
        const { result } = renderHook(() => useEnableChainAction('Failed'))

        act(() => {
            result.current.enableChain('hd', ETHEREUM, onEnabled)
        })
        await flushFrame()

        await waitFor(() =>
            expect(mocks.showError).toHaveBeenCalledWith(error, 'Failed', {
                notifier: undefined,
            }),
        )
        await waitFor(() =>
            expect(result.current.enablingChainId).toBeUndefined(),
        )
        expect(onEnabled).not.toHaveBeenCalled()

        mocks.enableChain.mockReturnValue(new Promise(() => {}))
        act(() => {
            result.current.enableChain('hd', ETHEREUM)
        })
        await flushFrame()
        await waitFor(() => expect(mocks.enableChain).toHaveBeenCalledTimes(2))
    })
})
