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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const sentMessages: string[] = []
let inboundHandler: ((data: string) => void) | null = null

const signalClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn((cb: (d: string) => void) => {
        inboundHandler = cb
    }),
    onClose: vi.fn(),
    send: vi.fn((data: string) => sentMessages.push(data)),
    close: vi.fn(),
}
const service = {
    createSignalClient: vi.fn(() => signalClient),
    runCeremony: vi.fn().mockResolvedValue({ credentialId: 'cred-1' }),
    getSessionCookie: vi.fn().mockResolvedValue('connect.sid=abc'),
}

vi.mock('../hooks/useLiquidAuthService', () => ({
    useLiquidAuthService: () => service,
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    useArc0001Resolver: () => vi.fn(),
    useEnqueueArc0001SignRequest: () => vi.fn(),
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: Object.assign(
        () => [{ address: 'ADDR1', keyPairId: 'key-1', type: 'hd-wallet' }],
        {
            getState: () => ({
                accounts: [
                    { address: 'ADDR1', keyPairId: 'key-1', type: 'hd-wallet' },
                ],
            }),
        },
    ),
}))

import { useLiquidAuth, type UseLiquidAuthConfig } from '../hooks/useLiquidAuth'
import { useLiquidAuthRegistryStore } from '../store/registryStore'
import { useLiquidAuthStore } from '../store/store'
import { encodeFrame, decodeFrame } from '../arc0027/codec'

const makeConfig = (
    overrides: Partial<UseLiquidAuthConfig> = {},
): UseLiquidAuthConfig => ({
    providerId: 'pera',
    name: 'Pera',
    networks: [{ genesisHash: 'gh', genesisId: 'mainnet-v1.0' }],
    enqueueArc60: vi.fn(),
    submitSignedTxns: vi.fn(),
    ...overrides,
})

