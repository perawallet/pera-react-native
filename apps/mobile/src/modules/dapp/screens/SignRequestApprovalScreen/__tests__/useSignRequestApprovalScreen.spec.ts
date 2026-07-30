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
    class WalletConnectInvalidSessionError extends Error {}
    // useWalletConnectStore is a callable selector hook AND carries a
    // `.persist` object (hasHydrated/onFinishHydration) per WithPersist —
    // mirror that shape rather than mocking it as a plain function. Capture
    // Object.assign's return so the `.persist` property is part of the
    // variable's own inferred type, not lost via a discarded mutation.
    const useWalletConnectStore = Object.assign(vi.fn(), {
        persist: {
            hasHydrated: vi.fn(),
            onFinishHydration: vi.fn(),
        },
    })
    return {
        GenesisHashMismatchError,
        WalletConnectInvalidSessionError,
        useDappRequest: vi.fn(),
        resolve: vi.fn(),
        enqueue: vi.fn(),
        addSignRequest: vi.fn(),
        useSigningRequest: vi.fn(),
        isArc60WirePayload: vi.fn(),
        parseArc60WireRequest: vi.fn(),
        resolveSignTransactions: vi.fn(),
        resolveSignMessage: vi.fn(),
        resolveWcSign: vi.fn(),
        rejectApproval: vi.fn(),
        generateOrderedUniqueId: vi.fn(),
        encodeToBase64: vi.fn(),
        useSigningAccounts: vi.fn(),
        canSignArc60: vi.fn(),
        useWalletConnectStore,
        logger: { debug: vi.fn(), error: vi.fn() },
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
    logger: mocks.logger,
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnectStore: mocks.useWalletConnectStore,
    WalletConnectInvalidSessionError: mocks.WalletConnectInvalidSessionError,
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    resolveSignTransactions: mocks.resolveSignTransactions,
    resolveSignMessage: mocks.resolveSignMessage,
    resolveWcSign: mocks.resolveWcSign,
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

const WC_SIGN_TXN_APPROVAL = {
    kind: 'wc-sign' as const,
    requestId: 'wc1',
    origin: 'https://dapp.example',
    clientId: 'client-1',
    wcRequestId: 9,
    method: 'algo_signTxn' as const,
    payload: { id: 9, params: [[{ txn: 'AAA' }]] },
}

const WC_SIGN_DATA_APPROVAL = {
    kind: 'wc-sign' as const,
    requestId: 'wc2',
    origin: 'https://dapp.example',
    clientId: 'client-2',
    wcRequestId: 10,
    method: 'algo_signData' as const,
    payload: {
        id: 10,
        params: { authenticatorData: 'AAA', metadata: { scope: 0 } },
    },
}

const SESSION_PEER_META = {
    name: 'Dapp',
    url: 'https://dapp.example',
    icons: ['https://dapp.example/icon.png'],
    description: '',
}

const CONNECTION_CLIENT_1 = {
    clientId: 'client-1',
    session: { accounts: ['ADDR'], peerMeta: SESSION_PEER_META },
}

const CONNECTION_CLIENT_2 = {
    clientId: 'client-2',
    session: { accounts: ['ADDR'], peerMeta: SESSION_PEER_META },
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
        mocks.resolveWcSign.mockReset()
        mocks.useWalletConnectStore.mockReset()
        mocks.useWalletConnectStore.persist.hasHydrated.mockReset()
        mocks.useWalletConnectStore.persist.onFinishHydration.mockReset()
        mocks.logger.debug.mockReset()
        mocks.logger.error.mockReset()

        // Default: WC store hydrated with no connections — only the wc-sign
        // tests below override this with real session fixtures.
        mocks.useWalletConnectStore.mockImplementation(
            (
                selector: (state: {
                    walletConnectConnections: unknown[]
                }) => unknown,
            ) => selector({ walletConnectConnections: [] }),
        )
        mocks.useWalletConnectStore.persist.hasHydrated.mockReturnValue(true)
        mocks.useWalletConnectStore.persist.onFinishHydration.mockReturnValue(
            () => {},
        )
        mocks.resolveWcSign.mockResolvedValue(undefined)

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

    describe('wc-sign — algo_signTxn (Task 9 consolidation)', () => {
        beforeEach(() => {
            mocks.useDappRequest.mockReturnValue({
                requestId: 'wc1',
                approval: WC_SIGN_TXN_APPROVAL,
                isLoading: false,
            })
            mocks.useWalletConnectStore.mockImplementation(
                (
                    selector: (state: {
                        walletConnectConnections: unknown[]
                    }) => unknown,
                ) =>
                    selector({
                        walletConnectConnections: [CONNECTION_CLIENT_1],
                    }),
            )
        })

        it('resolves the ARC-0001 request from the WC envelope, scoped to the session accounts', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.resolve).toHaveBeenCalledWith(
                { transactions: [{ txn: 'AAA' }] },
                { authorizedAddresses: new Set(['ADDR']) },
            )
        })

        it('enqueues with walletconnect provenance, correlated on the WC clientId, using the session peerMeta as sourceMetadata', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.enqueue).toHaveBeenCalledTimes(1)
            const [resolved, transport] = mocks.enqueue.mock.calls[0]
            expect(resolved).toBe(RESOLVED)
            expect(transport.sourceType).toBe('walletconnect')
            expect(transport.transportId).toBe('client-1')
            expect(transport.sourceMetadata).toEqual(SESSION_PEER_META)
        })

        it('respondWithResult delivers the result via resolveWcSign and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const transport = mocks.enqueue.mock.calls[0][1]

            await transport.respondWithResult(['STXN'])

            expect(mocks.resolveWcSign).toHaveBeenCalledWith('wc1', ['STXN'])
            expect(closeSpy).toHaveBeenCalled()
        })

        it('respondWithReject rejects the approval and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const transport = mocks.enqueue.mock.calls[0][1]

            transport.respondWithReject()
            await vi.waitFor(() => {
                expect(mocks.rejectApproval).toHaveBeenCalledWith('wc1')
            })
            expect(closeSpy).toHaveBeenCalled()
        })

        it('respondWithError surfaces an error and keeps the popup open instead of a silent flash-close', () => {
            const { result } = renderHook(() => useSignRequestApprovalScreen())
            const transport = mocks.enqueue.mock.calls[0][1]

            act(() => {
                transport.respondWithError(new Error('pipeline failure'))
            })

            expect(mocks.rejectApproval).toHaveBeenCalledWith('wc1')
            // The bespoke WcSignApprovalScreen this replaces always closed
            // here; SignRequestApprovalScreen keeps the popup open with an
            // EmptyView instead.
            expect(closeSpy).not.toHaveBeenCalled()
            expect(result.current.error).toBe('dapp.sign.error.body')
        })

        it('rejects without enqueueing when the payload transaction list cannot be read', () => {
            mocks.useDappRequest.mockReturnValue({
                requestId: 'wc1',
                approval: {
                    ...WC_SIGN_TXN_APPROVAL,
                    payload: { id: 9, params: 'not-an-array' },
                },
                isLoading: false,
            })

            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.resolve).not.toHaveBeenCalled()
            expect(mocks.enqueue).not.toHaveBeenCalled()
            expect(mocks.rejectApproval).toHaveBeenCalledWith('wc1')
        })

        it('does not resolve/enqueue while accounts are unhydrated and stays loading', () => {
            mocks.useSigningAccounts.mockReturnValue([])

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.resolve).not.toHaveBeenCalled()
            expect(mocks.enqueue).not.toHaveBeenCalled()
            expect(result.current.isLoading).toBe(true)
        })

        it('rejects with the missing-session reason when the clientId matches no stored session', () => {
            mocks.useWalletConnectStore.mockImplementation(
                (
                    selector: (state: {
                        walletConnectConnections: unknown[]
                    }) => unknown,
                ) => selector({ walletConnectConnections: [] }),
            )

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.resolve).not.toHaveBeenCalled()
            expect(mocks.enqueue).not.toHaveBeenCalled()
            expect(mocks.rejectApproval).toHaveBeenCalledWith('wc1')
            // Distinguishable from the generic decode-failure text — an
            // explicit "no session" reason, not the resolver's confusing
            // empty-set Unauthorized.
            expect(result.current.error).toBe('dapp.sign.no_session')
        })

        it('scopes authorizedAddresses to THIS session only, not other sessions or all wallet accounts', () => {
            const otherSession = {
                clientId: 'other-client',
                session: {
                    accounts: ['OTHER_ADDR'],
                    peerMeta: SESSION_PEER_META,
                },
            }
            mocks.useWalletConnectStore.mockImplementation(
                (
                    selector: (state: {
                        walletConnectConnections: unknown[]
                    }) => unknown,
                ) =>
                    selector({
                        walletConnectConnections: [
                            otherSession,
                            CONNECTION_CLIENT_1,
                        ],
                    }),
            )

            renderHook(() => useSignRequestApprovalScreen())

            // Would fail if the fix instead bound authorizedAddresses to
            // every session's accounts (a union) or to all wallet accounts.
            expect(mocks.resolve).toHaveBeenCalledWith(
                { transactions: [{ txn: 'AAA' }] },
                { authorizedAddresses: new Set(['ADDR']) },
            )
        })

        it('waits for the WC store to hydrate before resolving, independently of the accounts store', () => {
            mocks.useWalletConnectStore.persist.hasHydrated.mockReturnValue(
                false,
            )
            let finishHydration: () => void = () => {}
            mocks.useWalletConnectStore.persist.onFinishHydration.mockImplementation(
                (fn: () => void) => {
                    finishHydration = fn
                    return () => {}
                },
            )

            const { result, rerender } = renderHook(() =>
                useSignRequestApprovalScreen(),
            )

            expect(mocks.resolve).not.toHaveBeenCalled()
            expect(result.current.isLoading).toBe(true)

            act(() => {
                finishHydration()
            })
            rerender()

            expect(mocks.resolve).toHaveBeenCalledTimes(1)
        })

        it('recovers when hydration finishes in the gap between the initial render and the effect subscribing, even though onFinishHydration never fires', () => {
            // hasHydrated() is read twice in the fixed implementation: once
            // by useState's lazy initializer (during the first render) and
            // once inside the effect before subscribing. Returning false
            // then true models hydration completing in the gap between
            // those two reads — the exact race the check-then-subscribe bug
            // missed. onFinishHydration's callback is deliberately never
            // invoked below: it must NOT be needed for recovery.
            let hasHydratedCalls = 0
            mocks.useWalletConnectStore.persist.hasHydrated.mockImplementation(
                () => {
                    hasHydratedCalls += 1
                    return hasHydratedCalls > 1
                },
            )
            mocks.useWalletConnectStore.persist.onFinishHydration.mockImplementation(
                () => () => {},
            )

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.resolve).toHaveBeenCalledTimes(1)
            expect(mocks.enqueue).toHaveBeenCalledTimes(1)
            expect(result.current.error).toBeNull()
        })

        it('correlates the pipeline currentRequest by the WC clientId, not the bridge requestId', () => {
            mocks.useSigningRequest.mockReturnValue({
                addSignRequest: mocks.addSignRequest,
                currentRequest: {
                    id: 'sr1',
                    type: 'transactions',
                    transportId: 'client-1',
                },
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.request).toEqual({
                id: 'sr1',
                type: 'transactions',
                transportId: 'client-1',
            })
            expect(result.current.isLoading).toBe(false)
        })

        it('does not surface a request keyed by the bridge requestId instead of the WC clientId', () => {
            mocks.useSigningRequest.mockReturnValue({
                addSignRequest: mocks.addSignRequest,
                currentRequest: {
                    id: 'sr1',
                    type: 'transactions',
                    transportId: 'wc1',
                },
            })

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(result.current.request).toBeNull()
            expect(result.current.isLoading).toBe(true)
        })
    })

    describe('wc-sign — algo_signData', () => {
        beforeEach(() => {
            mocks.useDappRequest.mockReturnValue({
                requestId: 'wc2',
                approval: WC_SIGN_DATA_APPROVAL,
                isLoading: false,
            })
            mocks.useWalletConnectStore.mockImplementation(
                (
                    selector: (state: {
                        walletConnectConnections: unknown[]
                    }) => unknown,
                ) =>
                    selector({
                        walletConnectConnections: [CONNECTION_CLIENT_2],
                    }),
            )
            mocks.isArc60WirePayload.mockReturnValue(true)
            mocks.parseArc60WireRequest.mockReturnValue(PARSED_ARC60)
        })

        it('reaches the ARC-60 path and is signable, instead of being declined', () => {
            renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.parseArc60WireRequest).toHaveBeenCalledWith(
                WC_SIGN_DATA_APPROVAL.payload.params,
            )
            expect(mocks.addSignRequest).toHaveBeenCalledTimes(1)
            const request = mocks.addSignRequest.mock.calls[0][0]
            expect(request.type).toBe('arc60')
            expect(request.transport).toBe('callback')
            expect(request.sourceType).toBe('walletconnect')
            expect(request.transportId).toBe('client-2')
            expect(request.sourceMetadata).toEqual(SESSION_PEER_META)
            expect(request.stdSigData).toBe(PARSED_ARC60.stdSigData)
            expect(request.metadata).toBe(PARSED_ARC60.metadata)
        })

        it('approve responds with an array of base64 signatures via resolveWcSign (WC algo_signData response shape)', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const request = mocks.addSignRequest.mock.calls[0][0]
            const signature = new Uint8Array([1, 2, 3])

            await request.approve([{ signature, signer: 'ADDR' }])

            expect(mocks.encodeToBase64).toHaveBeenCalledWith(signature)
            expect(mocks.resolveWcSign).toHaveBeenCalledWith('wc2', [
                'base64(1,2,3)',
            ])
            expect(closeSpy).toHaveBeenCalled()
        })

        it('reject rejects the approval and closes the window', async () => {
            renderHook(() => useSignRequestApprovalScreen())
            const request = mocks.addSignRequest.mock.calls[0][0]

            await request.reject()

            expect(mocks.rejectApproval).toHaveBeenCalledWith('wc2')
            expect(closeSpy).toHaveBeenCalled()
        })

        it('rejects when the ARC-60 signer is not in the WC session accounts (cross-account guard)', () => {
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
            expect(mocks.rejectApproval).toHaveBeenCalledWith('wc2')
        })

        it('rejects when the signer is granted but not a signable wallet account', () => {
            mocks.canSignArc60.mockReturnValue(false)

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.addSignRequest).not.toHaveBeenCalled()
            expect(result.current.error).toBeTruthy()
            expect(mocks.rejectApproval).toHaveBeenCalledWith('wc2')
        })

        it('rejects when the algo_signData payload is not a valid ARC-60 wire payload', () => {
            mocks.isArc60WirePayload.mockReturnValue(false)

            const { result } = renderHook(() => useSignRequestApprovalScreen())

            expect(mocks.addSignRequest).not.toHaveBeenCalled()
            // Assert the specific translation key: a truthy-only check here
            // previously let this test pass even while the gate and this
            // branch disagreed on the wire shape — every real algo_signData
            // request took THIS rejection path, always for the wrong reason
            // (isArc60WirePayload really did reject it, since the fixture
            // payload never reached this branch with a shape it could
            // accept). Pinning the exact key makes that distinction visible
            // instead of vanishing into a generic truthy check.
            expect(result.current.error).toBe('dapp.sign.unsupported_message')
            expect(mocks.rejectApproval).toHaveBeenCalledWith('wc2')
        })
    })
})
