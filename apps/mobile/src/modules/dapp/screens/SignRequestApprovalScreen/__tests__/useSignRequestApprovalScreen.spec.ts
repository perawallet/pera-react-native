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

const mocks = vi.hoisted(() => {
    class GenesisHashMismatchError extends Error {}
    return {
        GenesisHashMismatchError,
        useDappRequest: vi.fn(),
        resolve: vi.fn(),
        enqueue: vi.fn(),
        addSignRequest: vi.fn(),
        removeSignRequest: vi.fn(),
        useSigningRequest: vi.fn(),
        enqueueInboundRequest: vi.fn(),
        isConnectionAlive: vi.fn(() => true),
        resolveConnectionRequest: vi.fn(),
        rejectApproval: vi.fn(),
        decodeWalletOperation: vi.fn(),
        encodeWalletOperationResult: vi.fn(),
        useSigningAccounts: vi.fn(),
        useAllAccounts: vi.fn(),
    }
})

vi.mock('../../../hooks/useDappRequest.web', () => ({
    useDappRequest: mocks.useDappRequest,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useArc0001Resolver: () => mocks.resolve,
    useEnqueueArc0001SignRequest: () => mocks.enqueue,
    useSigningRequest: mocks.useSigningRequest,
    GenesisHashMismatchError: mocks.GenesisHashMismatchError,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: mocks.useSigningAccounts,
    useAllAccounts: mocks.useAllAccounts,
}))

vi.mock('@perawallet/wallet-core-connections', () => ({
    enqueueInboundRequest: mocks.enqueueInboundRequest,
    isConnectionAlive: mocks.isConnectionAlive,
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    resolveConnectionRequest: mocks.resolveConnectionRequest,
    rejectApproval: mocks.rejectApproval,
    decodeWalletOperation: mocks.decodeWalletOperation,
    encodeWalletOperationResult: mocks.encodeWalletOperationResult,
}))

vi.mock('@hooks/useLanguage')

import { useSignRequestApprovalScreen } from '../useSignRequestApprovalScreen.web'

const WIRE_OPERATION = {
    type: 'sign-transactions' as const,
    group: [{ txn: 'AAA' }],
}

const PEER = {
    name: 'Dapp',
    url: 'https://dapp.example',
    icons: ['https://dapp.example/icon.png'],
}

const CONNECTION_REQUEST_APPROVAL = {
    kind: 'connection-request' as const,
    requestId: 'cr1',
    origin: 'https://dapp.example',
    connectionId: 'connection-1',
    correlationId: '9',
    operation: WIRE_OPERATION,
    authorizedAccounts: ['ADDR'],
    peer: PEER,
    sourceType: 'injected' as const,
}

