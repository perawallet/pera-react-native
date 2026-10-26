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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
    logger,
} from '@perawallet/wallet-core-shared'
import type {
    AuthDataSignableData,
    ExternalSignTxnTransport,
    PeraArbitraryDataMessage,
    SignRequest,
    SourceType,
} from '@perawallet/wallet-core-signing'
import {
    DappRequestRejectedError,
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
    PendingRequestCapacityError,
} from '../dappRequest'
import { DappRequestCodedError } from '../errors'
import type { InboundMessage } from '../models'
import type { ConnectionRegistry } from '../registry'
import type { PendingRequestLedger } from '../signing-adapter'
import {
    MAX_PENDING_REQUESTS,
    MAX_PENDING_REQUESTS_PER_PEER,
} from '../capacity'

const CHAIN_ID = 'algorand' as ChainId

// Typed to the real `ExternalSignTxnTransport` shape, so the transport object
// the adapter hands over is read back below with its true type rather than as
// an implicit `any`.
const mockEnqueue = vi.fn(
    async (
        _request: { group: readonly unknown[]; authorizedAccounts: string[] },
        _transport: ExternalSignTxnTransport,
    ): Promise<SignRequest | null> => null,
)

const lastTransport = (): ExternalSignTxnTransport => {
    const call = mockEnqueue.mock.calls.at(-1)
    if (!call) throw new Error('enqueue was never called')
    return call[1]
}
const mockAddSignRequest = vi.fn()
const mockRemoveSignRequest = vi.fn()
const mockIsSignRequestPending = vi.fn((_id: string) => true)
const mockIsSignRequestPastApproval = vi.fn((_id: string) => false)
const mockPlan = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({
        addSignRequest: mockAddSignRequest,
        removeSignRequest: mockRemoveSignRequest,
    }),
    isSignRequestPending: (id: string) => mockIsSignRequestPending(id),
    isSignRequestPastApproval: (id: string) =>
        mockIsSignRequestPastApproval(id),
    // Small on purpose so "too many requests" tests stay short — the real
    // value (1000, `@perawallet/wallet-core-signing`'s `constants.ts`) is
    // exercised by that package's own tests.
    MAX_DATA_SIGN_REQUESTS: 2,
    // `validate.ts` imports this eagerly; only the sign-transactions path is
    // driven from this file, so it is unused.
    parseAuthDataWireRequest: vi.fn(),
    // Mirrors a chain's `canSign`: a flag per message kind on the account
    // itself, no rekey hop. `mockHasMessageSigner` stands in for a chain with
    // no message signer registered.
    canSignMessage: (_chainId: string, account: MockAccount, kind: string) =>
        mockHasMessageSigner &&
        (kind === 'authData'
            ? account.canArc60 === true
            : account.canSignData === true),
    messageSignerChainAdapters: { get: () => ({ plan: mockPlan }) },
    // Mirrors the real predicate: the class name, or the marker the
    // WalletConnect rewrap keeps in the message.
    isFeeAdjustmentDeliveryError: (error: Error) =>
        error.name === 'FeeAdjustmentDeliveryError' ||
        error.message.includes('fee-adjusted'),
}))

const mockSelectedNetwork = vi.hoisted(() => ({ current: 'mainnet' }))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getSelectedScope: (chainId: string) => ({
        chainId,
        networkId: mockSelectedNetwork.current,
    }),
}))

// A minimal double of `WalletAccount` — just the fields the message signer's
// capability check and the adapter's own signer lookups read.
type MockAccount = {
    chains: Record<string, { address: string }>
    authority?: string
    /** Limits `authority` to one network; absent means every network. */
    authorityNetwork?: string
    canSignData?: boolean
    canArc60?: boolean
}

const mockAccount = (
    address: string,
    flags: Omit<MockAccount, 'chains'> = {},
): MockAccount => ({ chains: { algorand: { address } }, ...flags })

let mockAccounts: MockAccount[] = []
let mockHasMessageSigner = true

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockAccounts,
    authorityOf: (account: MockAccount, scope: { networkId: string }) =>
        account.authorityNetwork === undefined ||
        account.authorityNetwork === scope.networkId
            ? (account.authority ?? null)
            : null,
    chainAccountOf: (account: MockAccount, chainId: string) =>
        account.chains[chainId],
    findAccountByAddressOn: (
        accounts: MockAccount[],
        chainId: string,
        address: string,
    ) => accounts.find(account => account.chains[chainId]?.address === address),
}))

const { enqueueInboundRequest, useConnectionSigningAdapter } =
    await import('../signing-adapter')

// A fixture registered into the shared `dappRequestChainAdapters` registry,
// so `useChainTransactionSigning` resolves `mockEnqueue` as this chain's
// `useEnqueueTransactionSigning`. Only the members this file's hooks reach
// are exercised; the rest are stubs satisfying the interface.
const fixtureAdapter = (): DappRequestChainAdapter => ({
    chainId: CHAIN_ID,
    relayableErrorNames: [],
    accountTypeOf: () => 'Fixture',
    parseSigningParams: () => ({ ok: true, payload: [] }),
    resolveReportedNetwork: scope => scope.networkId,
    emptySignaturesFor: () => ({}),
    walletConnect: {
        namespace: 'algorand',
        caip2ChainIdFor: () => null,
        networkForCaip2ChainId: () => null,
        toWireResult: () => null,
    },
    validateTransactionPayload: () => ({ ok: true, group: [] }),
    useEnqueueTransactionSigning: () => mockEnqueue,
})

// Two accounts distinct from every other fixture in this file (default
// `authorizedAccounts` below is `['AAAA']`), so a mutant that hardcodes a
// signer value cannot survive these tests.
const PRIMARY_SIGNER = 'SIGNERPRIMARYQWERTYUIOP123456'
const REKEYED_SIGNER = 'SIGNERREKEYEDASDFGHJKL7890123'

// A peer identity distinct from every other fixture in this file, so a
// mutant that hardcodes or drops `sourceMetadata` cannot survive the tests
// that assert it below.
const PEER = {
    name: 'Distinctive Test Dapp',
    url: 'https://distinctive-test-dapp.example',
}

const signDataMessage = (
    payload: AuthDataSignableData | PeraArbitraryDataMessage[],
    authorizedAccounts: string[] = ['AAAA'],
    sourceType: SourceType = 'walletconnect',
) => ({
    kind: 'request' as const,
    chainId: CHAIN_ID,
    connectionId: 'c1',
    correlationId: '9',
    sourceType,
    authorizedAccounts,
    peer: PEER,
    operation: { type: 'sign-data' as const, payload },
    respond: vi.fn(async () => {}),
    reject: vi.fn(async () => {}),
})

const txnMessage = (
    correlationId = '7',
    connectionId = 'c1',
): Extract<InboundMessage, { kind: 'request' }> => ({
    kind: 'request',
    chainId: CHAIN_ID,
    connectionId,
    correlationId,
    sourceType: 'walletconnect',
    authorizedAccounts: ['AAAA'],
    peer: PEER,
    operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
    respond: vi.fn(async () => {}),
    reject: vi.fn(async () => {}),
})

