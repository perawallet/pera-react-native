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
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import React from 'react'

import { mockRampSources } from '../../test-handlers'
import {
    FIAT_ID,
    NATIVE_ID,
    SCOPE,
    fiatAsset,
    pairRow,
} from '../../__tests__/routerFixtures'
import { useRampSourcesQuery } from '../useRampSourcesQuery'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('onramp/useRampSourcesQuery', () => {
    test("returns the destination's fiat and deposit sources", async () => {
        server.use(
            mockRampSources({
                response: {
                    next: null,
                    results: [pairRow(fiatAsset(), { kind: 'fiat' })],
                },
            }),
        )

        const { result } = renderHook(
            () =>
                useRampSourcesQuery({ scope: SCOPE, destinationId: NATIVE_ID }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.data).toHaveLength(1))

        expect(result.current.data[0].id).toBe(FIAT_ID)
    })

    test.each([
        ['a null scope', null, NATIVE_ID],
        ['a null destination', SCOPE, null],
    ])('does not fetch for %s', (_name, scope, destinationId) => {
        let requested = false
        server.use(
            http.get('*/api/v4/swap/pairs/', () => {
                requested = true
                return undefined
            }),
        )

        const { result } = renderHook(
            () => useRampSourcesQuery({ scope, destinationId }),
            { wrapper: createWrapper() },
        )

        expect(result.current.data).toEqual([])
        expect(result.current.fetchStatus).toBe('idle')
        expect(requested).toBe(false)
    })
})
