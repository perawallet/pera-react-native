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
    dappRequestFailureOf,
    type ConnectionHandler,
    type ConnectionProposal,
    type WalletNotice,
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
import { DAPP_PROPOSAL_TTL_MS, DAPP_REQUEST_TTL_MS } from './protocol'

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
    now?: () => number
    proposalTtlMs?: number
    requestTtlMs?: number
}

type ServedChain = { scope: ChainScope; hexChainId: Eip155HexChainId }

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isSameList = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((item, index) => item === b[index])

const isUserRejection = (error: Error): boolean =>
    error.name === 'UserCancelledError' ||
    dappRequestFailureOf(error) === 'user-rejected'

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

    const kit = createHandlerKit(EIP1193_DAPP_KIND, {
        logTag: '[eip1193]',
        notInitializedError: () =>
            new Error('eip1193 handler is not initialized'),
    })
    const { requireContext, store } = kit
    let unsubscribe: (() => void) | null = null
    const openProposals = new Set<string>()
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

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
        if (existing) {
            const accounts = reportedAccounts(existing)
            if (accounts.length > 0) {
                kit.recordActivity(existing.id)
                return release(jsonRpcResult(request.id, accounts))
            }
        }
        if (!existing && !ctx.hasUserActivation) {
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

    const handleSwitchChain = async (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        const requested = requestedChainOf(request.params)
        if (!requested) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.invalidParams,
                    'Expected [{ chainId }] with a hex chain id',
                ),
            )
        }
        const connection = await getConnection(ctx.origin)
        if (!connection) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.unauthorized,
                    'Not connected: call eth_requestAccounts first',
                ),
            )
        }
        if (chainOn(connection.metadata.chainId)?.hexChainId === requested) {
            return deliver(respond, jsonRpcResult(request.id, null))
        }
        const target = servedChains().find(
            ({ hexChainId }) => hexChainId === requested,
        )
        if (!target) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.unrecognizedChain,
                    'Pera does not have that chain',
                ),
            )
        }

        const correlationId = generateOrderedUniqueId()
        const { settle, isSettled } = timedSettle(() => {
            requireContext().onRequestExpired(connection.id, correlationId)
            void deliver(
                respond,
                jsonRpcError(
                    request.id,
                    EIP1193_ERROR_CODE.internal,
                    'The wallet did not answer in time',
                ),
            )
        }, requestTtlMs)

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
                if (isSettled()) throw new Error('The request has expired')
                const stored = await getConnection(ctx.origin)
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
                await respond(jsonRpcResult(request.id, null))
                settle()
            },
            reject: async error => {
                await respond(
                    isUserRejection(error)
                        ? jsonRpcError(
                              request.id,
                              EIP1193_ERROR_CODE.userRejected,
                              'The user rejected the request',
                          )
                        : jsonRpcError(
                              request.id,
                              EIP1193_ERROR_CODE.internal,
                              sanitizeErrorForWebview(error),
                          ),
                )
                settle()
            },
        })
        kit.recordActivity(connection.id)
    }

    const disconnect = async (id: ConnectionId): Promise<void> => {
        const connection = await getConnectionById(id)
        if (!connection) return
        await store().remove(id)
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
                return deliver(
                    respond,
                    jsonRpcError(
                        request.id,
                        EIP1193_ERROR_CODE.unsupportedMethod,
                        `Unsupported method '${request.method}'`,
                    ),
                )
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