describe('useSignRequestApprovalScreen', () => {
    let closeSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
        mocks.useDappRequest.mockReset()
        mocks.resolve.mockReset()
        mocks.enqueue.mockReset()
        mocks.addSignRequest.mockReset()
        mocks.useSigningRequest.mockReset()
        mocks.rejectApproval.mockReset()
        mocks.useSigningAccounts.mockReset()
        mocks.useAllAccounts.mockReset()
        mocks.enqueueInboundRequest.mockReset()
        mocks.resolveConnectionRequest.mockReset()
        mocks.decodeWalletOperation.mockReset()
        mocks.encodeWalletOperationResult.mockReset()
        mocks.removeSignRequest.mockReset()
        mocks.isConnectionAlive.mockReset()
        mocks.isConnectionAlive.mockReturnValue(true)

        mocks.resolveConnectionRequest.mockResolvedValue(undefined)
        mocks.decodeWalletOperation.mockImplementation(
            (operation: unknown) => ({ decoded: operation }),
        )
        mocks.encodeWalletOperationResult.mockImplementation(
            (result: unknown) => ({ wire: result }),
        )

        mocks.useDappRequest.mockReturnValue({
            requestId: 'cr1',
            approval: CONNECTION_REQUEST_APPROVAL,
            isLoading: false,
        })
        mocks.useSigningRequest.mockReturnValue({
            addSignRequest: mocks.addSignRequest,
            removeSignRequest: mocks.removeSignRequest,
            currentRequest: null,
        })
        mocks.rejectApproval.mockResolvedValue(undefined)
        // Hydrated by default with the account the approval authorizes, so
        // cases exercise the post-hydration path unless they say otherwise.
        mocks.useSigningAccounts.mockReturnValue([{ address: 'ADDR' }])
        mocks.useAllAccounts.mockReturnValue([{ address: 'ADDR' }])

        closeSpy = vi.fn()
        vi.stubGlobal('close', closeSpy)
    })

    it('dismiss closes the popup', () => {
        const { result } = renderHook(() => useSignRequestApprovalScreen())
        result.current.dismiss()
        expect(closeSpy).toHaveBeenCalled()
    })

    describe('account hydration gate', () => {
        it('does not enqueue while accounts are unhydrated and stays loading', () => {
            mocks.useSigningAccounts.mockReturnValue([])

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueueInboundRequest).not.toHaveBeenCalled()
            expect(result.current.isLoading).toBe(true)
            expect(result.current.error).toBeNull()
        })

        it('enqueues exactly once, once accounts hydrate on a later render', () => {
            mocks.useSigningAccounts.mockReturnValue([])
            const { rerender } = renderHook(() =>
                useSignRequestApprovalScreen(),
            )
            expect(mocks.enqueueInboundRequest).not.toHaveBeenCalled()

            mocks.useSigningAccounts.mockReturnValue([{ address: 'ADDR' }])
            rerender()
            rerender()

            expect(mocks.enqueueInboundRequest).toHaveBeenCalledTimes(1)
        })
    })

    describe('connection-request', () => {
        const enqueuedMessage = () =>
            mocks.enqueueInboundRequest.mock.calls[0][0]

        it('rebuilds the inbound message from the approval and hands it to the neutral adapter', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueueInboundRequest).toHaveBeenCalledTimes(1)
            const [message, deps] = mocks.enqueueInboundRequest.mock.calls[0]
            expect(message).toMatchObject({
                kind: 'request',
                connectionId: 'connection-1',
                correlationId: '9',
                authorizedAccounts: ['ADDR'],
                peer: PEER,
                // Hardcoding 'walletconnect' here left SignRequestView
                // rendering nothing on a mid-flight failure, because it
                // suppresses the failed view for the WalletConnect error
                // sheet — which the approval window does not have.
                sourceType: 'injected',
            })
            expect(deps).toMatchObject({
                resolveArc0001: mocks.resolve,
                enqueueArc0001: mocks.enqueue,
                addSignRequest: mocks.addSignRequest,
                removeSignRequest: mocks.removeSignRequest,
                accounts: [{ address: 'ADDR' }],
            })
            // The adapter owns validation and enqueueing; this screen never
            // re-parses the payload itself.
            expect(mocks.resolve).not.toHaveBeenCalled()
            expect(mocks.enqueue).not.toHaveBeenCalled()
            expect(mocks.addSignRequest).not.toHaveBeenCalled()
        })

        it('carries the transport-verified origin onto the inbound message', () => {
            mocks.useDappRequest.mockReturnValue({
                ...mocks.useDappRequest(),
                approval: {
                    ...CONNECTION_REQUEST_APPROVAL,
                    verifiedOrigin: 'https://dapp.example',
                },
            })

            renderHook(() => useSignRequestApprovalScreen())

            expect(enqueuedMessage().verifiedOrigin).toBe(
                'https://dapp.example',
            )
        })

        it('decodes the wire operation before enqueuing', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.decodeWalletOperation).toHaveBeenCalledWith(
                WIRE_OPERATION,
            )
            expect(enqueuedMessage().operation).toEqual({
                decoded: WIRE_OPERATION,
            })
        })

        // The adapter matches a signer against approved accounts' auth
        // addresses, and the signing-accounts filter can hide a keyless one.
        it('gives the adapter every account, not only the signing ones', () => {
            mocks.useAllAccounts.mockReturnValue([
                { address: 'ADDR' },
                { address: 'AUTH' },
            ])

            renderHook(() => useSignRequestApprovalScreen())

            expect(
                mocks.enqueueInboundRequest.mock.calls[0][1].accounts,
            ).toEqual([{ address: 'ADDR' }, { address: 'AUTH' }])
        })

        it('respond encodes the result for the wire, delivers it and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const result = { type: 'sign-transactions', signed: ['STXN'] }

            await enqueuedMessage().respond(result)

            expect(mocks.encodeWalletOperationResult).toHaveBeenCalledWith(
                result,
            )
            expect(mocks.resolveConnectionRequest).toHaveBeenCalledWith('cr1', {
                wire: result,
            })
            expect(closeSpy).toHaveBeenCalled()
        })

        it('refuses to sign against a connection the user revoked while the window was open', async () => {
            // The grant on the message is the snapshot taken when the request
            // arrived; without this the window signs for a session that no
            // longer exists and nothing on screen says so.
            mocks.isConnectionAlive.mockReturnValue(false)

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueueInboundRequest).not.toHaveBeenCalled()
            expect(mocks.rejectApproval).toHaveBeenCalledWith('cr1')
            expect(result.current.error).toBe('dapp.sign.connection_revoked')
        })

        it('surfaces an adapter failure in the window instead of closing it silently', () => {
            const { result } = renderHook(() => useSignRequestApprovalScreen())

            act(() => {
                mocks.enqueueInboundRequest.mock.calls[0][1].onError(
                    new mocks.GenesisHashMismatchError('mismatch'),
                )
            })

            expect(result.current.error).toBe('dapp.sign.network_mismatch')
            expect(closeSpy).not.toHaveBeenCalled()
        })

        it('reject rejects the approval and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())

            await enqueuedMessage().reject(new Error('User rejected'))

            expect(mocks.rejectApproval).toHaveBeenCalledWith('cr1')
            expect(closeSpy).toHaveBeenCalled()
        })

        // Closing on a failed delivery would tell the user the dApp was
        // answered when it never was.
        it('leaves the window open when a decision cannot reach the bridge', async () => {
            mocks.resolveConnectionRequest.mockRejectedValue(
                new Error('unknown request'),
            )
            renderHook(() => useSignRequestApprovalScreen())

            await expect(
                enqueuedMessage().respond({
                    type: 'sign-transactions',
                    signed: [],
                }),
            ).rejects.toThrow('unknown request')

            expect(closeSpy).not.toHaveBeenCalled()
        })

        it('enqueues exactly once even across re-renders', () => {
            const { rerender } = renderHook(() =>
                useSignRequestApprovalScreen(),
            )
            rerender()
            rerender()

            expect(mocks.enqueueInboundRequest).toHaveBeenCalledTimes(1)
        })

        // The adapter keys the sign request on the connection, not on this
        // window's approval id.
        it('correlates the pipeline currentRequest by the connectionId', () => {
            mocks.useSigningRequest.mockReturnValue({
                addSignRequest: mocks.addSignRequest,
                removeSignRequest: mocks.removeSignRequest,
                currentRequest: {
                    id: 'sr1',
                    type: 'transactions',
                    transportId: 'connection-1',
                },
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.request).toEqual({
                id: 'sr1',
                type: 'transactions',
                transportId: 'connection-1',
            })
            expect(result.current.isLoading).toBe(false)
        })

        it('does not surface a request keyed by the bridge requestId', () => {
            mocks.useSigningRequest.mockReturnValue({
                addSignRequest: mocks.addSignRequest,
                removeSignRequest: mocks.removeSignRequest,
                currentRequest: {
                    id: 'sr1',
                    type: 'transactions',
                    transportId: 'cr1',
                },
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.request).toBeNull()
            expect(result.current.isLoading).toBe(true)
        })
    })
})
