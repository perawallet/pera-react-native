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
        useSigningRequest: vi.fn(),
        isArc60WirePayload: vi.fn(),
        parseArc60WireRequest: vi.fn(),
        resolveSignTransactions: vi.fn(),
        resolveSignMessage: vi.fn(),
        rejectApproval: vi.fn(),
        generateOrderedUniqueId: vi.fn(),
        encodeToBase64: vi.fn(),
        useSigningAccounts: vi.fn(),
        canSignArc60: vi.fn(),
    }
})

vi.mock('../../../hooks/useDappRequest', () => ({
    useDappRequest: mocks.useDappRequest,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useArc0001Resolver: () => mocks.resolve,
    useEnqueueArc0001SignRequest: () => mocks.enqueue,
    useSigningRequest: mocks.useSigningRequest,
    isArc60WirePayload: mocks.isArc60WirePayload,
    parseArc60WireRequest: mocks.parseArc60WireRequest,
    GenesisHashMismatchError: mocks.GenesisHashMismatchError,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: mocks.useSigningAccounts,
    canSignArc60: mocks.canSignArc60,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    generateOrderedUniqueId: mocks.generateOrderedUniqueId,
    encodeToBase64: mocks.encodeToBase64,
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    resolveSignTransactions: mocks.resolveSignTransactions,
    resolveSignMessage: mocks.resolveSignMessage,
    rejectApproval: mocks.rejectApproval,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useSignRequestApprovalScreen } from '../useSignRequestApprovalScreen'

const SIGN_TRANSACTIONS_APPROVAL = {
    kind: 'sign-transactions' as const,
    requestId: 's1',
    origin: 'https://x',
    txns: [{ txn: 'AAA' }],
    approvedAddresses: ['ADDR'],
}

const RESOLVED = { allDecoded: [], toSign: [], signerOverrides: new Map() }

const SIGN_MESSAGE_APPROVAL = {
    kind: 'sign-message' as const,
    requestId: 'm1',
    origin: 'https://x',
    message: { authenticatorData: 'AAA', metadata: { scope: 0 } },
    approvedAddresses: ['ADDR'],
}

const PARSED_ARC60 = {
    stdSigData: {
        data: 'ZGF0YQ==',
        signer: 'ADDR',
        domain: 'x',
        authenticatorData: new Uint8Array([1]),
    },
    metadata: { scope: 0, encoding: 'base64' },
}

describe('useSignRequestApprovalScreen', () => {
    let closeSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
        mocks.useDappRequest.mockReset()
        mocks.resolve.mockReset()
        mocks.enqueue.mockReset()
        mocks.addSignRequest.mockReset()
        mocks.useSigningRequest.mockReset()
        mocks.isArc60WirePayload.mockReset()
        mocks.parseArc60WireRequest.mockReset()
        mocks.resolveSignTransactions.mockReset()
        mocks.resolveSignMessage.mockReset()
        mocks.rejectApproval.mockReset()
        mocks.generateOrderedUniqueId.mockReset()
        mocks.encodeToBase64.mockReset()
        mocks.useSigningAccounts.mockReset()
        mocks.canSignArc60.mockReset()

        mocks.useDappRequest.mockReturnValue({
            requestId: 's1',
            approval: SIGN_TRANSACTIONS_APPROVAL,
            isLoading: false,
        })
        mocks.resolve.mockReturnValue(RESOLVED)
        mocks.useSigningRequest.mockReturnValue({
            addSignRequest: mocks.addSignRequest,
            currentRequest: null,
        })
        mocks.resolveSignTransactions.mockResolvedValue(undefined)
        mocks.resolveSignMessage.mockResolvedValue(undefined)
        mocks.rejectApproval.mockResolvedValue(undefined)
        mocks.generateOrderedUniqueId.mockReturnValue('generated-id')
        mocks.encodeToBase64.mockImplementation(
            (bytes: Uint8Array) => `base64(${bytes.join(',')})`,
        )
        // Hydrated by default with the account both fixtures' approvals
        // grant/name ('ADDR'), so existing sign-transactions/sign-message
        // cases exercise the post-hydration path unchanged.
        mocks.useSigningAccounts.mockReturnValue([{ address: 'ADDR' }])
        mocks.canSignArc60.mockReturnValue(true)

        closeSpy = vi.fn()
        vi.stubGlobal('close', closeSpy)
    })

    describe('sign-transactions (Task 4, unchanged)', () => {
        it('resolves the ARC-0001 request with the approved addresses', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.resolve).toHaveBeenCalledWith(
                { transactions: SIGN_TRANSACTIONS_APPROVAL.txns },
                {
                    authorizedAddresses: new Set(
                        SIGN_TRANSACTIONS_APPROVAL.approvedAddresses,
                    ),
                },
            )
        })

        it('enqueues the resolved request with an injected transport bound to the requestId/origin', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueue).toHaveBeenCalledTimes(1)
            const [resolved, transport] = mocks.enqueue.mock.calls[0]
            expect(resolved).toBe(RESOLVED)
            expect(transport.sourceType).toBe('injected')
            expect(transport.transportId).toBe('s1')
            expect(transport.verifiedOrigin).toBe('https://x')
        })

        it('respondWithResult forwards signed transactions and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const transport = mocks.enqueue.mock.calls[0][1]

            await transport.respondWithResult(['STXN'])

            expect(mocks.resolveSignTransactions).toHaveBeenCalledWith('s1', [
                'STXN',
            ])
            expect(closeSpy).toHaveBeenCalled()
        })

        it('respondWithReject rejects the approval and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const transport = mocks.enqueue.mock.calls[0][1]

            transport.respondWithReject()
            await vi.waitFor(() => {
                expect(mocks.rejectApproval).toHaveBeenCalledWith('s1')
            })
            expect(closeSpy).toHaveBeenCalled()
        })

        it('enqueues exactly once even across re-renders', () => {
            const { rerender } = renderHook(() =>
                useSignRequestApprovalScreen(),
            )
            rerender()
            rerender()

            expect(mocks.resolve).toHaveBeenCalledTimes(1)
            expect(mocks.enqueue).toHaveBeenCalledTimes(1)
        })

        it('exposes the pipeline currentRequest once it matches the enqueued request', () => {
            mocks.useSigningRequest.mockReturnValue({
                addSignRequest: mocks.addSignRequest,
                currentRequest: {
                    id: 'sr1',
                    type: 'transactions',
                    transportId: 's1',
                },
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.request).toEqual({
                id: 'sr1',
                type: 'transactions',
                transportId: 's1',
            })
            expect(result.current.isLoading).toBe(false)
        })

        it('does not surface a foreign request at the queue head (different transportId) and keeps loading', () => {
            mocks.useSigningRequest.mockReturnValue({
                addSignRequest: mocks.addSignRequest,
                currentRequest: {
                    id: 'foreign-sr',
                    type: 'transactions',
                    transportId: 'some-other-request',
                },
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.request).toBeNull()
            expect(result.current.isLoading).toBe(true)
        })

        it('surfaces the request once its transportId matches this screen requestId', () => {
            mocks.useSigningRequest.mockReturnValue({
                addSignRequest: mocks.addSignRequest,
                currentRequest: {
                    id: 'sr1',
                    type: 'transactions',
                    transportId: 's1',
                },
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.request).toEqual({
                id: 'sr1',
                type: 'transactions',
                transportId: 's1',
            })
        })

        it('rejects and surfaces a generic error (popup stays open) when the resolver throws on malformed transactions', async () => {
            mocks.resolve.mockImplementation(() => {
                throw new Error('bad group')
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            // Raw pipeline text is not shown to the user; a generic message is.
            expect(result.current.error).toBe('dapp.sign.error.body')
            expect(mocks.enqueue).not.toHaveBeenCalled()
            await vi.waitFor(() => {
                expect(mocks.rejectApproval).toHaveBeenCalledWith('s1')
            })
            // Error stays visible until the user dismisses it — no auto-close.
            expect(closeSpy).not.toHaveBeenCalled()
        })

        it('respondWithError surfaces the network-mismatch message and keeps the popup open', () => {
            const { result } = renderHook(() => useSignRequestApprovalScreen())
            const transport = mocks.enqueue.mock.calls[0][1]

            act(() => {
                transport.respondWithError(
                    new mocks.GenesisHashMismatchError('mismatch'),
                )
            })

            expect(mocks.rejectApproval).toHaveBeenCalledWith('s1')
            expect(closeSpy).not.toHaveBeenCalled()
            expect(result.current.error).toBe('dapp.sign.network_mismatch')
        })

        it('respondWithError surfaces a generic error for non-network pipeline failures', () => {
            const { result } = renderHook(() => useSignRequestApprovalScreen())
            const transport = mocks.enqueue.mock.calls[0][1]

            act(() => {
                transport.respondWithError(new Error('some pipeline failure'))
            })

            expect(mocks.rejectApproval).toHaveBeenCalledWith('s1')
            expect(closeSpy).not.toHaveBeenCalled()
            expect(result.current.error).toBe('dapp.sign.error.body')
        })

        it('dismiss closes the popup', () => {
            const { result } = renderHook(() => useSignRequestApprovalScreen())
            result.current.dismiss()
            expect(closeSpy).toHaveBeenCalled()
        })
    })

    describe('account hydration gate (Bug 1)', () => {
        it('does not resolve/enqueue a sign-transactions request while accounts are unhydrated and stays loading', () => {
            mocks.useSigningAccounts.mockReturnValue([])

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.resolve).not.toHaveBeenCalled()
            expect(mocks.enqueue).not.toHaveBeenCalled()
            expect(result.current.isLoading).toBe(true)
            expect(result.current.error).toBeNull()
        })

        it('does not addSignRequest a sign-message request while accounts are unhydrated and stays loading', () => {
            mocks.useDappRequest.mockReturnValue({
                requestId: 'm1',
                approval: SIGN_MESSAGE_APPROVAL,
                isLoading: false,
            })
            mocks.isArc60WirePayload.mockReturnValue(true)
            mocks.parseArc60WireRequest.mockReturnValue(PARSED_ARC60)
            mocks.useSigningAccounts.mockReturnValue([])

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.addSignRequest).not.toHaveBeenCalled()
            expect(result.current.isLoading).toBe(true)
            expect(result.current.error).toBeNull()
        })

        it('enqueues exactly once, once accounts hydrate on a later render', () => {
            mocks.useSigningAccounts.mockReturnValue([])
            const { rerender } = renderHook(() =>
                useSignRequestApprovalScreen(),
            )
            expect(mocks.enqueue).not.toHaveBeenCalled()

            mocks.useSigningAccounts.mockReturnValue([{ address: 'ADDR' }])
            rerender()
            rerender()

            expect(mocks.enqueue).toHaveBeenCalledTimes(1)
        })
    })

    describe('sign-message (ARC-60, Task 5)', () => {
        beforeEach(() => {
            mocks.useDappRequest.mockReturnValue({
                requestId: 'm1',
                approval: SIGN_MESSAGE_APPROVAL,
                isLoading: false,
            })
            mocks.isArc60WirePayload.mockReturnValue(true)
            mocks.parseArc60WireRequest.mockReturnValue(PARSED_ARC60)
        })

        it('enqueues an arc60 request with an injected transport bound to the requestId/origin', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.parseArc60WireRequest).toHaveBeenCalledWith(
                SIGN_MESSAGE_APPROVAL.message,
            )
            expect(mocks.addSignRequest).toHaveBeenCalledTimes(1)
            const request = mocks.addSignRequest.mock.calls[0][0]
            expect(request.type).toBe('arc60')
            expect(request.transport).toBe('callback')
            expect(request.sourceType).toBe('injected')
            expect(request.transportId).toBe('m1')
            expect(request.verifiedOrigin).toBe('https://x')
            expect(request.stdSigData).toBe(PARSED_ARC60.stdSigData)
            expect(request.metadata).toBe(PARSED_ARC60.metadata)
        })

        it('approve encodes the signature to base64 and resolves the sign-message approval', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const request = mocks.addSignRequest.mock.calls[0][0]
            const signature = new Uint8Array([1, 2, 3])

            await request.approve([{ signature, signer: 'ADDR' }])

            expect(mocks.encodeToBase64).toHaveBeenCalledWith(signature)
            expect(mocks.resolveSignMessage).toHaveBeenCalledWith(
                'm1',
                'base64(1,2,3)',
            )
            expect(closeSpy).toHaveBeenCalled()
        })

        it('reject rejects the approval and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const request = mocks.addSignRequest.mock.calls[0][0]

            await request.reject()

            expect(mocks.rejectApproval).toHaveBeenCalledWith('m1')
            expect(closeSpy).toHaveBeenCalled()
        })

        it('error rejects the approval and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const request = mocks.addSignRequest.mock.calls[0][0]

            await request.error(new Error('boom'))

            expect(mocks.rejectApproval).toHaveBeenCalledWith('m1')
            expect(closeSpy).toHaveBeenCalled()
        })

        it('enqueues exactly once even across re-renders', () => {
            const { rerender } = renderHook(() =>
                useSignRequestApprovalScreen(),
            )
            rerender()
            rerender()

            expect(mocks.addSignRequest).toHaveBeenCalledTimes(1)
        })

        it('rejects when the ARC-60 signer is not in approval.approvedAddresses (Bug 2: cross-account guard)', async () => {
            mocks.parseArc60WireRequest.mockReturnValue({
                stdSigData: {
                    ...PARSED_ARC60.stdSigData,
                    signer: 'OTHER_ADDR',
                },
                metadata: PARSED_ARC60.metadata,
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.addSignRequest).not.toHaveBeenCalled()
            expect(result.current.error).toBeTruthy()
            await vi.waitFor(() => {
                expect(mocks.rejectApproval).toHaveBeenCalledWith('m1')
            })
            // Error stays visible until the user dismisses it — no auto-close.
            expect(closeSpy).not.toHaveBeenCalled()
        })

        it('rejects when the signer is granted but not a signable wallet account', async () => {
            mocks.canSignArc60.mockReturnValue(false)

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.addSignRequest).not.toHaveBeenCalled()
            expect(result.current.error).toBeTruthy()
            await vi.waitFor(() => {
                expect(mocks.rejectApproval).toHaveBeenCalledWith('m1')
            })
            // Error stays visible until the user dismisses it — no auto-close.
            expect(closeSpy).not.toHaveBeenCalled()
        })

        it('enqueues when the signer is in approvedAddresses and is a signable, hydrated account', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.addSignRequest).toHaveBeenCalledTimes(1)
        })

        it('rejects with an error state when the message is not a valid ARC-60 wire payload', async () => {
            mocks.isArc60WirePayload.mockReturnValue(false)

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.error).toBeTruthy()
            expect(mocks.addSignRequest).not.toHaveBeenCalled()
            await vi.waitFor(() => {
                expect(mocks.rejectApproval).toHaveBeenCalledWith('m1')
            })
            // Error stays visible until the user dismisses it — no auto-close.
            expect(closeSpy).not.toHaveBeenCalled()
        })

        it('rejects with an error state when parsing the ARC-60 wire payload throws', async () => {
            mocks.parseArc60WireRequest.mockImplementation(() => {
                throw new Error('malformed arc60 payload')
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            // Raw parse text is not shown to the user; a generic message is.
            expect(result.current.error).toBe('dapp.sign.error.body')
            expect(mocks.addSignRequest).not.toHaveBeenCalled()
            await vi.waitFor(() => {
                expect(mocks.rejectApproval).toHaveBeenCalledWith('m1')
            })
            // Error stays visible until the user dismisses it — no auto-close.
            expect(closeSpy).not.toHaveBeenCalled()
        })

        it('exposes the pipeline currentRequest once it matches the enqueued request', () => {
            mocks.useSigningRequest.mockReturnValue({
                addSignRequest: mocks.addSignRequest,
                currentRequest: {
                    id: 'sr2',
                    type: 'arc60',
                    transportId: 'm1',
                },
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.request).toEqual({
                id: 'sr2',
                type: 'arc60',
                transportId: 'm1',
            })
            expect(result.current.isLoading).toBe(false)
        })
    })
})
