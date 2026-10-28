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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { assessSiteSafety } from '../../assess'
import { usePhishingListStore } from '../../store/store'
import { useSiteSafetyQuery } from '../useSiteSafetyQuery'

vi.mock('../../assess', () => ({ assessSiteSafety: vi.fn() }))

const BLOCKED = {
    kind: 'blocked',
    host: 'phish.example',
    reason: 'phishing-list',
} as const

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useSiteSafetyQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        usePhishingListStore.getState().resetState()
        vi.mocked(assessSiteSafety).mockResolvedValue(BLOCKED)
    })

    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('reports checking, then the verdict for the hosts it was given', async () => {
        const { result } = renderHook(
            () =>
                useSiteSafetyQuery({
                    urls: ['https://Phish.example/path', undefined],
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current).toEqual({
            verdict: { kind: 'clear' },
            isChecking: true,
        })
        await waitFor(() => expect(result.current.isChecking).toBe(false))
        expect(result.current.verdict).toEqual(BLOCKED)
        expect(assessSiteSafety).toHaveBeenCalledWith({
            urls: ['phish.example'],
            isFlaggedByWalletConnectVerify: false,
        })
    })

    it('checks again when a new copy of the lists is activated', async () => {
        const { result } = renderHook(
            () => useSiteSafetyQuery({ urls: ['https://phish.example'] }),
            { wrapper: createWrapper() },
        )
        await waitFor(() => expect(result.current.isChecking).toBe(false))

        act(() => {
            usePhishingListStore.getState().activateGeneration('metamask', {
                generation: 2,
                refreshedAt: 1,
                origin: 'downloaded',
            })
        })

        await waitFor(() => expect(assessSiteSafety).toHaveBeenCalledTimes(2))
    })

    it('answers while offline', async () => {
        onlineManager.setOnline(false)

        const { result } = renderHook(
            () => useSiteSafetyQuery({ urls: ['https://phish.example'] }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.verdict).toEqual(BLOCKED))
    })

    it('neither checks nor waits when disabled', () => {
        const { result } = renderHook(
            () =>
                useSiteSafetyQuery({
                    urls: ['https://phish.example'],
                    isEnabled: false,
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.isChecking).toBe(false)
        expect(assessSiteSafety).not.toHaveBeenCalled()
    })
})
