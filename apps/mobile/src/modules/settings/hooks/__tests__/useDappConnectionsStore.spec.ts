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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@test-utils/render'
import {
    DAPP_PERMISSIONS_STORAGE_KEY,
    type DappPermissionsMap,
} from '@perawallet/wallet-core-arc0027'
const signingAccounts = vi.hoisted(() => ({
    current: [] as { address: string }[],
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: () => signingAccounts.current,
}))

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
        // Both grants are held by accounts the wallet still has, unless a
        // test narrows this.
        signingAccounts.current = [{ address: 'ADDR_A' }, { address: 'ADDR_B' }]
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

    // Deleting a wallet account left its address granted to every origin that had
    // it, which surfaced later as a confusing "unauthorized signer" instead of an
    // honest missing grant. Nothing observes account removal, so this screen
    // self-heals on read.
    describe('stale grants after an account is deleted', () => {
        it('drops addresses the wallet no longer holds', async () => {
            signingAccounts.current = [{ address: 'ADDR_B' }]

            const { result } = renderHook(() => useDappConnectionsStore(), {
                wrapper: buildWrapper(),
            })
            await waitFor(() => expect(result.current.isLoading).toBe(false))

            // old.com only ever had ADDR_A, so it disappears entirely; new.com
            // keeps the address that still exists.
            expect(result.current.sites.map(s => s.origin)).toEqual([
                'https://new.com',
            ])
            expect(result.current.sites[0]?.addresses).toEqual(['ADDR_B'])
        })

        it('persists the prune rather than only filtering the view', async () => {
            signingAccounts.current = [{ address: 'ADDR_B' }]

            const { result } = renderHook(() => useDappConnectionsStore(), {
                wrapper: buildWrapper(),
            })
            await waitFor(() => expect(result.current.isLoading).toBe(false))

            const stored = area.backing[
                DAPP_PERMISSIONS_STORAGE_KEY
            ] as DappPermissionsMap
            expect(stored['https://old.com']).toBeUndefined()
            expect(stored['https://new.com']?.addresses).toEqual(['ADDR_B'])
        })
    })
})
