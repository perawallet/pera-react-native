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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { mutationDefaults } from '@perawallet/wallet-core-shared'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const api = vi.hoisted(() => ({ freezeCard: vi.fn() }))
vi.mock('../../api/card', () => api)

import { CardStatus, type Card } from '../../models/card'
import { cardQueryKeys } from '../querykeys'
import { useFreezeCardMutation } from '../useFreezeCardMutation'

const ACTIVE_CARD: Card = {
    id: 'card_1',
    panLast4: '1234',
    status: CardStatus.Active,
}

// Mirrors the app's root QueryClient policy: the global `mutationDefaults`
// (networkMode: 'always') is what makes mutations run — and reject —
// offline instead of pausing.
const createWrapper = (queryClient: QueryClient) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
    }

describe('useFreezeCardMutation (offline optimism regression)', () => {
    afterEach(() => onlineManager.setOnline(true))

    // Pins the AC "no optimistic frozen-state divergence": onSuccess is the
    // only place the cached status flips to Frozen, so a failed-offline
    // freeze must leave the cache exactly as it was.
    it('does not flip cached status to Frozen when the freeze fails offline', async () => {
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { ...mutationDefaults, retry: false },
            },
        })
        queryClient.setQueryData(cardQueryKeys.status('mainnet'), ACTIVE_CARD)

        onlineManager.setOnline(false)
        api.freezeCard.mockRejectedValue(
            new TypeError('Network request failed'),
        )

        const { result } = renderHook(() => useFreezeCardMutation(), {
            wrapper: createWrapper(queryClient),
        })

        await act(async () => {
            await expect(result.current.mutateAsync()).rejects.toThrow()
        })

        // networkMode:'always' ran the mutationFn (which rejected) rather than
        // pausing — proving fail-fast, not pause-and-later-resume.
        expect(api.freezeCard).toHaveBeenCalledTimes(1)
        expect(
            queryClient.getQueryData(cardQueryKeys.status('mainnet')),
        ).toEqual(ACTIVE_CARD)
    })
})
