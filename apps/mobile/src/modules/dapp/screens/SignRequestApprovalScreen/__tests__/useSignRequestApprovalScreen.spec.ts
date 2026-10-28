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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import type { WireSubmitFailure } from '@perawallet/wallet-core-browser-runtime'

const mocks = vi.hoisted(() => {
    class GenesisHashMismatchError extends Error {}
    const enqueue = vi.fn()
    return {
        GenesisHashMismatchError,
        useDappRequest: vi.fn(),
        enqueue,
        transactionSigning: new Map([['algorand', enqueue]]),
        addSignRequest: vi.fn(),
        removeSignRequest: vi.fn(),
        useSigningRequest: vi.fn(),
        isSignRequestAwaitingPreflight: vi.fn(() => false),
        enqueueInboundRequest: vi.fn(),
        isConnectionAlive: vi.fn(() => true),
        resolveConnectionRequest: vi.fn(),
        declineConnectionRequest: vi.fn(),
        failConnectionRequest: vi.fn(),
        submitConnectionRequest: vi.fn(),
        decodeWalletOperation: vi.fn(),
        encodeWalletOperationResult: vi.fn(),
        useAllAccounts: vi.fn(),
        confirmNetworkSwitch: vi.fn(),
    }
})

vi.mock('../../../hooks/useDappRequest.web', () => ({
    useDappRequest: mocks.useDappRequest,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: mocks.useSigningRequest,
    isSignRequestAwaitingPreflight: mocks.isSignRequestAwaitingPreflight,
    isSignRequestPending: vi.fn(),
    isSignRequestPastApproval: vi.fn(),
    GenesisHashMismatchError: mocks.GenesisHashMismatchError,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: mocks.useAllAccounts,
}))

vi.mock('@modules/connections/web', () => ({
    useNetworkSwitchPrompt: () => mocks.confirmNetworkSwitch,
}))

vi.mock('@perawallet/wallet-core-connections', () => ({
    enqueueInboundRequest: mocks.enqueueInboundRequest,
    isConnectionAlive: mocks.isConnectionAlive,
    useChainTransactionSigning: () => mocks.transactionSigning,
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    resolveConnectionRequest: mocks.resolveConnectionRequest,
    declineConnectionRequest: mocks.declineConnectionRequest,
    failConnectionRequest: mocks.failConnectionRequest,
    submitConnectionRequest: mocks.submitConnectionRequest,
    rebuildWireError: ({ name, message, messageKey }: WireSubmitFailure) =>
        Object.assign(
            new AppError(message, {
                category: ErrorCategory.CONNECTIONS,
                messageKey,
            }),
            { name },
        ),
    decodeWalletOperation: mocks.decodeWalletOperation,
    encodeWalletOperationResult: mocks.encodeWalletOperationResult,
}))

vi.mock('@hooks/useLanguage')

import { useDatabaseReadinessStore } from '@hooks/useDatabaseReadinessStore.web'
import { useApprovalConfirmedStore } from '@hooks/useApprovalConfirmedStore.web'
import { APPROVAL_SUCCESS_CLOSE_DELAY_MS } from '@constants/ui'
import { useSignRequestApprovalScreen } from '../useSignRequestApprovalScreen.web'

const SIGNER = {
    id: 'signer',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: 'ADDR', keyPairId: 'signer-key' } },
}
const AUTH_SIGNER = {
    id: 'auth-signer',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'AUTH' } },
}

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
    chainId: 'algorand' as const,
    operation: WIRE_OPERATION,
    authorizedAccounts: ['ADDR'],
    peer: PEER,
    sourceType: 'injected' as const,
}

