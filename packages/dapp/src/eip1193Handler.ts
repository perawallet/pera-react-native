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

import type {
    ChainId,
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import {
    dappRequestChainAdapters,
    dappRequestFailureOf,
    isDappUserRejection,
    MAX_PENDING_REQUESTS_PER_PEER,
    type ConnectionHandler,
    type ConnectionProposal,
    type WalletNotice,
    type WalletOperationType,
} from '@perawallet/wallet-core-connections'
import { createHandlerKit } from '@perawallet/wallet-core-connections/handlerKit'
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import type {
    ConnectionId,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'
import {
    jsonRpcError,
    jsonRpcResult,
    sanitizeErrorForWebview,
    sanitizeRejectReason,
    type JsonRpcRequest,
    type JsonRpcResponse,
} from './codec'
import {
    eip155ChainIds,
    eip155HexChainIdOf,
    parseEip155HexChainId,
    type Eip155HexChainId,
} from './eip1193Chains'
import {
    EIP1193_DAPP_KIND,
    EIP1193_ERROR_CODE,
    EIP1193_EVENT,
    EIP1193_METHOD,
    EIP1193_PERMISSION_METHODS,
    EIP1193_SIGNING_METHODS,
} from './eip1193Protocol'
import {
    eip1193ConnectionIdOf,
    isEip1193Connection,
    type DappAccount,
    type DappRequestContext,
    type DappRespond,
    type DappTransport,
    type Eip1193Connection,
} from './models'
import {
    DAPP_APPROVAL_TTL_MS,
    DAPP_PROPOSAL_TTL_MS,
    DAPP_REQUEST_TTL_MS,
} from './protocol'

export type Eip1193HandlerDeps = {
    transport: DappTransport
    getNetworkId: (chainId: ChainId) => NetworkId
    isDappConnectEnabled: (chainId: ChainId) => boolean
    /**
     * The signing-capable accounts on `chainId`, read on every answer: an
     * account deleted, demoted or without the chain since approval drops out
     * of the page's view without the connection being touched.
     */
    getAccounts: (chainId: ChainId) => DappAccount[]
    /**
     * Whether the page's origin is on a phishing list or imitates a known
     * dApp. A flagged site never reconnects silently: it goes back through an
     * approval, where the warning shows. Absent, every connected site may.
     */
    isSiteFlagged?: (origin: string) => Promise<boolean>
    now?: () => number
    proposalTtlMs?: number
    requestTtlMs?: number
    approvalTtlMs?: number
}

type QueuedRequest = {
    ctx: DappRequestContext
    request: JsonRpcRequest
    respond: DappRespond
    timer: ReturnType<typeof setTimeout>
    isAnswered: boolean
    isRaising: boolean
    isCommitted: boolean
    raised?: { connectionId: ConnectionId; correlationId: string }
}

type ServedChain = { scope: ChainScope; hexChainId: Eip155HexChainId }

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isSameList = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((item, index) => item === b[index])

// Both lists must name it: the chains' v2 tables decide what asks the user,
// and the page gives only the named ones a backstop long enough to wait.
const isSigningMethod = (method: string): boolean =>
    EIP1193_SIGNING_METHODS.includes(method) &&
    eip155ChainIds().some(
        chainId =>
            dappRequestChainAdapters
                .get(chainId)
                .walletConnect.v2?.signingMethods.includes(method) ?? false,
    )

const unsupportedMethod = (request: JsonRpcRequest): JsonRpcResponse =>
    jsonRpcError(
        request.id,
        EIP1193_ERROR_CODE.unsupportedMethod,
        `Unsupported method '${request.method}'`,
    )

// The one place a site's chain is compared: always against a chain the caller
// passes, never a named one.
const isOnChain = (connection: Eip1193Connection, chainId: ChainId): boolean =>
    connection.metadata.chainId === chainId

// EIP-3326 carries the target as `[{ chainId: '0x…' }]`.
const requestedChainOf = (params: unknown): Eip155HexChainId | null => {
    const first: unknown = Array.isArray(params) ? params[0] : undefined
    return isRecord(first) ? parseEip155HexChainId(first.chainId) : null
}

export const createEip1193ConnectionHandler = (
    deps: Eip1193HandlerDeps,
): ConnectionHandler<Eip1193Connection> => {
    const now = deps.now ?? (() => Date.now())
    const proposalTtlMs = deps.proposalTtlMs ?? DAPP_PROPOSAL_TTL_MS
    const requestTtlMs = deps.requestTtlMs ?? DAPP_REQUEST_TTL_MS
    const approvalTtlMs = deps.approvalTtlMs ?? DAPP_APPROVAL_TTL_MS

    const kit = createHandlerKit(EIP1193_DAPP_KIND, {
        logTag: '[eip1193]',
        notInitializedError: () =>
            new Error('eip1193 handler is not initialized'),
    })
    const { requireContext, store } = kit
    let unsubscribe: (() => void) | null = null
    const openProposals = new Set<string>()
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>()
    // Index 0 is the request on screen; per origin, so every tab of a site
    // shares one.
    const siteQueues = new Map<string, QueuedRequest[]>()

    const getConnectionById = async (
        id: ConnectionId,
    ): Promise<Eip1193Connection | undefined> => {
        const connection = await store().get(id)
        return connection && isEip1193Connection(connection)
            ? connection
            : undefined
    }

    const getConnection = (origin: string) =>
        getConnectionById(eip1193ConnectionIdOf(origin))

    // A check that fails counts as flagged: the approval it forces is safe.
    const canReconnectSilently = async (origin: string): Promise<boolean> =>
        !deps.isSiteFlagged ||
        !(await deps.isSiteFlagged(origin).catch(() => true))

    const scopeOf = (chainId: ChainId): ChainScope => ({
        chainId,
        networkId: deps.getNetworkId(chainId),
    })

    const chainOn = (chainId: ChainId): ServedChain | undefined => {
        const scope = scopeOf(chainId)
        const hexChainId = eip155HexChainIdOf(scope)
        return hexChainId ? { scope, hexChainId } : undefined
    }

    // The gate decides which chains a site may connect or switch to; a
    // connection already on a chain keeps answering for it.
    const servedChains = (): ServedChain[] =>
        eip155ChainIds()
            .filter(deps.isDappConnectEnabled)
            .flatMap(chainId => {
                const chain = chainOn(chainId)
                return chain ? [chain] : []
            })

    const reportedAccounts = (connection: Eip1193Connection): string[] => {
        const held = new Set(
            deps
                .getAccounts(connection.metadata.chainId)
                .map(({ address }) => address),
        )
        return connection.accounts.filter(address => held.has(address))
    }

    const deliver = (
        respond: DappRespond,
        response: JsonRpcResponse,
    ): Promise<void> =>
        respond(response).catch((error: unknown) => {
            logger.warn('[eip1193] response never reached the page', {
                error,
            })
        })

    const notifyOrigin = (
        origin: string,
        method: string,
        params: unknown,
    ): Promise<void> =>
        deps.transport
            .notify(origin, { jsonrpc: '2.0', method, params })
            .catch((error: unknown) => {
                logger.warn('[eip1193] notification never reached the page', {
                    method,
                    error,
                })
            })

    const timedSettle = (onExpire: () => void, ttlMs: number) => {
        let settled = false
        const timer = setTimeout(() => {
            if (settled) return
            settle()
            onExpire()
        }, ttlMs)
        pendingTimers.add(timer)
        const settle = (): void => {
            settled = true
            clearTimeout(timer)
            pendingTimers.delete(timer)
        }
        return { settle, isSettled: () => settled }
    }

    const buildPeer = (ctx: DappRequestContext): ConnectionPeer => ({
        name: new URL(ctx.origin).host,
        url: ctx.origin,
        ...(ctx.faviconUrl ? { icons: [ctx.faviconUrl] } : {}),
    })

    const handleChainId = async (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        const connection = await getConnection(ctx.origin)
        if (connection) {
            const chain = chainOn(connection.metadata.chainId)
            return deliver(
                respond,
                chain
                    ? jsonRpcResult(request.id, chain.hexChainId)
                    : jsonRpcError(
                          request.id,
                          EIP1193_ERROR_CODE.chainDisconnected,
                          'The connected chain is not available',
                      ),
            )
        }
        const [chain] = servedChains()
        return deliver(
            respond,
            chain
                ? jsonRpcResult(request.id, chain.hexChainId)
                : jsonRpcError(
                      request.id,
                      EIP1193_ERROR_CODE.disconnected,
                      'The wallet serves no EVM chain to dApps',
                  ),
        )
    }

    const handleRequestAccounts = async (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        const { origin } = ctx
        // Claimed before the first `await`: two calls in one task would both
        // find the slot free across the store read and open two approvals.
        if (openProposals.has(origin)) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.resourceUnavailable,
                    'A connection request is already pending for this site',
                ),
            )
        }
        openProposals.add(origin)
        const releaseSlot = (): void => {
            openProposals.delete(origin)
        }
        const release = (response: JsonRpcResponse): Promise<void> => {
            releaseSlot()
            return deliver(respond, response)
        }

        const existing = await getConnection(origin)
        if (existing && (await canReconnectSilently(origin))) {
            const accounts = reportedAccounts(existing)
            if (accounts.length > 0) {
                kit.recordActivity(existing.id)
                return release(jsonRpcResult(request.id, accounts))
            }
        }
        // Unlike a reconnect, every path from here opens the approval window.
        if (!ctx.hasUserActivation) {
            return release(
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.unauthorized,
                    'eth_requestAccounts must be called from a user gesture',
                ),
            )
        }
        const served = servedChains()
        const chain =
            served.find(
                ({ scope }) =>
                    existing !== undefined &&
                    isOnChain(existing, scope.chainId),
            ) ?? served[0]
        if (!chain) {
            return release(
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.disconnected,
                    'The wallet serves no EVM chain to dApps',
                ),
            )
        }

        const peer = buildPeer(ctx)
        const { settle, isSettled } = timedSettle(() => {
            releaseSlot()
            void deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.userRejected,
                    'The connection request expired',
                ),
            )
        }, proposalTtlMs)

        const proposal: ConnectionProposal = {
            kind: EIP1193_DAPP_KIND,
            proposalId: generateOrderedUniqueId(),
            peer,
            requesterOrigin: origin,
            requested: {
                networks: [chain.scope.networkId],
                chains: [chain.scope.chainId],
                methods: [...EIP1193_PERMISSION_METHODS],
            },
            expiresAt: now() + proposalTtlMs,
            approve: async accounts => {
                if (isSettled()) {
                    throw new Error(
                        'The connection proposal has already been settled',
                    )
                }
                settle()
                const held = new Set(
                    deps
                        .getAccounts(chain.scope.chainId)
                        .map(({ address }) => address),
                )
                const granted = accounts.filter(address => held.has(address))
                if (granted.length === 0) {
                    releaseSlot()
                    await deliver(
                        respond,
                        jsonRpcError(
                            request.id,
                            EIP1193_ERROR_CODE.unauthorized,
                            'No approved account can use this chain',
                        ),
                    )
                    throw new Error('No approved account can use this chain')
                }
                const connection: Eip1193Connection = {
                    id: eip1193ConnectionIdOf(origin),
                    kind: EIP1193_DAPP_KIND,
                    name: peer.name,
                    peer,
                    accounts: granted,
                    status: 'active',
                    createdAt: existing?.createdAt ?? now(),
                    lastActiveAt: now(),
                    metadata: { chainId: chain.scope.chainId },
                    origin: { requesterOrigin: origin },
                }
                try {
                    await store().upsert(connection)
                } finally {
                    // Freed only once the record exists: a second tab
                    // claiming the slot mid-upsert would open a second approval.
                    releaseSlot()
                }
                // Other tabs of the site learn the grant here; the requesting
                // one also reads it off the answer.
                if (existing && !isOnChain(existing, chain.scope.chainId)) {
                    await notifyOrigin(
                        origin,
                        EIP1193_EVENT.chainChanged,
                        chain.hexChainId,
                    )
                }
                const reported = reportedAccounts(connection)
                await notifyOrigin(
                    origin,
                    EIP1193_EVENT.accountsChanged,
                    reported,
                )
                await deliver(respond, jsonRpcResult(request.id, reported))
                return connection
            },
            reject: async reason => {
                if (isSettled()) return
                settle()
                releaseSlot()
                await deliver(
                    respond,
                    jsonRpcError(
                        request.id,
                        EIP1193_ERROR_CODE.userRejected,
                        sanitizeRejectReason(reason),
                    ),
                )
            },
        }
        requireContext().onProposal(proposal)
    }

    const handleSwitchChain = (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        if (!requestedChainOf(request.params)) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.invalidParams,
                    'Expected [{ chainId }] with a hex chain id',
                ),
            )
        }
        return enqueueRequest(ctx, request, respond)
    }

    const removeQueued = (entry: QueuedRequest): boolean => {
        const { origin } = entry.ctx
        const queue = siteQueues.get(origin) ?? []
        const index = queue.indexOf(entry)
        if (index !== -1) queue.splice(index, 1)
        if (queue.length === 0) siteQueues.delete(origin)
        return index === 0
    }

    const disarm = (entry: QueuedRequest): void => {
        clearTimeout(entry.timer)
        pendingTimers.delete(entry.timer)
    }

    // The one way a queued request is answered, so each is answered once and
    // its timer never outlives it.
    const answerQueued = (
        entry: QueuedRequest,
        response: JsonRpcResponse,
    ): Promise<void> => {
        if (entry.isAnswered) return Promise.resolve()
        entry.isAnswered = true
        disarm(entry)
        return deliver(entry.respond, response)
    }

    const finishQueued = (
        entry: QueuedRequest,
        response: JsonRpcResponse,
    ): Promise<void> => {
        if (entry.isAnswered) return Promise.resolve()
        const delivered = answerQueued(entry, response)
        if (removeQueued(entry)) void raiseHead(entry.ctx.origin)
        return delivered
    }

    // Its broadcast is underway, so only the broadcast's own outcome may
    // answer it: no expiry, and no revoke.
    const commitQueued = (entry: QueuedRequest): void => {
        if (entry.isAnswered) return
        entry.isCommitted = true
        disarm(entry)
    }

    // A user who declines one request has answered for the site's backlog
    // too, so a burst costs one Reject rather than one each.
    const rejectSiteQueue = (
        entry: QueuedRequest,
        response: JsonRpcResponse,
    ): Promise<void> => {
        if (entry.isAnswered) return Promise.resolve()
        const queue = siteQueues.get(entry.ctx.origin) ?? []
        siteQueues.delete(entry.ctx.origin)
        for (const queued of queue) {
            if (queued === entry) continue
            void answerQueued(
                queued,
                jsonRpcError(
                    queued.request.id,
                    EIP1193_ERROR_CODE.userRejected,
                    'The user rejected an earlier request from this site',
                ),
            )
        }
        return answerQueued(entry, response)
    }

    const armOnScreen = (
        entry: QueuedRequest,
        connectionId: ConnectionId,
        correlationId: string,
        ttlMs: number,
    ): void => {
        disarm(entry)
        entry.raised = { connectionId, correlationId }
        entry.timer = setTimeout(() => {
            void finishQueued(
                entry,
                jsonRpcError(
                    entry.request.id,
                    EIP1193_ERROR_CODE.internal,
                    'The wallet did not answer in time',
                ),
            )
            requireContext().onRequestExpired(connectionId, correlationId)
        }, ttlMs)
        pendingTimers.add(entry.timer)
    }

    const raiseSwitchRequest = async (
        entry: QueuedRequest,
        connection: Eip1193Connection,
    ): Promise<void> => {
        const { ctx, request } = entry
        const requested = requestedChainOf(request.params)
        // Read at the head, not on arrival: a switch queued behind another
        // may already be satisfied, or aim at a chain that went away.
        if (chainOn(connection.metadata.chainId)?.hexChainId === requested) {
            await finishQueued(entry, jsonRpcResult(request.id, null))
            return
        }
        const target = servedChains().find(
            ({ hexChainId }) => hexChainId === requested,
        )
        if (!target) {
            await finishQueued(
                entry,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.unrecognizedChain,
                    'Pera does not have that chain',
                ),
            )
            return
        }

        const correlationId = generateOrderedUniqueId()
        armOnScreen(entry, connection.id, correlationId, requestTtlMs)
        requireContext().onMessage({
            kind: 'request',
            chainId: target.scope.chainId,
            connectionId: connection.id,
            correlationId,
            sourceType: 'injected',
            authorizedAccounts: connection.accounts,
            peer: connection.peer,
            verifiedOrigin: ctx.origin,
            rawOperation: {
                type: 'switch-network',
                params: { networkId: target.scope.networkId },
            },
            // A throw here declines the request, so the page is answered
            // through `reject` rather than told of a chain it can't use.
            respond: async () => {
                if (entry.isAnswered) throw new Error('The request has expired')
                const stored = await getConnection(ctx.origin)
                // The timer stays armed until the answer: a throw below may
                // never be followed by a `reject`, and only it frees the queue.
                if (entry.isAnswered) throw new Error('The request has expired')
                const current = chainOn(target.scope.chainId)
                if (!stored || current?.hexChainId !== target.hexChainId) {
                    throw new Error('The chain is no longer available')
                }
                const switched: Eip1193Connection = {
                    ...stored,
                    metadata: {
                        ...stored.metadata,
                        chainId: target.scope.chainId,
                    },
                    lastActiveAt: now(),
                }
                await store().upsert(switched)
                await notifyOrigin(
                    ctx.origin,
                    EIP1193_EVENT.chainChanged,
                    target.hexChainId,
                )
                const before = reportedAccounts(stored)
                const after = reportedAccounts(switched)
                if (!isSameList(before, after)) {
                    await notifyOrigin(
                        ctx.origin,
                        EIP1193_EVENT.accountsChanged,
                        after,
                    )
                }
                await finishQueued(entry, jsonRpcResult(request.id, null))
            },
            reject: async error => {
                if (isDappUserRejection(error)) {
                    await rejectSiteQueue(
                        entry,
                        jsonRpcError(
                            request.id,
                            EIP1193_ERROR_CODE.userRejected,
                            'The user rejected the request',
                        ),
                    )
                    return
                }
                await finishQueued(
                    entry,
                    jsonRpcError(
                        request.id,
                        EIP1193_ERROR_CODE.internal,
                        sanitizeErrorForWebview(error),
                    ),
                )
            },
        })
        kit.recordActivity(connection.id)
    }

    const raiseSigningRequest = (
        entry: QueuedRequest,
        connection: Eip1193Connection,
        operation: { type: WalletOperationType; params: unknown },
    ): void => {
        const { ctx, request } = entry
        const { chainId } = connection.metadata
        const adapter = dappRequestChainAdapters.get(chainId)
        const { walletConnect } = adapter
        const correlationId = generateOrderedUniqueId()
        const errorResponse = (error: Error): JsonRpcResponse => {
            const failure = dappRequestFailureOf(error)
            return jsonRpcError(
                request.id,
                failure && walletConnect.toWireErrorCode
                    ? walletConnect.toWireErrorCode(failure)
                    : EIP1193_ERROR_CODE.internal,
                sanitizeErrorForWebview(error, adapter.relayableErrorNames),
            )
        }

        // On screen the window owns the lifetime; the approval TTL only frees
        // a queue whose answer was lost.
        armOnScreen(entry, connection.id, correlationId, approvalTtlMs)
        requireContext().onMessage({
            kind: 'request',
            chainId,
            connectionId: connection.id,
            correlationId,
            sourceType: 'injected',
            authorizedAccounts: reportedAccounts(connection),
            peer: connection.peer,
            verifiedOrigin: ctx.origin,
            rawOperation: operation,
            commit: () => commitQueued(entry),
            // Answered before delivery, unlike `handleSign`: a sent
            // transaction is already on chain, so a result for a closed tab
            // is dropped, not retried.
            respond: async result => {
                if (entry.isAnswered) {
                    throw new Error('The request is no longer pending')
                }
                let wire: unknown
                try {
                    wire = walletConnect.toWireResult(result)
                } catch (error) {
                    logger.error(
                        '[eip1193] could not encode a signing result',
                        {
                            error,
                        },
                    )
                    await finishQueued(
                        entry,
                        jsonRpcError(
                            request.id,
                            EIP1193_ERROR_CODE.internal,
                            'Internal error',
                        ),
                    )
                    return
                }
                await finishQueued(entry, jsonRpcResult(request.id, wire))
            },
            reject: async error => {
                if (isDappUserRejection(error)) {
                    await rejectSiteQueue(
                        entry,
                        jsonRpcError(
                            request.id,
                            EIP1193_ERROR_CODE.userRejected,
                            'The user rejected the request',
                        ),
                    )
                    return
                }
                await finishQueued(entry, errorResponse(error))
            },
        })
        kit.recordActivity(connection.id)
    }

    // The connection and chain are read when the request reaches the head,
    // not on arrival: a queued request can wait a whole TTL, and an account
    // or chain dropped meanwhile must not reach the approval.
    const raiseHead = async (origin: string): Promise<void> => {
        const head = siteQueues.get(origin)?.[0]
        if (!head || head.isRaising) return
        head.isRaising = true
        const { request } = head
        try {
            const connection = await getConnection(origin)
            if (head.isAnswered) return
            if (!connection) {
                await finishQueued(
                    head,
                    jsonRpcError(
                        request.id,
                        EIP1193_ERROR_CODE.unauthorized,
                        'Not connected: call eth_requestAccounts first',
                    ),
                )
                return
            }
            if (request.method === EIP1193_METHOD.switchChain) {
                await raiseSwitchRequest(head, connection)
                return
            }
            const { chainId } = connection.metadata
            if (!chainOn(chainId)) {
                await finishQueued(
                    head,
                    jsonRpcError(
                        request.id,
                        EIP1193_ERROR_CODE.chainDisconnected,
                        'The connected chain is not available',
                    ),
                )
                return
            }
            const route = dappRequestChainAdapters
                .get(chainId)
                .walletConnect.v2?.handleRequest(request.method, request.params)
            if (route?.kind === 'operation') {
                raiseSigningRequest(head, connection, {
                    type: route.type,
                    params: route.params,
                })
                return
            }
            await finishQueued(
                head,
                route?.kind === 'refused'
                    ? jsonRpcError(
                          request.id,
                          route.error.code,
                          route.error.message,
                      )
                    : unsupportedMethod(request),
            )
        } catch (error) {
            logger.error('[eip1193] could not raise a signing request', {
                method: request.method,
                error,
            })
            await finishQueued(
                head,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.internal,
                    'Internal error',
                ),
            )
        }
    }

    // Synchronous on purpose: two requests in one task must not both pass the
    // cap. The TTL bounds only the wait in the queue.
    const enqueueRequest = (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        const queue = siteQueues.get(ctx.origin) ?? []
        if (queue.length >= MAX_PENDING_REQUESTS_PER_PEER) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.limitExceeded,
                    'Too many requests are already pending for this site',
                ),
            )
        }
        const entry: QueuedRequest = {
            ctx,
            request,
            respond,
            timer: setTimeout(() => {
                void finishQueued(
                    entry,
                    jsonRpcError(
                        request.id,
                        EIP1193_ERROR_CODE.internal,
                        'The wallet did not answer in time',
                    ),
                )
            }, requestTtlMs),
            isAnswered: false,
            isRaising: false,
            isCommitted: false,
        }
        pendingTimers.add(entry.timer)
        queue.push(entry)
        siteQueues.set(ctx.origin, queue)
        return raiseHead(ctx.origin)
    }

    const handleChainRequest = async (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        if (isSigningMethod(request.method)) {
            return enqueueRequest(ctx, request, respond)
        }
        const connection = await getConnection(ctx.origin)
        if (!connection) return deliver(respond, unsupportedMethod(request))
        const { chainId } = connection.metadata
        if (!chainOn(chainId)) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.chainDisconnected,
                    'The connected chain is not available',
                ),
            )
        }
        const route = dappRequestChainAdapters
            .get(chainId)
            .walletConnect.v2?.handleRequest(request.method, request.params)
        if (route?.kind === 'refused') {
            return deliver(
                respond,
                jsonRpcError(request.id, route.error.code, route.error.message),
            )
        }
        // Only the queued signing methods reach the user; public data and
        // switches the v2 table serves are the handler's own cases above.
        return deliver(respond, unsupportedMethod(request))
    }

    // The approval window only withdraws a closed connection's request, so
    // the page is answered here, including for the one on screen.
    const dropSiteQueue = (id: ConnectionId): void => {
        for (const [origin, queue] of siteQueues) {
            if (eip1193ConnectionIdOf(origin) !== id) continue
            siteQueues.delete(origin)
            for (const entry of queue) {
                if (entry.isCommitted) continue
                const { raised } = entry
                void answerQueued(
                    entry,
                    jsonRpcError(
                        entry.request.id,
                        EIP1193_ERROR_CODE.unauthorized,
                        'The site was disconnected',
                    ),
                )
                // A head raised while the record was being removed can land
                // after `connection-closed`, which then never withdraws it.
                if (raised) {
                    requireContext().onRequestExpired(
                        raised.connectionId,
                        raised.correlationId,
                    )
                }
            }
        }
    }

    const disconnect = async (id: ConnectionId): Promise<void> => {
        const connection = await getConnectionById(id)
        if (connection) await store().remove(id)
        // After the removal, so a request that arrived meanwhile and read
        // the record before it went is answered too.
        dropSiteQueue(id)
        if (!connection) return
        // EIP-1193's `disconnect` means the provider lost every chain; a
        // revoked site is told it holds no accounts.
        await notifyOrigin(
            connection.origin.requesterOrigin,
            EIP1193_EVENT.accountsChanged,
            [],
        )
        requireContext().onDisconnected(id)
    }

    const dispatch = async (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        switch (request.method) {
            case EIP1193_METHOD.chainId: {
                return handleChainId(ctx, request, respond)
            }
            case EIP1193_METHOD.accounts: {
                const connection = await getConnection(ctx.origin)
                return deliver(
                    respond,
                    jsonRpcResult(
                        request.id,
                        connection ? reportedAccounts(connection) : [],
                    ),
                )
            }
            case EIP1193_METHOD.requestAccounts: {
                return handleRequestAccounts(ctx, request, respond)
            }
            case EIP1193_METHOD.switchChain: {
                return handleSwitchChain(ctx, request, respond)
            }
            case EIP1193_METHOD.addChain: {
                return deliver(
                    respond,
                    jsonRpcError(
                        request.id,
                        EIP1193_ERROR_CODE.unsupportedMethod,
                        'Pera supports only the chains it ships',
                    ),
                )
            }
            case EIP1193_METHOD.revokePermissions: {
                await disconnect(eip1193ConnectionIdOf(ctx.origin))
                return deliver(respond, jsonRpcResult(request.id, null))
            }
            default: {
                return handleChainRequest(ctx, request, respond)
            }
        }
    }

    const onRequest = (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): void => {
        void dispatch(ctx, request, respond).catch((error: unknown) => {
            // A request that threw between claiming the site's slot and handing
            // over the proposal would otherwise hold it forever.
            if (request.method === EIP1193_METHOD.requestAccounts) {
                openProposals.delete(ctx.origin)
            }
            logger.error('[eip1193] request failed', {
                method: request.method,
                error,
            })
            void deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.internal,
                    'Internal error',
                ),
            )
        })
    }

    const restore = async (): Promise<Eip1193Connection[]> =>
        (await store().list()).filter(isEip1193Connection)

    return {
        kind: EIP1193_DAPP_KIND,
        async initialize(ctx) {
            kit.attach(ctx)
            unsubscribe = deps.transport.onRequest(onRequest)
        },
        async teardown() {
            unsubscribe?.()
            unsubscribe = null
            const queued = [...siteQueues.values()].flat()
            siteQueues.clear()
            await Promise.all(
                queued.map(entry => {
                    // Left open, the window could still broadcast a send whose
                    // page was just told the wallet closed.
                    if (entry.raised) {
                        kit.currentContext()?.onRequestExpired(
                            entry.raised.connectionId,
                            entry.raised.correlationId,
                        )
                    }
                    return answerQueued(
                        entry,
                        jsonRpcError(
                            entry.request.id,
                            EIP1193_ERROR_CODE.disconnected,
                            'The wallet closed the connection',
                        ),
                    )
                }),
            )
            pendingTimers.forEach(timer => clearTimeout(timer))
            pendingTimers.clear()
            openProposals.clear()
            kit.detach()
        },
        disconnect,
        async disconnectAll() {
            const all = await restore()
            await Promise.all(all.map(connection => disconnect(connection.id)))
        },
        restore,
        matchesChainScope: (connection, scope) =>
            isOnChain(connection, scope.chainId),
        methodsFor: () => [...EIP1193_PERMISSION_METHODS],
        async notify(id, notice: WalletNotice) {
            const connection = await getConnectionById(id)
            if (!connection) return
            const origin = connection.origin.requesterOrigin
            if (notice.type === 'network-changed') {
                if (!isOnChain(connection, notice.scope.chainId)) return
                const hexChainId = eip155HexChainIdOf(notice.scope)
                if (!hexChainId) return
                await deps.transport.notify(origin, {
                    jsonrpc: '2.0',
                    method: EIP1193_EVENT.chainChanged,
                    params: hexChainId,
                })
                return
            }
            if (!isOnChain(connection, notice.chainId)) return
            if (!connection.accounts.some(a => notice.changed.includes(a))) {
                return
            }
            await deps.transport.notify(origin, {
                jsonrpc: '2.0',
                method: EIP1193_EVENT.accountsChanged,
                params: reportedAccounts(connection),
            })
        },
    }
}
