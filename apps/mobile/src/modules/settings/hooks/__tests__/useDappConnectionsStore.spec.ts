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

import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@test-utils/render'
import {
    DAPP_PERMISSIONS_STORAGE_KEY,
    type DappPermissionsMap,
} from '@perawallet/wallet-extension-platform-chrome'
import { useDappConnectionsStore } from '../useDappConnectionsStore'

// Minimal in-memory LocalStorageArea fake, mirroring
// extensions/platform-chrome/src/dapp/__tests__/permissions.test.ts.
const makeArea = () => {
    const backing: Record<string, unknown> = {}
    return {
        backing,
        get: async (key: string) =>
            key in backing ? { [key]: backing[key] } : {},
        set: async (items: Record<string, unknown>) => {
            Object.assign(backing, items)
        },
    }
}

const buildWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDappConnectionsStore', () => {
    let area: ReturnType<typeof makeArea>

    beforeEach(() => {
        area = makeArea()
        const map: DappPermissionsMap = {
            'https://old.com': {
                origin: 'https://old.com',
                addresses: ['ADDR_A'],
                grantedAt: 1000,
            },
            'https://new.com': {
                origin: 'https://new.com',
                addresses: ['ADDR_A', 'ADDR_B'],
                name: 'New Dapp',
                grantedAt: 2000,
            },
        }
        area.backing[DAPP_PERMISSIONS_STORAGE_KEY] = map
        ;(globalThis as unknown as { chrome?: unknown }).chrome = {
            storage: { local: area },
        }
    })

    afterEach(() => {
        delete (globalThis as unknown as { chrome?: unknown }).chrome
    })

    it('lists connected sites newest-first', async () => {
        const { result } = renderHook(() => useDappConnectionsStore(), {
            wrapper: buildWrapper(),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.sites.map(site => site.origin)).toEqual([
            'https://new.com',
            'https://old.com',
        ])
    })

    it('revoke removes the origin and refetches', async () => {
        const { result } = renderHook(() => useDappConnectionsStore(), {
            wrapper: buildWrapper(),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await result.current.revoke('https://new.com')

        await waitFor(() =>
            expect(result.current.sites.map(site => site.origin)).toEqual([
                'https://old.com',
            ]),
        )
    })
})