// A real `ConnectionRegistry`, not an `as never` double: `subscribeToMessages`
// is the live implementation under test, and the other nine members are
// `vi.fn()`s. If the interface gains a required method or
// `subscribeToMessages` changes shape, this fails to compile instead of
// silently passing through the bottom type.
const makeRegistry = () => {
    let emit: ((m: InboundMessage) => void) | undefined
    const reportError = vi.fn()
    const registry: ConnectionRegistry = {
        reportError,
        register: vi.fn(),
        initialize: vi.fn(async () => {}),
        teardown: vi.fn(async () => {}),
        pair: vi.fn(async () => 'pairing-id'),
        disconnect: vi.fn(async () => {}),
        disconnectAll: vi.fn(async () => {}),
        reconnect: vi.fn(),
        abandonPairing: vi.fn(),
        describeUri: vi.fn(() => ({})),
        scopesFor: vi.fn(() => []),
        methodsFor: vi.fn(() => []),
        subscribeToProposals: vi.fn(() => () => {}),
        subscribeToMessages: listener => {
            emit = listener
            return () => void (emit = undefined)
        },
        subscribeToErrors: vi.fn(() => () => {}),
        notify: vi.fn(async () => {}),
    }
    return {
        registry,
        reportError,
        send: (m: InboundMessage) => emit?.(m),
        isSubscribed: () => emit !== undefined,
    }
}

