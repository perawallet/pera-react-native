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

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { multisigChainAdapters, ParticipantVerdicts } from '../../chain-adapter'
import { fakeMultisigAdapter } from '../../__tests__/fakeMultisigAdapter'
import { useParticipantVerdictQuery } from '../useParticipantVerdictQuery'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as ChainScope

describe('useParticipantVerdictQuery', () => {
    let queryClient: QueryClient
    const classifyParticipant = vi.fn()

    beforeEach(() => {
        classifyParticipant.mockReset()
        multisigChainAdapters.reset()
        multisigChainAdapters.register(
            fakeMultisigAdapter({ classifyParticipant }),
        )
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    afterEach(() => {
        multisigChainAdapters.reset()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    test("returns the scope's chain verdict for the address", async () => {
        classifyParticipant.mockResolvedValue('incompatible-scheme')

        const { result } = renderHook(
            () => useParticipantVerdictQuery({ address: 'ADDR', scope: SCOPE }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.verdict).toBe('incompatible-scheme'),
        )
        expect(classifyParticipant).toHaveBeenCalledWith('ADDR', SCOPE)
    })

    test('treats every address as unclassified on a chain that classifies none', async () => {
        multisigChainAdapters.reset()
        multisigChainAdapters.register(
            fakeMultisigAdapter({ classifyParticipant: undefined }),
        )

        const { result } = renderHook(
            () => useParticipantVerdictQuery({ address: 'ADDR', scope: SCOPE }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.verdict).toBe(
                ParticipantVerdicts.unclassified,
            ),
        )
    })

    test('reports no verdict when the chain fails to classify', async () => {
        classifyParticipant.mockRejectedValue(new Error('indexer down'))

        const { result } = renderHook(
            () => useParticipantVerdictQuery({ address: 'ADDR', scope: SCOPE }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(result.current.verdict).toBeNull()
    })

    test('does not classify an empty or disabled address', () => {
        renderHook(
            () => useParticipantVerdictQuery({ address: '', scope: SCOPE }),
            { wrapper },
        )
        renderHook(
            () =>
                useParticipantVerdictQuery({
                    address: 'ADDR',
                    scope: SCOPE,
                    enabled: false,
                }),
            { wrapper },
        )

        expect(classifyParticipant).not.toHaveBeenCalled()
    })
})
