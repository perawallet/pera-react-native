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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const useWalletConnectSpy = vi.fn()

let state = {
    walletConnectConnections: [
        { clientId: 'client-1' },
        { clientId: 'client-2' },
        // A session with no clientId can never be disconnected — deleteAllSessions
        // must skip it rather than sending an ill-formed control message.
        { clientId: undefined },
    ] as { clientId: string | undefined }[],
}

const setWalletConnectConnections = vi.fn(
    (next: { clientId: string | undefined }[]) => {
        state = { walletConnectConnections: next }
    },
)

const snapshot = () => ({ ...state, setWalletConnectConnections })

// Mirrors the real `useWalletConnectStore`'s dual nature: callable as a
// selector hook AND exposing `.getState()`, so the hook under test — which
// reads `getState()` fresh at write time rather than closing over a stale
// render value (see its doc comment) — exercises the same shape it does in
// production.
const useWalletConnectStoreMock = Object.assign(
    (selector: (state: ReturnType<typeof snapshot>) => unknown) =>
        selector(snapshot()),
    { getState: snapshot },
)

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: (...args: unknown[]) => useWalletConnectSpy(...args),
    useWalletConnectStore: useWalletConnectStoreMock,
}))

const mockSendWcControlMessage = vi.fn()
vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    sendWcControlMessage: (...args: unknown[]) =>
        mockSendWcControlMessage(...args),
}))

describe('useWalletConnectSessionsControl (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state = {
            walletConnectConnections: [
                { clientId: 'client-1' },
                { clientId: 'client-2' },
                { clientId: undefined },
            ],
        }
        mockSendWcControlMessage.mockResolvedValue(undefined)
    })

    it('reads connections off the store instead of calling useWalletConnect', async () => {
        const { useWalletConnectSessionsControl } =
            await import('../useWalletConnectSessionsControl.web')
        const { result } = renderHook(() => useWalletConnectSessionsControl())

        expect(result.current.connections).toEqual(
            state.walletConnectConnections,
        )
        expect(useWalletConnectSpy).not.toHaveBeenCalled()
    })

    it('disconnect sends a disconnect control message for the given clientId', async () => {
        const { useWalletConnectSessionsControl } =
            await import('../useWalletConnectSessionsControl.web')
        const { result } = renderHook(() => useWalletConnectSessionsControl())

        await result.current.disconnect('client-1')

        expect(mockSendWcControlMessage).toHaveBeenCalledWith({
            kind: 'disconnect',
            clientId: 'client-1',
        })
    })

    // I-1: a revoked session must disappear from the list it's rendered
    // from, not just notify the dApp. Asserting only that the control
    // message was sent (the previous version of this test) would pass even
    // if the row never left the screen.
    it('disconnect removes the session from the returned connections list', async () => {
        const { useWalletConnectSessionsControl } =
            await import('../useWalletConnectSessionsControl.web')
        const { result, rerender } = renderHook(() =>
            useWalletConnectSessionsControl(),
        )

        await result.current.disconnect('client-1')
        rerender()

        expect(
            result.current.connections.some(
                connection => connection.clientId === 'client-1',
            ),
        ).toBe(false)
        expect(result.current.connections).toHaveLength(2)
    })

    it('deleteAllSessions disconnects every stored session that has a clientId', async () => {
        const { useWalletConnectSessionsControl } =
            await import('../useWalletConnectSessionsControl.web')
        const { result } = renderHook(() => useWalletConnectSessionsControl())

        await result.current.deleteAllSessions()

        expect(mockSendWcControlMessage).toHaveBeenCalledTimes(2)
        expect(mockSendWcControlMessage).toHaveBeenCalledWith({
            kind: 'disconnect',
            clientId: 'client-1',
        })
        expect(mockSendWcControlMessage).toHaveBeenCalledWith({
            kind: 'disconnect',
            clientId: 'client-2',
        })
    })

    // I-1: deleteAllSessions fans out concurrent disconnect() calls. Each
    // one reads getState() fresh right before filtering (rather than the
    // connections array captured at render time), so the second call to
    // settle doesn't overwrite the first's removal with a stale snapshot
    // that still contains it.
    it('deleteAllSessions leaves every disconnected session out of the final store state', async () => {
        const { useWalletConnectSessionsControl } =
            await import('../useWalletConnectSessionsControl.web')
        const { result, rerender } = renderHook(() =>
            useWalletConnectSessionsControl(),
        )

        await result.current.deleteAllSessions()
        rerender()

        expect(result.current.connections).toEqual([])
    })

    // Native's deleteAllSessions ends with an unconditional
    // setConnections([]) — wiping the list including a clientId-less row
    // disconnect() could never target by itself. Asserts parity with that
    // behavior.
    it('deleteAllSessions clears clientId-less rows too, matching native', async () => {
        const { useWalletConnectSessionsControl } =
            await import('../useWalletConnectSessionsControl.web')
        const { result, rerender } = renderHook(() =>
            useWalletConnectSessionsControl(),
        )

        expect(
            result.current.connections.some(
                connection => connection.clientId === undefined,
            ),
        ).toBe(true)

        await result.current.deleteAllSessions()
        rerender()

        expect(result.current.connections).toEqual([])
    })
})