describe('useConnectionSigningAdapter', () => {
    beforeEach(() => {
        mockAccounts = []
        mockHasMessageSigner = true
        mockSelectedNetwork.current = 'mainnet'
        mockAddSignRequest.mockClear()
        mockRemoveSignRequest.mockClear()
        mockIsSignRequestPending.mockReset()
        mockIsSignRequestPending.mockReturnValue(true)
        mockIsSignRequestPastApproval.mockReset()
        mockIsSignRequestPastApproval.mockReturnValue(false)
        mockEnqueue.mockClear()
        mockEnqueue.mockResolvedValue(null)
        dappRequestChainAdapters.reset()
        dappRequestChainAdapters.register(fixtureAdapter())
    })

    it('enqueues a sign-transactions request with the connection as transportId', () => {
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject: vi.fn(),
        })

        expect(mockEnqueue).toHaveBeenCalledWith(
            { group: [{ txn: 'b64' }], authorizedAccounts: ['AAAA'] },
            expect.objectContaining({
                sourceType: 'walletconnect',
                transportId: 'c1',
                // The connection's peer identity, stamped as the
                // anti-spoofing dApp identity shown on the signing sheet.
                sourceMetadata: PEER,
            }),
        )
    })

    it('declines a message naming a chain no adapter is mounted for', () => {
        const { registry, reportError, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
        const reject = vi.fn(async () => {})

        send({
            kind: 'request',
            chainId: 'other' as ChainId,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject,
        })

        expect(reject).toHaveBeenCalled()
        expect(mockEnqueue).not.toHaveBeenCalled()
        expect(reportError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('other'),
            }),
            expect.anything(),
        )
    })

    it('forwards the source type the handler declared', () => {
        // `'webview'` is a SourceType no WalletConnect handler declares, so
        // an adapter deciding this for itself cannot pass.
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'webview',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject: vi.fn(),
        })

        expect(mockEnqueue).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ sourceType: 'webview' }),
        )
    })

    it('threads the transport-verified origin through to the enqueue', () => {
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'injected',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            verifiedOrigin: 'https://dapp.example',
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject: vi.fn(),
        })

        expect(mockEnqueue).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ verifiedOrigin: 'https://dapp.example' }),
        )
    })

    it('binds the request to the connection approved accounts', () => {
        // Without this, a session approved for account A could sign for
        // account B. `authorizedAccounts` is the guarantee; it must reach
        // the chain's own enqueue on every request.
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA', 'BBBB'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject: vi.fn(),
        })

        expect(mockEnqueue).toHaveBeenCalledWith(
            expect.objectContaining({
                authorizedAccounts: ['AAAA', 'BBBB'],
            }),
            expect.anything(),
        )
    })

    it('routes the signed result back through respond, not a transport call', async () => {
        const { registry, send } = makeRegistry()
        const respond = vi.fn(async () => {})
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond,
            reject: vi.fn(),
        })
        const transport = lastTransport()
        await transport.respondWithResult(['signed==', null])

        expect(respond).toHaveBeenCalledWith({
            type: 'sign-transactions',
            signed: ['signed==', null],
        })
    })

    it('propagates a delivery failure so the pipeline can offer a retry', async () => {
        const { registry, send } = makeRegistry()
        const respond = vi.fn(async () => {
            throw new Error('socket dead')
        })
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond,
            reject: vi.fn(),
        })
        const transport = lastTransport()

        await expect(transport.respondWithResult([])).rejects.toThrow(
            'socket dead',
        )
    })

    it('forwards the request id as payloadId so a resumed multisig handoff can answer the dApp', () => {
        // `handoffDelivery` is gated on `payloadId`; without it a group whose
        // app is killed mid-signing has no delivery channel on relaunch.
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '1747',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject: vi.fn(),
        })

        expect(lastTransport().payloadId).toBe(1747)
    })

    it('leaves payloadId unset for a correlation id that is not a plain integer', () => {
        // The id is opaque by contract; a handler that numbers its requests
        // otherwise gets no post-kill handoff rather than a NaN one.
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: 'thid:abc',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject: vi.fn(),
        })

        expect(lastTransport().payloadId).toBeUndefined()
    })

    it('leaves a retryable delivery failure to the signing machine: no peer answer, no error toast', async () => {
        // The request has one answer. Rejecting on a dead socket that then
        // revives consumes it, so the user's RETRY fails `already-answered`
        // against a dApp that has already been told no. Reporting it would
        // toast over the RETRY sheet the machine is already showing.
        const { registry, reportError, send } = makeRegistry()
        const reject = vi.fn(async () => {})
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject,
        })
        const timeout = new AppError('socket dead', {
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.CONNECTIONS,
            retryable: true,
        })

        // `false` is what tells the enqueue to keep the request queued.
        expect(lastTransport().respondWithError(timeout)).toBe(false)
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(reject).not.toHaveBeenCalled()
        expect(reportError).not.toHaveBeenCalled()
    })

    it('reports a fee-adjusted delivery failure even though it is retryable, still without answering the peer', async () => {
        // The RETRY sheet alone cannot explain this one: the user needs to
        // hear that the dApp may not accept the higher fees.
        const { registry, reportError, send } = makeRegistry()
        const reject = vi.fn(async () => {})
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject,
        })
        const feeAdjusted = new AppError(
            'The dApp rejected or failed to accept the fee-adjusted response',
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.CONNECTIONS,
                retryable: true,
            },
        )

        lastTransport().respondWithError(feeAdjusted)
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(reject).not.toHaveBeenCalled()
        expect(reportError).toHaveBeenCalledWith(feeAdjusted, {
            connectionId: 'c1',
        })
    })

    it('answers the peer and reports a delivery failure the machine cannot retry', async () => {
        const { registry, reportError, send } = makeRegistry()
        const reject = vi.fn(async () => {})
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject,
        })
        const fatal = new Error('signing failed')

        expect(lastTransport().respondWithError(fatal)).toBe(true)
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(reject).toHaveBeenCalledWith(fatal)
        expect(reportError).toHaveBeenCalledWith(fatal, {
            connectionId: 'c1',
        })
    })

    it('swallows a failed rejection delivery instead of leaking it', async () => {
        // `respondWithReject` is typed as returning void, so there is nowhere
        // to propagate a delivery failure to. Un-caught, the rejection escapes
        // to the platform's global handler — a red box on React Native, and a
        // file-level failure here. A v1 handler's `reject` genuinely rejects
        // when the bridge socket cannot be revived, so this is live.
        const { registry, send } = makeRegistry()
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const reject = vi.fn(async () => {
            throw new Error('socket dead')
        })
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject,
        })
        const transport = lastTransport()

        expect(() => transport.respondWithReject()).not.toThrow()
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(reject).toHaveBeenCalled()
        expect(warn).toHaveBeenCalledWith(
            '[connections] reject delivery failed',
            expect.objectContaining({ connectionId: 'c1' }),
        )
        warn.mockRestore()
    })

    it('contains a reject that throws before its first await', async () => {
        // `reject` is handler-supplied transport code and can fail either way;
        // `respondWithError` is the second call site with nowhere to propagate.
        const { registry, send } = makeRegistry()
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const reject = vi.fn(() => {
            throw new Error('no connector')
        })
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(),
            reject,
        })
        const transport = lastTransport()

        expect(() =>
            transport.respondWithError(new Error('signing failed')),
        ).not.toThrow()
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(warn).toHaveBeenCalledWith(
            '[connections] reject delivery failed',
            expect.objectContaining({ connectionId: 'c1' }),
        )
        warn.mockRestore()
    })

    it('declines the peer when the chain enqueue throws synchronously, and untracks the request', () => {
        // The chain's own resolver may enforce invariants (bad base64, msig,
        // over-max count...) by throwing synchronously. Nothing downstream
        // answers the peer for us: an escaped throw dies in the registry's
        // listener loop as a log line and the dApp waits out its own timeout.
        const { registry, send } = makeRegistry()
        const violation = new Error('Invalid base64 in transaction 0')
        mockEnqueue.mockImplementationOnce(() => {
            throw violation
        })
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        const message = {
            kind: 'request' as const,
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: {
                type: 'sign-transactions' as const,
                group: [{ txn: 'not-base64' }],
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        }
        expect(() => send(message)).not.toThrow()

        expect(message.reject).toHaveBeenCalledWith(violation)
    })

    it('leaves nothing in the pending ledger after a synchronous enqueue throw', () => {
        const pendingRequests: PendingRequestLedger = new Map()
        const onError = vi.fn()
        const violation = new Error('Invalid base64 in transaction 0')
        const throwingEnqueue = vi.fn(() => {
            throw violation
        })

        enqueueInboundRequest(
            {
                kind: 'request',
                chainId: CHAIN_ID,
                connectionId: 'c1',
                correlationId: '7',
                sourceType: 'walletconnect',
                authorizedAccounts: ['AAAA'],
                peer: PEER,
                operation: {
                    type: 'sign-transactions',
                    group: [{ txn: 'not-base64' }],
                },
                respond: vi.fn(async () => {}),
                reject: vi.fn(async () => {}),
            },
            {
                transactionSigning: new Map([[CHAIN_ID, throwingEnqueue]]),
                addSignRequest: mockAddSignRequest,
                removeSignRequest: mockRemoveSignRequest,
                isSignRequestPending: mockIsSignRequestPending,
                isSignRequestPastApproval: mockIsSignRequestPastApproval,
                accounts: [],
                pendingRequests,
                onError,
            },
        )

        expect(pendingRequests.size).toBe(0)
        expect(onError).toHaveBeenCalledWith(violation, expect.anything())
    })

    it('rejects the peer when enqueueing the sign request fails', async () => {
        // `enqueue` is async and can reject after its own error handling has
        // run out — re-encoding a fee-adjusted group, or `addSignRequest`
        // itself. Un-caught that is an unhandled rejection AND an unanswered
        // peer.
        const { registry, send } = makeRegistry()
        const failure = new Error('encode failed')
        mockEnqueue.mockRejectedValueOnce(failure)
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

        const message = {
            kind: 'request' as const,
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: {
                type: 'sign-transactions' as const,
                group: [{ txn: 'b64' }],
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        }
        send(message)
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(message.reject).toHaveBeenCalledWith(failure)
    })

    describe('request expiry', () => {
        const expired = (correlationId = '7'): InboundMessage => ({
            kind: 'request-expired',
            connectionId: 'c1',
            correlationId,
        })

        it('withdraws the enqueued transaction request the peer stopped waiting for', async () => {
            // Answering late fails on the wire, and the pipeline would then
            // retry into a request id the relay has already dropped.
            const signRequest = { id: 'sr-1', type: 'transactions' }
            mockEnqueue.mockResolvedValueOnce(signRequest as never)
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            send(txnMessage())
            await Promise.resolve()
            send(expired())

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(signRequest)
        })

        it('withdraws on arrival when the expiry beats the enqueue', async () => {
            // The enqueue awaits the fee calculator; an expiry can land in
            // between, when there is no sign request to remove yet.
            const signRequest = { id: 'sr-2', type: 'transactions' }
            let settle: (value: never) => void = () => {}
            mockEnqueue.mockReturnValueOnce(
                new Promise<never>(resolve => {
                    settle = resolve
                }),
            )
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            send(txnMessage())
            send(expired())
            expect(mockRemoveSignRequest).not.toHaveBeenCalled()

            settle(signRequest as never)
            await Promise.resolve()

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(signRequest)
        })

        it('withdraws a sign-data request by its connection and correlation id', () => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canArc60: true })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            send(
                signDataMessage(
                    {
                        type: 'auth-data',
                        authData: {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            domain: 'example.com',
                            authenticatorData: new Uint8Array([1]),
                        },
                        metadata: { scope: 1, encoding: 'base64' },
                    },
                    [PRIMARY_SIGNER],
                ),
            )
            const added = mockAddSignRequest.mock.calls[0][0]

            // A different request on the same connection is left alone.
            send(expired('other'))
            expect(mockRemoveSignRequest).not.toHaveBeenCalled()

            send(expired('9'))
            expect(mockRemoveSignRequest).toHaveBeenCalledWith(added)
        })

        it('does nothing for a request already answered', async () => {
            const signRequest = { id: 'sr-3', type: 'transactions' }
            mockEnqueue.mockResolvedValueOnce(signRequest as never)
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            send(txnMessage())
            await Promise.resolve()
            await lastTransport().respondWithResult([null])

            send(expired())

            expect(mockRemoveSignRequest).not.toHaveBeenCalled()
        })
    })

    describe('pending capacity', () => {
        const sendBurst = (
            send: (m: InboundMessage) => void,
            count: number,
            connectionFor: (index: number) => string,
        ): void => {
            for (let i = 0; i < count; i++) {
                send(txnMessage(String(i), connectionFor(i)))
            }
        }

        it('refuses a connection past its cap while earlier enqueues are still in flight', () => {
            mockEnqueue.mockReturnValue(new Promise<never>(() => {}))
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            sendBurst(send, MAX_PENDING_REQUESTS_PER_PEER, () => 'c1')

            const over = txnMessage('over', 'c1')
            send(over)

            expect(mockEnqueue).toHaveBeenCalledTimes(
                MAX_PENDING_REQUESTS_PER_PEER,
            )
            expect(over.reject).toHaveBeenCalledWith(
                expect.any(PendingRequestCapacityError),
            )
            expect(over.reject.mock.calls[0][0]).toMatchObject({
                failure: 'limit-exceeded',
            })
        })

        it('refuses any connection once the total cap is reached', () => {
            mockEnqueue.mockReturnValue(new Promise<never>(() => {}))
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            sendBurst(send, MAX_PENDING_REQUESTS, index => `c${index}`)

            send(txnMessage('over', 'fresh'))

            expect(mockEnqueue).toHaveBeenCalledTimes(MAX_PENDING_REQUESTS)
        })

        it('frees the slot once a request is answered', async () => {
            mockEnqueue.mockImplementation(
                async () =>
                    ({
                        id: `sr-${mockEnqueue.mock.calls.length}`,
                    }) as never,
            )
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            sendBurst(send, MAX_PENDING_REQUESTS_PER_PEER, () => 'c1')
            await Promise.resolve()
            await lastTransport().respondWithResult([null])

            send(txnMessage('next', 'c1'))

            expect(mockEnqueue).toHaveBeenCalledTimes(
                MAX_PENDING_REQUESTS_PER_PEER + 1,
            )
        })

        it('frees the slot of a request that left the queue without an answer', async () => {
            mockEnqueue.mockImplementation(
                async () =>
                    ({
                        id: `sr-${mockEnqueue.mock.calls.length}`,
                    }) as never,
            )
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            sendBurst(send, MAX_PENDING_REQUESTS_PER_PEER, () => 'c1')
            await Promise.resolve()
            mockIsSignRequestPending.mockImplementation(id => id !== 'sr-1')

            send(txnMessage('next', 'c1'))

            expect(mockEnqueue).toHaveBeenCalledTimes(
                MAX_PENDING_REQUESTS_PER_PEER + 1,
            )
        })
    })

    describe('connection closed', () => {
        // A send-transaction broadcast goes out even once its actor stops, so
        // withdrawing here would hide an outcome the user needs to see.
        it('leaves a request the user already approved to finish', async () => {
            const approved = { id: 'sr-approved' }
            const waiting = { id: 'sr-waiting' }
            mockEnqueue
                .mockResolvedValueOnce(approved as never)
                .mockResolvedValueOnce(waiting as never)
            mockIsSignRequestPastApproval.mockImplementation(
                id => id === approved.id,
            )
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            send(txnMessage('1', 'c1'))
            send(txnMessage('2', 'c1'))
            await Promise.resolve()

            send({ kind: 'connection-closed', connectionId: 'c1' })

            expect(mockRemoveSignRequest.mock.calls).toEqual([[waiting]])
        })

        it('leaves an approved request to finish on expiry too', async () => {
            const approved = { id: 'sr-approved' }
            mockEnqueue.mockResolvedValueOnce(approved as never)
            mockIsSignRequestPastApproval.mockReturnValue(true)
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            send(txnMessage())
            await Promise.resolve()

            send({
                kind: 'request-expired',
                connectionId: 'c1',
                correlationId: '7',
            })

            expect(mockRemoveSignRequest).not.toHaveBeenCalled()
        })

        it('withdraws every request the closed connection still has open, and only those', async () => {
            const first = { id: 'sr-a' }
            const second = { id: 'sr-b' }
            const other = { id: 'sr-c' }
            mockEnqueue
                .mockResolvedValueOnce(first as never)
                .mockResolvedValueOnce(second as never)
                .mockResolvedValueOnce(other as never)
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            send(txnMessage('1', 'c1'))
            send(txnMessage('2', 'c1'))
            send(txnMessage('1', 'c2'))
            await Promise.resolve()

            send({ kind: 'connection-closed', connectionId: 'c1' })

            expect(mockRemoveSignRequest).toHaveBeenCalledTimes(2)
            expect(mockRemoveSignRequest).toHaveBeenCalledWith(first)
            expect(mockRemoveSignRequest).toHaveBeenCalledWith(second)
        })

        it('withdraws on arrival when the close beats the enqueue', async () => {
            const signRequest = { id: 'sr-late' }
            let settle: (value: never) => void = () => {}
            mockEnqueue.mockReturnValueOnce(
                new Promise<never>(resolve => {
                    settle = resolve
                }),
            )
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            send(txnMessage('1', 'c1'))
            send({ kind: 'connection-closed', connectionId: 'c1' })
            expect(mockRemoveSignRequest).not.toHaveBeenCalled()

            settle(signRequest as never)
            await Promise.resolve()

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(signRequest)
        })
    })

    describe('sign-data', () => {
        it('enqueues an ARC-60 sign request', () => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canArc60: true })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const authData = {
                data: 'ZGF0YQ==',
                signer: PRIMARY_SIGNER,
                domain: 'example.com',
                authenticatorData: new Uint8Array([1, 2, 3]),
            }
            const metadata = { scope: 1, encoding: 'base64' }

            send(
                signDataMessage({ type: 'auth-data', authData, metadata }, [
                    PRIMARY_SIGNER,
                ]),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'auth-data',
                    authData,
                    metadata,
                    // The connection's peer identity, stamped as the
                    // anti-spoofing dApp identity shown on the signing sheet.
                    sourceMetadata: PEER,
                }),
            )
        })

        it('stamps the ARC-60 request with the source type the handler declared', () => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canArc60: true })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            send(
                signDataMessage(
                    {
                        type: 'auth-data',
                        authData: {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            domain: 'example.com',
                            authenticatorData: new Uint8Array([1, 2, 3]),
                        },
                        metadata: { scope: 1, encoding: 'base64' },
                    },
                    [PRIMARY_SIGNER],
                    'webview',
                ),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({ sourceType: 'webview' }),
            )
        })

        it('threads the transport-verified origin onto the ARC-60 request so the domain-mismatch warning can fire', () => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canArc60: true })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            send({
                ...signDataMessage(
                    {
                        type: 'auth-data',
                        authData: {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            domain: 'example.com',
                            authenticatorData: new Uint8Array([1, 2, 3]),
                        },
                        metadata: { scope: 1, encoding: 'base64' },
                    },
                    [PRIMARY_SIGNER],
                    'injected',
                ),
                verifiedOrigin: 'https://evil.example',
            })

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'auth-data',
                    verifiedOrigin: 'https://evil.example',
                }),
            )
        })

        it('threads the transport-verified origin onto a legacy arbitrary-data request', () => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canSignData: true })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            send({
                ...signDataMessage(
                    [
                        {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            chainId: 4160,
                        },
                    ],
                    [PRIMARY_SIGNER],
                    'injected',
                ),
                verifiedOrigin: 'https://dapp.example',
            })

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'arbitrary-data',
                    verifiedOrigin: 'https://dapp.example',
                }),
            )
        })

        it('enqueues a legacy arbitrary-data sign request', () => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canSignData: true })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const payload = [
                { data: 'ZGF0YQ==', signer: PRIMARY_SIGNER, chainId: 4160 },
            ]

            send(signDataMessage(payload, [PRIMARY_SIGNER]))

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'arbitrary-data',
                    chainId: CHAIN_ID,
                    data: payload,
                    // The connection's peer identity, stamped as the
                    // anti-spoofing dApp identity shown on the signing sheet.
                    sourceMetadata: PEER,
                }),
            )
        })

        it('rejects a signer outside the connection approved accounts', () => {
            // The security property: a session approved for PRIMARY_SIGNER
            // must not sign for REKEYED_SIGNER.
            mockAccounts = [mockAccount(REKEYED_SIGNER, { canSignData: true })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const message = signDataMessage(
                [
                    {
                        data: 'ZGF0YQ==',
                        signer: REKEYED_SIGNER,
                        chainId: 4160,
                    },
                ],
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects more items than MAX_DATA_SIGN_REQUESTS', () => {
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            // Mocked MAX_DATA_SIGN_REQUESTS is 2, above.
            const message = signDataMessage(
                [
                    { data: 'ZGF0YQ==', signer: PRIMARY_SIGNER, chainId: 4160 },
                    { data: 'ZGF0YQ==', signer: PRIMARY_SIGNER, chainId: 4160 },
                    { data: 'ZGF0YQ==', signer: PRIMARY_SIGNER, chainId: 4160 },
                ],
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects a signer that cannot sign arbitrary data', () => {
            // A watch account: present and authorized, but keyless.
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canSignData: false })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const message = signDataMessage(
                [
                    {
                        data: 'ZGF0YQ==',
                        signer: PRIMARY_SIGNER,
                        chainId: 4160,
                    },
                ],
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects an ARC-60 signer that cannot sign ARC-60', () => {
            // A multisig account: present and authorized, but a threshold
            // signature can never be represented in a single ARC-60 response.
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canArc60: false })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const message = signDataMessage(
                {
                    type: 'auth-data',
                    authData: {
                        data: 'ZGF0YQ==',
                        signer: PRIMARY_SIGNER,
                        domain: 'example.com',
                        authenticatorData: new Uint8Array([1, 2, 3]),
                    },
                    metadata: { scope: 1, encoding: 'base64' },
                },
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects an ARC-60 signer on a chain with no message signer', () => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canArc60: true })]
            mockHasMessageSigner = false
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const message = signDataMessage(
                {
                    type: 'auth-data',
                    authData: {
                        data: 'ZGF0YQ==',
                        signer: PRIMARY_SIGNER,
                        domain: 'example.com',
                        authenticatorData: new Uint8Array([1, 2, 3]),
                    },
                    metadata: { scope: 1, encoding: 'base64' },
                },
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('authorizes a signer that is the session account rekeyed to it', () => {
            // The session approved REKEYED_SIGNER, the account the wallet
            // holds. It's rekeyed to PRIMARY_SIGNER, which the dApp names as
            // `signer` directly (use-wallet v5 resolves the auth address
            // itself before sending the request) — never in
            // `authorizedAccounts` directly. Without the rekey branch in the
            // membership check, this would be wrongly rejected as an
            // unauthorized signer.
            mockAccounts = [
                mockAccount(REKEYED_SIGNER, { authority: PRIMARY_SIGNER }),
                mockAccount(PRIMARY_SIGNER, { canArc60: true }),
            ]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            send(
                signDataMessage(
                    {
                        type: 'auth-data',
                        authData: {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            domain: 'example.com',
                            authenticatorData: new Uint8Array([1, 2, 3]),
                        },
                        metadata: { scope: 1, encoding: 'base64' },
                    },
                    [REKEYED_SIGNER],
                ),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'auth-data' }),
            )
        })

        it('reads the rekey on the selected network', () => {
            mockAccounts = [
                mockAccount(REKEYED_SIGNER, {
                    authority: PRIMARY_SIGNER,
                    authorityNetwork: 'testnet',
                }),
                mockAccount(PRIMARY_SIGNER, { canArc60: true }),
            ]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const request = () =>
                signDataMessage(
                    {
                        type: 'auth-data',
                        authData: {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            domain: 'example.com',
                            authenticatorData: new Uint8Array([1, 2, 3]),
                        },
                        metadata: { scope: 1, encoding: 'base64' },
                    },
                    [REKEYED_SIGNER],
                )

            const onMainnet = request()
            send(onMainnet)
            expect(onMainnet.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()

            mockSelectedNetwork.current = 'testnet'
            send(request())
            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'auth-data' }),
            )
        })

        it('refuses a keyless rekeyed signer the dApp names directly', () => {
            // PRIMARY_SIGNER is authorized but holds no key of its own, and
            // its auth account cannot sign for it: an ARC-60 signature
            // verifies against the named signer's own key.
            mockAccounts = [
                mockAccount(PRIMARY_SIGNER, {
                    canArc60: false,
                    authority: REKEYED_SIGNER,
                }),
                mockAccount(REKEYED_SIGNER, { canArc60: true }),
            ]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const message = signDataMessage(
                {
                    type: 'auth-data',
                    authData: {
                        data: 'ZGF0YQ==',
                        signer: PRIMARY_SIGNER,
                        domain: 'example.com',
                        authenticatorData: new Uint8Array([1, 2, 3]),
                    },
                    metadata: { scope: 1, encoding: 'base64' },
                },
                [PRIMARY_SIGNER],
            )
            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('responds with signatures in request order', async () => {
            mockAccounts = [
                mockAccount(PRIMARY_SIGNER, { canSignData: true }),
                mockAccount(REKEYED_SIGNER, { canSignData: true }),
            ]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const respond = vi.fn(async () => {})
            const message = {
                kind: 'request' as const,
                chainId: CHAIN_ID,
                connectionId: 'c1',
                correlationId: '9',
                sourceType: 'walletconnect' as const,
                authorizedAccounts: [PRIMARY_SIGNER, REKEYED_SIGNER],
                peer: PEER,
                operation: {
                    type: 'sign-data' as const,
                    payload: [
                        {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            chainId: 4160,
                        },
                        {
                            data: 'ZGF0YWJj',
                            signer: REKEYED_SIGNER,
                            chainId: 4160,
                        },
                    ],
                },
                respond,
                reject: vi.fn(async () => {}),
            }
            send(message)

            const signRequest = mockAddSignRequest.mock.calls.at(-1)?.[0]
            const sig1 = new Uint8Array([1, 1, 1])
            const sig2 = new Uint8Array([2, 2, 2])
            await signRequest.approve([
                { signer: PRIMARY_SIGNER, signature: sig1 },
                { signer: REKEYED_SIGNER, signature: sig2 },
            ])

            expect(respond).toHaveBeenCalledWith({
                type: 'sign-data',
                signatures: [sig1, sig2],
            })
        })

        it('propagates a delivery failure from respond', async () => {
            // Same retryable-failure property as sign-transactions:
            // `approve` must let a failed delivery reject back to the caller
            // rather than swallowing it.
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canSignData: true })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            const respond = vi.fn(async () => {
                throw new Error('socket dead')
            })
            const message = {
                kind: 'request' as const,
                chainId: CHAIN_ID,
                connectionId: 'c1',
                correlationId: '9',
                sourceType: 'walletconnect' as const,
                authorizedAccounts: [PRIMARY_SIGNER],
                peer: PEER,
                operation: {
                    type: 'sign-data' as const,
                    payload: [
                        {
                            data: 'ZGF0YQ==',
                            signer: PRIMARY_SIGNER,
                            chainId: 4160,
                        },
                    ],
                },
                respond,
                reject: vi.fn(async () => {}),
            }
            send(message)

            const signRequest = mockAddSignRequest.mock.calls.at(-1)?.[0]

            await expect(
                signRequest.approve([
                    { signer: PRIMARY_SIGNER, signature: new Uint8Array([9]) },
                ]),
            ).rejects.toThrow('socket dead')
        })
    })

    describe('message', () => {
        const MESSAGE_PAYLOAD = { message: '0x68656c6c6f' }

        const messageRequest = (
            type: 'sign-message' | 'sign-typed-data' = 'sign-message',
            signer = PRIMARY_SIGNER,
        ) => ({
            kind: 'request' as const,
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '11',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: [PRIMARY_SIGNER],
            peer: PEER,
            verifiedOrigin: 'https://dapp.example',
            operation: {
                type,
                request: {
                    method: type === 'sign-message' ? 'plain' : 'structured',
                    signer,
                    payload: MESSAGE_PAYLOAD,
                },
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        })

        const enqueuedSignRequest = () =>
            mockAddSignRequest.mock.calls.at(-1)?.[0]

        beforeEach(() => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canSignData: true })]
            mockPlan.mockReset()
        })

        it('enqueues a message request on the selected scope, carrying the peer', () => {
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))

            send(messageRequest())

            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
            expect(enqueuedSignRequest()).toMatchObject({
                type: 'message',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: 'c1',
                sourceMetadata: PEER,
                verifiedOrigin: 'https://dapp.example',
                message: {
                    method: 'plain',
                    signer: PRIMARY_SIGNER,
                    payload: MESSAGE_PAYLOAD,
                    scope: { chainId: CHAIN_ID, networkId: 'mainnet' },
                },
            })
        })

        it.each(['sign-message', 'sign-typed-data'] as const)(
            'plans a %s once as a pre-check',
            type => {
                const { registry, send } = makeRegistry()
                renderHook(() =>
                    useConnectionSigningAdapter(registry, CHAIN_ID),
                )

                send(messageRequest(type))

                expect(mockPlan).toHaveBeenCalledTimes(1)
            },
        )

        it('answers the peer with the assembled signature bytes', async () => {
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = messageRequest('sign-typed-data')
            send(message)
            const bytes = new Uint8Array([7, 7, 7])

            await enqueuedSignRequest().approve({
                scope: { chainId: CHAIN_ID, networkId: 'mainnet' },
                signature: { bytes },
            })

            expect(message.respond).toHaveBeenCalledWith({
                type: 'sign-typed-data',
                signature: bytes,
            })
        })

        it('propagates a delivery failure from respond', async () => {
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = messageRequest()
            message.respond.mockRejectedValueOnce(new Error('socket closed'))
            send(message)

            await expect(
                enqueuedSignRequest().approve({
                    scope: { chainId: CHAIN_ID, networkId: 'mainnet' },
                    signature: { bytes: new Uint8Array([1]) },
                }),
            ).rejects.toThrow('socket closed')
        })

        it('rejects the peer with DappRequestRejectedError when the user declines', async () => {
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = messageRequest()
            send(message)

            await enqueuedSignRequest().reject()

            expect(message.reject).toHaveBeenCalledWith(
                expect.any(DappRequestRejectedError),
            )
            expect(message.reject.mock.calls[0][0].message).toBe(
                'User rejected',
            )
        })

        it('hands a soft reject to the peer as given and withdraws the request', async () => {
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = messageRequest()
            send(message)
            const handoff = new Error('handed off')

            await enqueuedSignRequest().reject({
                kind: 'softReject',
                error: handoff,
            })

            expect(message.reject).toHaveBeenCalledWith(handoff)
            expect(mockRemoveSignRequest).toHaveBeenCalledWith(
                enqueuedSignRequest(),
            )
        })

        it('answers and withdraws on an error the machine cannot retry', async () => {
            const { registry, send, reportError } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = messageRequest()
            send(message)
            const failure = new Error('key store is gone')

            await enqueuedSignRequest().error(failure)

            expect(message.reject).toHaveBeenCalledWith(failure)
            expect(reportError).toHaveBeenCalled()
            expect(mockRemoveSignRequest).toHaveBeenCalled()
        })

        it('declines a signer that cannot sign as an unsupported operation, with nothing enqueued', () => {
            mockAccounts = [mockAccount(PRIMARY_SIGNER, { canSignData: false })]
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = messageRequest()

            send(message)

            expect(message.reject).toHaveBeenCalledWith(
                expect.objectContaining({ failure: 'unsupported-method' }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(mockPlan).not.toHaveBeenCalled()
        })

        it('declines a signer the wallet no longer holds as unauthorized, with nothing enqueued', () => {
            mockAccounts = []
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = messageRequest()

            send(message)

            expect(message.reject).toHaveBeenCalledWith(
                expect.objectContaining({ failure: 'unauthorized-account' }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('declines a payload the chain plan refuses as invalid-payload, with nothing enqueued', () => {
            mockPlan.mockImplementation(() => {
                throw new Error('The payload is for another network')
            })
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = messageRequest('sign-typed-data')

            send(message)

            expect(message.reject).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'invalid-payload',
                    message: 'The payload is for another network',
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('withdraws the request when the peer stops waiting', () => {
            const { registry, send } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            send(messageRequest())

            send({
                kind: 'request-expired',
                connectionId: 'c1',
                correlationId: '11',
            })

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(
                enqueuedSignRequest(),
            )
        })
    })

    describe('send-transaction', () => {
        const BUILT = { scope: { chainId: CHAIN_ID }, payload: 'built' }
        const mockBuild = vi.fn(async (_request: unknown) => BUILT as never)

        const sendMessage = (correlationId = '5') => ({
            kind: 'request' as const,
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId,
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            verifiedOrigin: 'https://dapp.example',
            operation: {
                type: 'send-transaction' as const,
                request: { marker: 'validated' },
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        })

        const addedRequest = () => {
            const request = mockAddSignRequest.mock.calls[0]?.[0]
            if (!request) throw new Error('no sign request was queued')
            return request as {
                approve: (
                    signed: unknown[],
                    submission?: { txIds: string[] },
                ) => Promise<void>
                reject: (reason?: unknown) => Promise<void>
                error: (error: Error) => Promise<void>
                [key: string]: unknown
            }
        }

        const mount = () => {
            const harness = makeRegistry()
            renderHook(() =>
                useConnectionSigningAdapter(harness.registry, CHAIN_ID),
            )
            return harness
        }

        beforeEach(() => {
            mockBuild.mockReset()
            mockBuild.mockResolvedValue(BUILT as never)
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...fixtureAdapter(),
                sendTransaction: { validate: vi.fn(), build: mockBuild },
            })
        })

        it("queues the chain's built transaction for the broadcaster, tagged with the dApp's identity", async () => {
            const { send } = mount()

            send(sendMessage())
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            expect(mockBuild).toHaveBeenCalledWith({ marker: 'validated' })
            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
            expect(addedRequest()).toMatchObject({
                type: 'transactions',
                transport: 'network',
                sourceType: 'walletconnect',
                transportId: 'c1',
                sourceMetadata: PEER,
                verifiedOrigin: 'https://dapp.example',
                txs: [BUILT],
            })
        })

        it('answers the dApp with the submitted transaction id on approve', async () => {
            const { send } = mount()
            const message = sendMessage()
            send(message)
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            await addedRequest().approve([], { txIds: ['0xabc'] })

            expect(message.respond).toHaveBeenCalledWith({
                type: 'send-transaction',
                txId: '0xabc',
            })
        })

        it('throws on approve without a submission, so the transport logs it rather than faking an answer', async () => {
            const { send } = mount()
            const message = sendMessage()
            send(message)
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            await expect(addedRequest().approve([])).rejects.toThrow(
                /without being submitted/,
            )
            expect(message.respond).not.toHaveBeenCalled()
        })

        it('rejects the dApp with a user rejection on reject', async () => {
            const { send } = mount()
            const message = sendMessage()
            send(message)
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            await addedRequest().reject()

            expect(message.reject).toHaveBeenCalledWith(
                expect.any(DappRequestRejectedError),
            )
        })

        it('declines and tells the user when the chain cannot build, queuing nothing', async () => {
            const failure = new Error('execution reverted')
            mockBuild.mockRejectedValueOnce(failure)
            const { send, reportError } = mount()
            const message = sendMessage()

            send(message)
            await vi.waitFor(() => expect(message.reject).toHaveBeenCalled())

            expect(message.reject).toHaveBeenCalledWith(failure)
            expect(reportError).toHaveBeenCalledWith(failure, {
                connectionId: 'c1',
            })
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('never queues a request that expired while the transaction was priced', async () => {
            let settle: (value: never) => void = () => {}
            mockBuild.mockReturnValueOnce(
                new Promise<never>(resolve => {
                    settle = resolve
                }),
            )
            const { send } = mount()

            send(sendMessage())
            send({
                kind: 'request-expired',
                connectionId: 'c1',
                correlationId: '5',
            })
            settle(BUILT as never)
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('withdraws the queued request when the peer stops waiting', async () => {
            const { send } = mount()
            send(sendMessage())
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            send({
                kind: 'request-expired',
                connectionId: 'c1',
                correlationId: '5',
            })

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(addedRequest())
        })

        it('declines a chain that registers no sendTransaction', () => {
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register(fixtureAdapter())
            const { send, reportError } = mount()
            const message = sendMessage()

            send(message)

            expect(message.reject).toHaveBeenCalled()
            expect(reportError).toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })
    })

    it('rejects a declined sign-transactions request with a user rejection', async () => {
        mockEnqueue.mockResolvedValueOnce(null)
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
        const reject = vi.fn(async () => {})
        send({
            kind: 'request',
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '7',
            sourceType: 'walletconnect',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: { type: 'sign-transactions', group: [{ txn: 'b64' }] },
            respond: vi.fn(async () => {}),
            reject,
        })
        await Promise.resolve()

        lastTransport().respondWithReject()

        expect(reject).toHaveBeenCalledWith(
            expect.any(DappRequestRejectedError),
        )
        expect(reject).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'User rejected' }),
        )
    })

    it('rejects a declined sign-data request with a user rejection', async () => {
        mockAccounts = [mockAccount(PRIMARY_SIGNER, { canArc60: true })]
        const { registry, send } = makeRegistry()
        renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
        const message = signDataMessage(
            {
                type: 'auth-data',
                authData: {
                    data: 'ZGF0YQ==',
                    signer: PRIMARY_SIGNER,
                    domain: 'example.com',
                    authenticatorData: new Uint8Array([1]),
                },
                metadata: { scope: 1, encoding: 'base64' },
            },
            [PRIMARY_SIGNER],
        )
        send(message)

        await mockAddSignRequest.mock.calls[0][0].reject()

        expect(message.reject).toHaveBeenCalledWith(
            expect.any(DappRequestRejectedError),
        )
    })

    // The browser's approval window has no hook to mount: it reconstructs the
    // message and calls the function directly.
    it('enqueues through the pure function with explicit deps, no hook mounted', () => {
        const message = {
            kind: 'request' as const,
            chainId: CHAIN_ID,
            sourceType: 'walletconnect' as const,
            connectionId: 'c1',
            correlationId: '7',
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: {
                type: 'sign-transactions' as const,
                group: [{ txn: 'b64' }],
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        }

        enqueueInboundRequest(message, {
            transactionSigning: new Map([[CHAIN_ID, mockEnqueue]]),
            addSignRequest: mockAddSignRequest,
            removeSignRequest: mockRemoveSignRequest,
            isSignRequestPending: mockIsSignRequestPending,
            isSignRequestPastApproval: mockIsSignRequestPastApproval,
            accounts: [],
            pendingRequests: new Map(),
        })

        expect(mockEnqueue).toHaveBeenCalledWith(
            expect.objectContaining({ authorizedAccounts: ['AAAA'] }),
            expect.objectContaining({
                transportId: 'c1',
                sourceMetadata: PEER,
            }),
        )
    })

    describe('send-batch', () => {
        const FIRST = { scope: { chainId: CHAIN_ID }, payload: 'first' }
        const FOLLOWING = [{ scope: { chainId: CHAIN_ID }, payload: 'second' }]
        const PREPARED = {
            batchId: 'batch-1',
            first: FIRST,
            following: FOLLOWING,
            request: { marker: 'validated' },
        }
        const SIGNED_FIRST = {
            scope: { chainId: CHAIN_ID },
            id: '0xfirst',
            bytes: new Uint8Array([1]),
        }
        const APPROVAL = { token: 'approval-1' }
        const mockPrepare = vi.fn()
        const mockStart = vi.fn()
        const mockLocate = vi.fn()
        const mockShowTransaction = vi.fn()

        const batchMessage = (
            operation:
                | { type: 'send-batch'; request: unknown }
                | { type: 'show-batch'; batchId: string },
        ) => ({
            kind: 'request' as const,
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId: '9',
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            verifiedOrigin: 'https://dapp.example',
            operation,
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        })

        const addedRequest = () => {
            const request = mockAddSignRequest.mock.calls[0]?.[0]
            if (!request) throw new Error('no sign request was queued')
            return request as {
                approve: (
                    signed: unknown[],
                    submission?: unknown,
                    approval?: { token: string },
                ) => Promise<void>
                [key: string]: unknown
            }
        }

        const mount = () => {
            const harness = makeRegistry()
            renderHook(() =>
                useConnectionSigningAdapter(harness.registry, CHAIN_ID, {
                    showTransaction: mockShowTransaction,
                }),
            )
            return harness
        }

        beforeEach(() => {
            mockPrepare.mockReset()
            mockPrepare.mockResolvedValue(PREPARED)
            mockStart.mockReset()
            mockStart.mockResolvedValue(undefined)
            mockLocate.mockReset()
            mockShowTransaction.mockReset()
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...fixtureAdapter(),
                sendBatch: {
                    validate: vi.fn(),
                    prepare: mockPrepare,
                    start: mockStart,
                    locate: mockLocate,
                },
            })
        })

        it('Given a batch, when it is prepared, then one review signs the first transaction and lists the rest after it', async () => {
            const { send } = mount()

            send(
                batchMessage({
                    type: 'send-batch',
                    request: { marker: 'validated' },
                }),
            )
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            expect(mockPrepare).toHaveBeenCalledWith({ marker: 'validated' })
            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
            expect(addedRequest()).toMatchObject({
                type: 'transactions',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: 'c1',
                txs: [FIRST],
                followingTxs: FOLLOWING,
            })
        })

        it('Given the review, when the user approves, then the chain starts the batch before the dApp gets its id', async () => {
            const { send } = mount()
            const message = batchMessage({ type: 'send-batch', request: {} })
            send(message)
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            await addedRequest().approve([SIGNED_FIRST], undefined, APPROVAL)

            expect(mockStart).toHaveBeenCalledWith(
                PREPARED,
                SIGNED_FIRST,
                APPROVAL,
            )
            expect(message.respond).toHaveBeenCalledWith({
                type: 'send-batch',
                batchId: 'batch-1',
            })
            expect(mockStart.mock.invocationCallOrder[0]).toBeLessThan(
                message.respond.mock.invocationCallOrder[0],
            )
        })

        it('Given a batch of one call, when the user approves, then its review is still a batch and it starts', async () => {
            mockPrepare.mockResolvedValueOnce({ ...PREPARED, following: [] })
            const { send } = mount()
            const message = batchMessage({ type: 'send-batch', request: {} })
            send(message)
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            // Present though empty: it is what makes approving record the review.
            expect(addedRequest().followingTxs).toEqual([])
            await addedRequest().approve([SIGNED_FIRST], undefined, APPROVAL)

            expect(mockStart).toHaveBeenCalledWith(
                { ...PREPARED, following: [] },
                SIGNED_FIRST,
                APPROVAL,
            )
            expect(message.respond).toHaveBeenCalledWith({
                type: 'send-batch',
                batchId: 'batch-1',
            })
        })

        it('Given the batch cannot be recorded, when the user approves, then the dApp gets no id', async () => {
            mockStart.mockRejectedValueOnce(new Error('disk full'))
            const { send } = mount()
            const message = batchMessage({ type: 'send-batch', request: {} })
            send(message)
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            await expect(
                addedRequest().approve([SIGNED_FIRST], undefined, APPROVAL),
            ).rejects.toThrow('disk full')
            expect(message.respond).not.toHaveBeenCalled()
        })

        it('Given no recorded review, when the batch is approved, then nothing starts and the dApp gets no id', async () => {
            const { send } = mount()
            const message = batchMessage({ type: 'send-batch', request: {} })
            send(message)
            await vi.waitFor(() =>
                expect(mockAddSignRequest).toHaveBeenCalled(),
            )

            await expect(
                addedRequest().approve([SIGNED_FIRST]),
            ).rejects.toThrow(/review recorded/)
            expect(mockStart).not.toHaveBeenCalled()
            expect(message.respond).not.toHaveBeenCalled()
        })

        it('Given the chain refuses the batch with its own code, when preparing, then the dApp gets that code and nothing is queued', async () => {
            const refusal = new DappRequestCodedError(5720, 'Duplicate id')
            mockPrepare.mockRejectedValueOnce(refusal)
            const { send } = mount()
            const message = batchMessage({ type: 'send-batch', request: {} })

            send(message)
            await vi.waitFor(() => expect(message.reject).toHaveBeenCalled())

            expect(message.reject).toHaveBeenCalledWith(refusal)
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('Given a batch the session sent, when the dApp asks to show it, then its first transaction opens and the dApp is answered', async () => {
            const located = { scope: { chainId: CHAIN_ID }, txId: '0xfirst' }
            mockLocate.mockResolvedValueOnce(located)
            const { send } = mount()
            const message = batchMessage({
                type: 'show-batch',
                batchId: 'batch-1',
            })

            send(message)
            await vi.waitFor(() => expect(message.respond).toHaveBeenCalled())

            expect(mockLocate).toHaveBeenCalledWith('batch-1', ['AAAA'])
            expect(mockShowTransaction).toHaveBeenCalledWith(located)
            expect(message.respond).toHaveBeenCalledWith({ type: 'show-batch' })
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('Given an unknown batch, when the dApp asks to show it, then the chain refusal reaches the dApp and nothing opens', async () => {
            const refusal = new DappRequestCodedError(5730, 'Unknown bundle id')
            mockLocate.mockRejectedValueOnce(refusal)
            const { send, reportError } = mount()
            const message = batchMessage({
                type: 'show-batch',
                batchId: 'nope',
            })

            send(message)
            await vi.waitFor(() => expect(message.reject).toHaveBeenCalled())

            expect(message.reject).toHaveBeenCalledWith(refusal)
            expect(mockShowTransaction).not.toHaveBeenCalled()
            expect(reportError).not.toHaveBeenCalled()
        })
    })

    describe('switch-network', () => {
        const switchMessage = (correlationId = '3') => ({
            kind: 'request' as const,
            chainId: CHAIN_ID,
            connectionId: 'c1',
            correlationId,
            sourceType: 'walletconnect' as const,
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            operation: {
                type: 'switch-network' as const,
                networkId: 'sepolia',
            },
            respond: vi.fn(async () => {}),
            reject: vi.fn(async () => {}),
        })

        // A prompt the test settles by hand, the way the sheet's buttons do.
        const makePrompt = () => {
            let decide: (approved: boolean) => void = () => {}
            const decision = new Promise<boolean>(resolve => {
                decide = resolve
            })
            const dismiss = vi.fn(() => decide(false))
            return { decision, dismiss, decide }
        }

        const mount = (prompt = makePrompt()) => {
            const confirmNetworkSwitch = vi.fn(() => prompt)
            const harness = makeRegistry()
            renderHook(() =>
                useConnectionSigningAdapter(harness.registry, CHAIN_ID, {
                    confirmNetworkSwitch,
                }),
            )
            return { ...harness, prompt, confirmNetworkSwitch }
        }

        const settle = () => new Promise(resolve => setTimeout(resolve, 0))

        it('asks for the network and the peer, then answers once approved', async () => {
            const { send, prompt, confirmNetworkSwitch } = mount()
            const message = switchMessage()

            send(message)
            expect(confirmNetworkSwitch).toHaveBeenCalledWith({
                scope: { chainId: CHAIN_ID, networkId: 'sepolia' },
                peer: PEER,
            })
            expect(message.respond).not.toHaveBeenCalled()

            prompt.decide(true)
            await settle()

            expect(message.respond).toHaveBeenCalledWith({
                type: 'switch-network',
            })
            expect(message.reject).not.toHaveBeenCalled()
        })

        it('rejects the dApp with a user rejection when the user declines', async () => {
            const { send, prompt, reportError } = mount()
            const message = switchMessage()

            send(message)
            prompt.decide(false)
            await settle()

            expect(message.reject).toHaveBeenCalledWith(
                expect.any(DappRequestRejectedError),
            )
            expect(message.respond).not.toHaveBeenCalled()
            expect(reportError).not.toHaveBeenCalled()
        })

        it('declines and tells the user when the switch fails to apply', async () => {
            const failure = new Error('mode changed')
            const { send, prompt, reportError } = mount()
            const message = switchMessage()
            message.respond.mockRejectedValueOnce(failure)

            send(message)
            prompt.decide(true)
            await vi.waitFor(() => expect(message.reject).toHaveBeenCalled())

            expect(message.reject).toHaveBeenCalledWith(failure)
            expect(reportError).toHaveBeenCalledWith(failure, {
                connectionId: 'c1',
            })
        })

        it('declines when the sheet cannot open', async () => {
            const failure = new Error('no host mounted')
            const { send, reportError } = mount({
                decision: Promise.reject(failure),
                dismiss: vi.fn(),
                decide: () => {},
            })
            const message = switchMessage()

            send(message)
            await vi.waitFor(() => expect(message.reject).toHaveBeenCalled())

            expect(message.reject).toHaveBeenCalledWith(failure)
            expect(reportError).toHaveBeenCalledWith(failure, {
                connectionId: 'c1',
            })
        })

        it('declines when no prompt is available', () => {
            const { registry, send, reportError } = makeRegistry()
            renderHook(() => useConnectionSigningAdapter(registry, CHAIN_ID))
            const message = switchMessage()

            send(message)

            expect(message.reject).toHaveBeenCalledTimes(1)
            expect(reportError).toHaveBeenCalledTimes(1)
            expect(message.respond).not.toHaveBeenCalled()
        })

        it('dismisses the sheet and answers nothing when the request expires', async () => {
            const { send, prompt } = mount()
            const message = switchMessage()

            send(message)
            send({
                kind: 'request-expired',
                connectionId: 'c1',
                correlationId: '3',
            })
            await settle()

            expect(prompt.dismiss).toHaveBeenCalledTimes(1)
            expect(message.respond).not.toHaveBeenCalled()
            expect(message.reject).not.toHaveBeenCalled()
        })

        it('dismisses the sheet when the connection closes', async () => {
            const { send, prompt } = mount()
            const message = switchMessage()

            send(message)
            send({ kind: 'connection-closed', connectionId: 'c1' })
            await settle()

            expect(prompt.dismiss).toHaveBeenCalledTimes(1)
            expect(message.respond).not.toHaveBeenCalled()
            expect(message.reject).not.toHaveBeenCalled()
        })
    })

    it('unsubscribes on unmount', () => {
        const { registry, isSubscribed } = makeRegistry()
        const { unmount } = renderHook(() =>
            useConnectionSigningAdapter(registry, CHAIN_ID),
        )

        expect(isSubscribed()).toBe(true)
        unmount()
        expect(isSubscribed()).toBe(false)
    })
})
