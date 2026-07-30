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

vi.mock('../../../hooks/useDappRequest', () => ({
    useDappRequest: mocks.useDappRequest,
}))

// The repo-wide setup mock for this package predates the numeric chain ids and
// exports CAIP-2 strings under `AlgorandChainId`, with no `AlgorandChain` map at
// all. Take the REAL map instead of hand-writing one here: this hook exists to
// turn a chain id into the name a user reads, so a fake map is exactly where a
// wrong id→name pairing would slip through green.
vi.mock('@perawallet/wallet-core-walletconnect', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-walletconnect')
    >('@perawallet/wallet-core-walletconnect')
    return { AlgorandChain: actual.AlgorandChain }
})

// Resolves against the REAL en.json rather than echoing keys back. The point of
// this hook is a sentence naming both networks, so the test has to see the
// actual copy: a key that doesn't exist, or a placeholder the hook never fills,
// both show up here instead of passing as an echoed key.
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
        // Missing keys echo back, exactly as i18next does — so an assertion
        // against real copy fails loudly instead of silently matching a key.
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

const wcErrorApproval = (
    overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
    kind: 'wc-error',
    requestId: 'wc-wc-error-client-1',
    clientId: 'client-1',
    reason: 'network-mismatch',
    origin: 'https://dapp.example',
    requestedChainId: 416_002,
    activeNetwork: 'mainnet',
    ...overrides,
})

describe('useWcErrorScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useDappRequest.mockReturnValue({
            approval: wcErrorApproval(),
            isLoading: false,
            reject: mocks.reject,
        })
    })

    it('names the chain the dApp asked for and the network the wallet is on', () => {
        const { result } = renderHook(() => useWcErrorScreen())
        const message = result.current.error?.message ?? ''

        // Asserted by shape rather than by pasting the whole sentence, so
        // copy edits don't break it — but the ORDER is asserted, because
        // getting the two sides the wrong way round produces a fluent
        // sentence that tells the user to switch to the network they are
        // already on. That is the failure worth catching.
        expect(message).not.toBe('walletconnect.request.error_network_mismatch')
        expect(message).toContain('Testnet')
        expect(message).toContain('Mainnet')
        expect(message.indexOf('Testnet')).toBeLessThan(
            message.indexOf('Mainnet'),
        )
        expect(message).not.toContain('{{')
    })

    it('gives betanet a real name, not a raw i18n key', () => {
        // Betanet IS in AlgorandChain and can never satisfy
        // expectedChainIdForNetwork, so it reaches this surface routinely —
        // the case that caught a missing `networks_betanet` key, which showed
        // the user the key itself.
        mocks.useDappRequest.mockReturnValue({
            approval: wcErrorApproval({ requestedChainId: 416_003 }),
            isLoading: false,
            reject: mocks.reject,
        })

        const message =
            renderHook(() => useWcErrorScreen()).result.current.error
                ?.message ?? ''

        expect(message).toContain('Betanet')
        expect(message).not.toContain('walletconnect.request.networks_')
    })

    it('falls back to the raw chain id for a chain outside the known map', () => {
        // Rendering "undefined" at the user would be worse than the number.
        mocks.useDappRequest.mockReturnValue({
            approval: wcErrorApproval({ requestedChainId: 999_999 }),
            isLoading: false,
            reject: mocks.reject,
        })

        expect(
            renderHook(() => useWcErrorScreen()).result.current.error?.message,
        ).toContain('connect on 999999')
    })

    it('settles the approval on acknowledge so the bridge closes the window', () => {
        const { result } = renderHook(() => useWcErrorScreen())

        act(() => {
            result.current.handleAcknowledge()
        })

        // reject, not approve: nothing was granted. It also re-arms the host's
        // one-notice-at-a-time guard, which clears when this settles.
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
        // The router only sends wc-error here, but the hook reads a widened
        // `PendingApproval | null`; narrowing on `kind` is what stops it
        // inventing a network-mismatch message for, say, a wc-connect.
        mocks.useDappRequest.mockReturnValue({
            approval: { kind: 'wc-connect', requestId: 'x' },
            isLoading: false,
            reject: mocks.reject,
        })

        expect(renderHook(() => useWcErrorScreen()).result.current.error).toBe(
            null,
        )
    })
})
