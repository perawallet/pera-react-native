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

// Imported by explicit path — the `unit` project cannot resolve `.web` files
// by platform extension. See `useConnectionSettingsList.web.spec.ts`.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const pairLegacy = vi.fn()

vi.mock('@modules/walletconnect/hooks/useWalletConnectPairing', () => ({
    useWalletConnectPairing: () => ({ pair: pairLegacy }),
}))

// The redaction is the real one, loaded by module path: the global setup's
// hand-written mock of the package barrel does not carry it, and a
// hand-written stand-in would prove nothing about what reaches the logs.
vi.mock('@perawallet/wallet-core-walletconnect', async () => ({
    ...(await vi.importActual<
        typeof import('@packages/walletconnect/src/shared/uri')
    >('@packages/walletconnect/src/shared/uri')),
}))

import { useConnectionPairing } from '../useConnectionPairing.web'

describe('useConnectionPairing.web', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes the URI and options straight through to the legacy pairing hook', async () => {
        pairLegacy.mockResolvedValue({ type: 'session' })
        const { result } = renderHook(() => useConnectionPairing())

        const outcome = await result.current.pair('wc:topic@1?bridge=b', {
            origin: { source: 'in-app' },
        })

        expect(pairLegacy).toHaveBeenCalledWith('wc:topic@1?bridge=b', {
            origin: { source: 'in-app' },
        })
        expect(outcome).toEqual({ type: 'session' })
    })

    it.each([
        [{ type: 'connect-failed', error: new Error('offscreen gone') }],
        [{ type: 'error', error: new Error('wrong network') }],
    ])('relays %j unchanged', async result => {
        pairLegacy.mockResolvedValue(result)
        const { result: hook } = renderHook(() => useConnectionPairing())

        await expect(hook.current.pair('wc:topic@1?bridge=b')).resolves.toEqual(
            result,
        )
    })

    // Offscreen owns the connector in the other realm, so this one has no id
    // to hand back — and the caller must not be given one it cannot watch.
    it('strips the pairing id from a timeout, since no late watch is possible here', async () => {
        pairLegacy.mockResolvedValue({ type: 'timeout', clientId: 'client-1' })
        const { result } = renderHook(() => useConnectionPairing())

        await expect(
            result.current.pair('wc:topic@1?bridge=b'),
        ).resolves.toEqual({ type: 'timeout' })
    })

    it('reports a late watch as an immediate timeout rather than hanging', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        await expect(
            result.current.watchLateOutcome('client-1', 60_000),
        ).resolves.toEqual({ type: 'timeout' })
    })

    // No registry in this realm, so the redaction comes from the protocol
    // package directly — the shared log sites still get log-safe fields.
    it('describes a URI without leaking the pairing secret', () => {
        const { result } = renderHook(() => useConnectionPairing())

        const described = result.current.describeUri(
            'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=beef',
        )

        expect(described.topic).toBe('topic')
        expect(JSON.stringify(described)).not.toContain('beef')
    })
})
