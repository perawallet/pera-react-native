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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    reject: vi.fn(),
    useDappRequest: vi.fn(),
}))

vi.mock('../../../hooks/useDappRequest.web', () => ({
    useDappRequest: mocks.useDappRequest,
}))

// Resolves against the REAL en.json rather than echoing keys back: the hook
// exists to produce a sentence naming the active network, so a missing key or
// an unfilled placeholder must show up here.
vi.mock('@hooks/useLanguage', async () => {
    const en = (
        await vi.importActual<{ default: Record<string, unknown> }>(
            '../../../../../i18n/locales/en.json',
        )
    ).default
    const lookup = (key: string): string => {
        const value = key
            .split('.')
            .reduce<unknown>(
                (node, part) =>
                    typeof node === 'object' && node !== null
                        ? (node as Record<string, unknown>)[part]
                        : undefined,
                en,
            )
        return typeof value === 'string' ? value : key
    }
    return {
        useLanguage: () => ({
            t: (key: string, values?: Record<string, unknown>) =>
                lookup(key).replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
                    values && name in values ? String(values[name]) : match,
                ),
        }),
    }
})

import { useWcErrorScreen } from '../useWcErrorScreen'

const errorApproval = (
    overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
    kind: 'connection-error',
    requestId: 'connection-error-1',
    reason: 'network-mismatch',
    origin: 'https://dapp.example',
    peer: { name: 'dApp', url: 'https://dapp.example' },
    activeNetwork: 'mainnet',
    ...overrides,
})

describe('useWcErrorScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useDappRequest.mockReturnValue({
            approval: errorApproval(),
            isLoading: false,
            reject: mocks.reject,
        })
    })

    it('names the network the wallet is on, with every placeholder filled', () => {
        const { result } = renderHook(() => useWcErrorScreen())
        const message = result.current.error?.message ?? ''

        expect(message).not.toBe('walletconnect.request.error_network_mismatch')
        expect(message).toContain('MainNet')
        expect(message).not.toContain('{{')
    })

    it('gives every network a real name, not a raw i18n key', () => {
        for (const activeNetwork of ['testnet', 'betanet']) {
            mocks.useDappRequest.mockReturnValue({
                approval: errorApproval({ activeNetwork }),
                isLoading: false,
                reject: mocks.reject,
            })

            const message =
                renderHook(() => useWcErrorScreen()).result.current.error
                    ?.message ?? ''

            expect(message).not.toContain('walletconnect.request.networks_')
        }
    })

    it('settles the approval on acknowledge so the bridge closes the window', () => {
        const { result } = renderHook(() => useWcErrorScreen())

        act(() => {
            result.current.handleAcknowledge()
        })

        // reject, not approve: nothing was granted. It also re-arms the host's
        // one-notice-at-a-time guard.
        expect(mocks.reject).toHaveBeenCalledTimes(1)
    })

    it('renders nothing until an approval of its own kind has loaded', () => {
        mocks.useDappRequest.mockReturnValue({
            approval: null,
            isLoading: true,
            reject: mocks.reject,
        })

        expect(renderHook(() => useWcErrorScreen()).result.current.error).toBe(
            null,
        )
    })

    it('produces no error for an approval of a different kind', () => {
        mocks.useDappRequest.mockReturnValue({
            approval: { kind: 'connection-proposal', requestId: 'x' },
            isLoading: false,
            reject: mocks.reject,
        })

        expect(renderHook(() => useWcErrorScreen()).result.current.error).toBe(
            null,
        )
    })
})