describe('useSignRequestApprovalScreen', () => {
    let closeSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
        mocks.useDappRequest.mockReset()
        mocks.enqueue.mockReset()
        mocks.addSignRequest.mockReset()
        mocks.useSigningRequest.mockReset()
        mocks.declineConnectionRequest.mockReset()
        mocks.failConnectionRequest.mockReset()
        mocks.failConnectionRequest.mockResolvedValue(undefined)
        mocks.useAllAccounts.mockReset()
        mocks.enqueueInboundRequest.mockReset()
        mocks.resolveConnectionRequest.mockReset()
        mocks.decodeWalletOperation.mockReset()
        mocks.encodeWalletOperationResult.mockReset()
        mocks.removeSignRequest.mockReset()
        mocks.isConnectionAlive.mockReset()
        mocks.isConnectionAlive.mockReturnValue(true)
        mocks.isSignRequestAwaitingPreflight.mockReset()
        mocks.isSignRequestAwaitingPreflight.mockReturnValue(false)

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
        mocks.declineConnectionRequest.mockResolvedValue(undefined)
        // Hydrated by default with the account the approval authorizes, so
        // cases exercise the post-hydration path unless they say otherwise.
        mocks.useAllAccounts.mockReturnValue([SIGNER])

        useDatabaseReadinessStore.getState().setReadiness('ready')

        closeSpy = vi.fn()
        vi.stubGlobal('close', closeSpy)
    })

    afterEach(() => {
        vi.useRealTimers()
        useApprovalConfirmedStore.getState().resetState()
    })

    it('dismiss closes the popup', () => {
        const { result } = renderHook(() => useSignRequestApprovalScreen())
        result.current.dismiss()
        expect(closeSpy).toHaveBeenCalled()
    })

    describe('account hydration gate', () => {
        it('does not enqueue while accounts are unhydrated and stays loading', () => {
            mocks.useAllAccounts.mockReturnValue([])

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueueInboundRequest).not.toHaveBeenCalled()
            expect(result.current.isLoading).toBe(true)
            expect(result.current.error).toBeNull()
        })

        it('enqueues exactly once, once accounts hydrate on a later render', () => {
            mocks.useAllAccounts.mockReturnValue([])
            const { rerender } = renderHook(() =>
                useSignRequestApprovalScreen(),
            )
            expect(mocks.enqueueInboundRequest).not.toHaveBeenCalled()

            mocks.useAllAccounts.mockReturnValue([SIGNER])
            rerender()
            rerender()

            expect(mocks.enqueueInboundRequest).toHaveBeenCalledTimes(1)
        })
    })

    describe('database readiness gate', () => {
        const SEND_APPROVAL = {
            ...CONNECTION_REQUEST_APPROVAL,
            chainId: 'base',
            operation: { type: 'send-transaction', request: '{"to":"0x1"}' },
        }

        it('holds a send until the database is ready, then enqueues it once', () => {
            useDatabaseReadinessStore.getState().setReadiness('pending')
            mocks.useDappRequest.mockReturnValue({
                requestId: 'cr1',
                approval: SEND_APPROVAL,
                isLoading: false,
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueueInboundRequest).not.toHaveBeenCalled()
            expect(result.current.isLoading).toBe(true)

            act(() => {
                useDatabaseReadinessStore.getState().setReadiness('ready')
            })

            expect(mocks.enqueueInboundRequest).toHaveBeenCalledTimes(1)
        })

        it('does not hold a request that never reads the database', () => {
            useDatabaseReadinessStore.getState().setReadiness('pending')

            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueueInboundRequest).toHaveBeenCalledTimes(1)
        })

        it('declines a send and shows the error when the database never opened', () => {
            useDatabaseReadinessStore.getState().setReadiness('pending')
            mocks.useDappRequest.mockReturnValue({
                requestId: 'cr1',
                approval: SEND_APPROVAL,
                isLoading: false,
            })
            const { result } = renderHook(() => useSignRequestApprovalScreen())

            act(() => {
                useDatabaseReadinessStore.getState().setReadiness('failed')
            })

            expect(mocks.enqueueInboundRequest).not.toHaveBeenCalled()
            expect(mocks.failConnectionRequest).toHaveBeenCalledWith('cr1')
            expect(mocks.declineConnectionRequest).not.toHaveBeenCalled()
            expect(result.current.error).toBe('dapp.sign.error.body')
            expect(result.current.isLoading).toBe(false)
            expect(closeSpy).not.toHaveBeenCalled()
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
                transactionSigning: mocks.transactionSigning,
                addSignRequest: mocks.addSignRequest,
                removeSignRequest: mocks.removeSignRequest,
                accounts: [SIGNER],
            })
            // The adapter owns validation and enqueueing; this screen never
            // re-parses the payload itself.
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
        it('hands the adapter the network-switch prompt', () => {
            renderHook(() => useSignRequestApprovalScreen())

            const [, deps] = mocks.enqueueInboundRequest.mock.calls[0]
            expect(deps.confirmNetworkSwitch).toBe(mocks.confirmNetworkSwitch)
        })

        it('enqueues a switch request from a wallet holding only EVM accounts', () => {
            const evmOnly = {
                id: 'evm',
                custody: { kind: 'local', seed: null },
                chains: { ethereum: { address: '0xEVM', keyPairId: 'k' } },
            }
            mocks.useAllAccounts.mockReturnValue([evmOnly])
            mocks.useDappRequest.mockReturnValue({
                requestId: 'cr1',
                approval: {
                    ...CONNECTION_REQUEST_APPROVAL,
                    chainId: 'base',
                    operation: { type: 'switch-network', networkId: 'mainnet' },
                    authorizedAccounts: ['0xEVM'],
                },
                isLoading: false,
            })

            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueueInboundRequest).toHaveBeenCalledTimes(1)
            expect(enqueuedMessage()).toMatchObject({
                chainId: 'base',
                operation: {
                    decoded: { type: 'switch-network', networkId: 'mainnet' },
                },
            })
        })

        it('gives the adapter every account, not only the signing ones', () => {
            mocks.useAllAccounts.mockReturnValue([SIGNER, AUTH_SIGNER])

            renderHook(() => useSignRequestApprovalScreen())

            expect(
                mocks.enqueueInboundRequest.mock.calls[0][1].accounts,
            ).toEqual([SIGNER, AUTH_SIGNER])
        })

        it('respond delivers the encoded result, shows the confirmed state, then closes after the delay', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const result = { type: 'sign-transactions', signed: ['STXN'] }
            vi.useFakeTimers()

            const responded = enqueuedMessage().respond(result)
            await vi.advanceTimersByTimeAsync(0)

            expect(mocks.encodeWalletOperationResult).toHaveBeenCalledWith(
                result,
            )
            expect(mocks.resolveConnectionRequest).toHaveBeenCalledWith('cr1', {
                wire: result,
            })
            expect(useApprovalConfirmedStore.getState().isConfirmed).toBe(true)
            expect(closeSpy).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(APPROVAL_SUCCESS_CLOSE_DELAY_MS)
            await responded
            expect(closeSpy).toHaveBeenCalledTimes(1)
        })

        it('refuses to sign against a connection the user revoked while the window was open', async () => {
            // The grant on the message is the snapshot taken when the request
            // arrived; without this the window signs for a session that no
            // longer exists and nothing on screen says so.
            mocks.isConnectionAlive.mockReturnValue(false)

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueueInboundRequest).not.toHaveBeenCalled()
            expect(mocks.failConnectionRequest).toHaveBeenCalledWith('cr1')
            expect(mocks.declineConnectionRequest).not.toHaveBeenCalled()
            expect(result.current.error).toBe('dapp.sign.connection_revoked')
        })

        describe('a handed-off send', () => {
            const SIGNED = [
                {
                    scope: { chainId: 'ethereum', networkId: 'mainnet' },
                    id: '0xh',
                    bytes: new Uint8Array([1]),
                },
            ]
            const enqueuedDeps = () =>
                mocks.enqueueInboundRequest.mock.calls[0][1]

            it('hands a signed send to the bridge and closes after the confirmed state on success', async () => {
                renderHook(() => useSignRequestApprovalScreen())
                mocks.submitConnectionRequest.mockResolvedValue({
                    ok: true,
                    txId: '0xh',
                })
                vi.useFakeTimers()

                const submitted = enqueuedDeps().submitSignedSend(SIGNED)
                await vi.advanceTimersByTimeAsync(0)

                expect(mocks.submitConnectionRequest).toHaveBeenCalledWith(
                    'cr1',
                    SIGNED,
                )
                expect(useApprovalConfirmedStore.getState().isConfirmed).toBe(
                    true,
                )
                expect(closeSpy).not.toHaveBeenCalled()

                await vi.advanceTimersByTimeAsync(
                    APPROVAL_SUCCESS_CLOSE_DELAY_MS,
                )
                expect(await submitted).toEqual({
                    status: 'submitted',
                    txId: '0xh',
                })
                expect(closeSpy).toHaveBeenCalledTimes(1)
            })

            it('keeps the window open and names the error on a failed broadcast', async () => {
                const { result } = renderHook(() =>
                    useSignRequestApprovalScreen(),
                )
                mocks.submitConnectionRequest.mockResolvedValue({
                    ok: false,
                    name: 'EvmError',
                    message: 'insufficient funds',
                    messageKey: 'errors.general.title',
                })

                const outcome = await enqueuedDeps().submitSignedSend(SIGNED)
                act(() => {
                    enqueuedDeps().onError(outcome.error)
                })

                expect(outcome.status).toBe('failed')
                expect(result.current.error).toBe('errors.general.title')
                expect(closeSpy).not.toHaveBeenCalled()
            })
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

        it('declines a pipeline reject through the approval client and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const error = new Error('execution reverted')

            await enqueuedMessage().reject(error)

            expect(mocks.declineConnectionRequest).toHaveBeenCalledWith(
                'cr1',
                error,
            )
            expect(closeSpy).toHaveBeenCalled()
            expect(useApprovalConfirmedStore.getState().isConfirmed).toBe(false)
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

        it('stays loading while its own request is still in its chain check', () => {
            // No actor exists yet, so the review would render empty.
            mocks.isSignRequestAwaitingPreflight.mockReturnValue(true)
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

            expect(result.current.isLoading).toBe(true)
        })
    })
})
