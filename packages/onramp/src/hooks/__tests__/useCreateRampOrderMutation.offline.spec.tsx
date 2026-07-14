/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { mutationDefaults } from '@perawallet/wallet-core-shared'
import React from 'react'

import { createRampOrder } from '../../api'
import { useCreateRampOrderMutation } from '../useCreateRampOrderMutation'

vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<typeof import('../../api')>()),
    createRampOrder: vi.fn(),
}))

function createWrapper() {
    // Mirror the app's root QueryClient policy: the global `mutationDefaults`
    // (networkMode: 'always') is what makes mutations run — and reject —
    // offline instead of pausing.
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { ...mutationDefaults, retry: false },
        },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('onramp/useCreateRampOrderMutation (offline fail-fast)', () => {
    afterEach(() => onlineManager.setOnline(true))

    test('fails fast (does not pause) when offline', async () => {
        onlineManager.setOnline(false)
        vi.mocked(createRampOrder).mockRejectedValue(
            new TypeError('Network request failed'),
        )

        const { result } = renderHook(() => useCreateRampOrderMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.mutate({
                quote: 'quote-1',
                sourceAmount: '100',
                sourceAddress: 'SOURCE_ADDRESS',
            })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        // Crux of OFF-004: with networkMode 'always' the mutationFn ran and
        // rejected rather than being parked as a paused mutation for later
        // auto-resume.
        expect(result.current.isPaused).toBe(false)
        expect(createRampOrder).toHaveBeenCalledTimes(1)
    })
})