describe('useLiquidAuth', () => {
    beforeEach(() => {
        sentMessages.length = 0
        inboundHandler = null
        vi.clearAllMocks()
        useLiquidAuthStore.getState().resetState()
    })

    it('connect runs the ceremony, opens the channel, and answers discover', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))
        await act(async () => {
            await result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
            })
        })
        expect(service.runCeremony).toHaveBeenCalledWith(
            expect.objectContaining({
                origin: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
                keyId: 'key-1',
            }),
        )
        // The session cookie captured after the ceremony is threaded into the
        // signaling client so the server joins it to the dApp's session room.
        expect(service.getSessionCookie).toHaveBeenCalledWith(
            'https://debug.liquidauth.com',
        )
        expect(service.createSignalClient).toHaveBeenCalledWith(
            'https://debug.liquidauth.com',
            'connect.sid=abc',
        )
        expect(signalClient.connect).toHaveBeenCalledWith('req-1')
        // Transport up => the connection is established: the session is
        // persisted and the connecting status is cleared (no enable handshake).
        expect(useLiquidAuthStore.getState().pendingConnection).toBeNull()
        const { sessions } = useLiquidAuthStore.getState()
        expect(sessions).toHaveLength(1)
        expect(sessions[0]).toMatchObject({
            sessionId: 'req-1',
            host: 'https://debug.liquidauth.com',
            accounts: ['ADDR1'],
            credentialId: 'cred-1',
        })

        await act(async () => {
            inboundHandler?.(
                encodeFrame({
                    id: 'd1',
                    reference: 'arc0027:discover:request',
                }),
            )
            await Promise.resolve()
        })
        const response = decodeFrame(sentMessages.at(-1) as string) as Record<
            string,
            unknown
        >
        expect(response).toMatchObject({
            reference: 'arc0027:discover:response',
            requestId: 'd1',
        })
    })

    it('shows a pending connection while the transport is being established, then clears it', async () => {
        let pendingAtConnect:
            | { host: string; requestId: string }
            | null
            | undefined
        signalClient.connect.mockImplementationOnce(async () => {
            pendingAtConnect = useLiquidAuthStore.getState().pendingConnection
        })

        const { result } = renderHook(() => useLiquidAuth(makeConfig()))
        await act(async () => {
            await result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
            })
        })

        expect(pendingAtConnect).toEqual({
            host: 'https://debug.liquidauth.com',
            requestId: 'req-1',
        })
        expect(useLiquidAuthStore.getState().pendingConnection).toBeNull()
    })

    it('times out a stalled transport, closes the client, and clears pending', async () => {
        vi.useFakeTimers()
        // client.connect never resolves — simulate a stalled WebRTC handshake.
        signalClient.connect.mockReturnValueOnce(new Promise<void>(() => {}))

        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        let connectPromise: Promise<void> = Promise.resolve()
        await act(async () => {
            connectPromise = result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-stall',
                address: 'ADDR1',
            })
        })

        // Pending connection is shown while the transport is being established.
        expect(useLiquidAuthStore.getState().pendingConnection).toEqual({
            host: 'https://debug.liquidauth.com',
            requestId: 'req-stall',
        })

        const assertion = expect(connectPromise).rejects.toThrow(
            'The dApp did not respond. Please try again.',
        )

        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000)
        })
        await assertion

        expect(signalClient.close).toHaveBeenCalledTimes(1)
        expect(useLiquidAuthStore.getState().pendingConnection).toBeNull()
        expect(
            useLiquidAuthRegistryStore.getState().clients['req-stall'],
        ).toBeUndefined()

        vi.useRealTimers()
    })

    it('closes the signal client and does not register it when connect rejects', async () => {
        signalClient.connect.mockRejectedValueOnce(new Error('signaling down'))

        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        await act(async () => {
            await expect(
                result.current.connect({
                    host: 'https://debug.liquidauth.com',
                    requestId: 'req-fail',
                    address: 'ADDR1',
                }),
            ).rejects.toThrow('signaling down')
        })

        expect(signalClient.close).toHaveBeenCalledTimes(1)
        expect(
            useLiquidAuthRegistryStore.getState().clients['req-fail'],
        ).toBeUndefined()
    })

    it('answers enable with the FIDO-bound account without a second approval', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        await act(async () => {
            await result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
            })
        })

        await act(async () => {
            inboundHandler?.(
                encodeFrame({
                    id: 'e1',
                    reference: 'arc0027:enable:request',
                }),
            )
            await Promise.resolve()
            await Promise.resolve()
        })

        const response = decodeFrame(sentMessages.at(-1) as string) as {
            reference: string
            requestId: string
            result: { accounts: { address: string }[] }
        }
        expect(response).toMatchObject({
            reference: 'arc0027:enable:response',
            requestId: 'e1',
        })
        expect(response.result.accounts).toContainEqual({ address: 'ADDR1' })
    })

    it('reuses a persisted passkey on reconnect: asserts the stored credentialId and keeps one session', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        // First connect: no prior credential => attestation (no credentialId in).
        await act(async () => {
            await result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
            })
        })
        expect(service.runCeremony).toHaveBeenLastCalledWith(
            expect.objectContaining({ credentialId: undefined }),
        )

        // Reconnect (new requestId): the persisted credentialId is reused, and
        // the session list stays at one entry (keyed by host+account).
        await act(async () => {
            await result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-2',
                address: 'ADDR1',
            })
        })
        expect(service.runCeremony).toHaveBeenLastCalledWith(
            expect.objectContaining({ credentialId: 'cred-1' }),
        )
        expect(useLiquidAuthStore.getState().sessions).toHaveLength(1)
    })

    it('disconnect removes the session but keeps the durable credential (reconnect still reuses)', async () => {
        const { result } = renderHook(() => useLiquidAuth(makeConfig()))

        await act(async () => {
            await result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ADDR1',
            })
        })
        expect(useLiquidAuthStore.getState().sessions).toHaveLength(1)
        expect(useLiquidAuthStore.getState().credentials).toHaveLength(1)

        act(() => result.current.disconnect('req-1'))
        // Session gone (leaves Connected Apps); credential record survives.
        expect(useLiquidAuthStore.getState().sessions).toHaveLength(0)
        expect(useLiquidAuthStore.getState().credentials).toHaveLength(1)

        await act(async () => {
            await result.current.connect({
                host: 'https://debug.liquidauth.com',
                requestId: 'req-2',
                address: 'ADDR1',
            })
        })
        // Reuses the passkey despite the prior disconnect.
        expect(service.runCeremony).toHaveBeenLastCalledWith(
            expect.objectContaining({ credentialId: 'cred-1' }),
        )
    })
})
