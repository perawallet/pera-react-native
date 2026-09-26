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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    dappRequestChainAdapters,
    type ConnectionHandler,
    type ConnectionProposal,
    type DappRequestChainAdapter,
    type WalletNotice,
    type WalletOperationResult,
    type WalletOperationType,
} from '@perawallet/wallet-core-connections'
import { createHandlerKit } from '@perawallet/wallet-core-connections/handlerKit'
import {
    encodeToBase64,
    generateOrderedUniqueId,
    logger,
    type Network,
} from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionId,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'
import {
    JsonRpcErrorCode,
    jsonRpcError,
    jsonRpcResult,
    sanitizeErrorForWebview,
    sanitizeRejectReason,
    type JsonRpcRequest,
    type JsonRpcResponse,
} from './codec'
import { sanitizeDappIcons } from './icons'
import type {
    DappAccount,
    DappConnection,
    DappRequestContext,
    DappRespond,
    DappTransport,
} from './models'
import {
    DAPP_KIND,
    DAPP_METHODS,
    DAPP_NOTIFICATIONS,
    DAPP_PROPOSAL_TTL_MS,
    DAPP_REQUEST_TTL_MS,
    type DappMethod,
} from './protocol'

export type DappHandlerDeps = {
    transport: DappTransport
    /**
     * The chain this realm answers for. The `window.pera` protocol carries no
     * chain, so it is fixed per handler.
     */
    chainId: ChainId
    getNetwork: () => Network
    getCustomNetworkGenesisHash: () => string | undefined
    /**
     * The wallet's current signing-capable accounts. Read on every answer, not
     * cached: a connection's approved list is filtered down to what this still
     * returns, so an account the user has since deleted or demoted disappears
     * from the page's view without the connection itself being touched.
     */
    getAccounts: () => DappAccount[]
    now?: () => number
    proposalTtlMs?: number
    requestTtlMs?: number
}

const MAX_PEER_NAME_LENGTH = 100
const MAX_PEER_DESCRIPTION_LENGTH = 300

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isDappConnection = (
    connection: Connection,
): connection is DappConnection => connection.kind === DAPP_KIND

const isDappMethod = (method: string): method is DappMethod =>
    (DAPP_METHODS as readonly string[]).includes(method)

const toWireResult = (result: WalletOperationResult): unknown =>
    result.type === 'sign-transactions'
        ? result.signed
        : result.signatures.map(encodeToBase64)

const toErrorResponse = (
    id: JsonRpcRequest['id'],
    error: Error,
    relayableErrorNames: readonly string[],
): JsonRpcResponse => {
    if (error.name === 'UserCancelledError') {
        return jsonRpcError(
            id,
            JsonRpcErrorCode.UserRejected,
            'The user rejected the request',
        )
    }
    // The registry's own payload validation names the offending field; that
    // only echoes the page's request back at it.
    if ((error as { code?: unknown }).code === 'invalid-payload') {
        return jsonRpcError(id, JsonRpcErrorCode.InvalidParams, error.message)
    }
    return jsonRpcError(
        id,
        JsonRpcErrorCode.InternalError,
        sanitizeErrorForWebview(error, relayableErrorNames),
    )
}

const chainNotSupported = (id: JsonRpcRequest['id']): JsonRpcResponse =>
    jsonRpcError(
        id,
        JsonRpcErrorCode.NetworkNotSupported,
        'The wallet cannot answer requests for this chain',
    )

export const createDappConnectionHandler = (
    deps: DappHandlerDeps,
): ConnectionHandler<DappConnection> => {
    const now = deps.now ?? (() => Date.now())
    const proposalTtlMs = deps.proposalTtlMs ?? DAPP_PROPOSAL_TTL_MS
    const requestTtlMs = deps.requestTtlMs ?? DAPP_REQUEST_TTL_MS

    const kit = createHandlerKit(DAPP_KIND, {
        logTag: '[dapp]',
        notInitializedError: () => new Error('dapp handler is not initialized'),
    })
    const { requireContext, store } = kit
    let unsubscribe: (() => void) | null = null
    const openProposals = new Set<string>()
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

    const getConnection = async (
        origin: string,
    ): Promise<DappConnection | undefined> => {
        const connection = await store().get(origin)
        return connection && isDappConnection(connection)
            ? connection
            : undefined
    }

    // Pruned against the live account list on every read, never just at
    // approval: an account deleted or demoted since must not be handed back to
    // the page as one it may still ask us to sign for.
    const accountsFor = (connection: DappConnection): DappAccount[] => {
        const known = new Map(
            deps.getAccounts().map(account => [account.address, account]),
        )
        return connection.accounts.flatMap(address => {
            const account = known.get(address)
            return account ? [account] : []
        })
    }

    // Looked up per request, not at construction: a realm may build the
    // handler before its bootstrap has registered the chain's adapters.
    const chainAdapter = (): DappRequestChainAdapter | undefined =>
        dappRequestChainAdapters.has(deps.chainId)
            ? dappRequestChainAdapters.get(deps.chainId)
            : undefined

    const deliver = (
        respond: DappRespond,
        response: JsonRpcResponse,
    ): Promise<void> =>
        respond(response).catch((error: unknown) => {
            logger.warn('[dapp] response never reached the page', { error })
        })

    const buildPeer = (
        ctx: DappRequestContext,
        params: Record<string, unknown>,
    ): ConnectionPeer => {
        const name =
            typeof params.name === 'string' && params.name.trim()
                ? params.name.trim().slice(0, MAX_PEER_NAME_LENGTH)
                : new URL(ctx.origin).host
        const description =
            typeof params.description === 'string' && params.description.trim()
                ? params.description
                      .trim()
                      .slice(0, MAX_PEER_DESCRIPTION_LENGTH)
                : undefined
        const icons =
            sanitizeDappIcons(params.icons, ctx.origin) ??
            (ctx.faviconUrl ? [ctx.faviconUrl] : undefined)
        return {
            name,
            url: ctx.origin,
            ...(description ? { description } : {}),
            ...(icons ? { icons } : {}),
        }
    }

    const handleConnect = async (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        // Claimed before the first `await`, not after: two connect() calls in
        // one task would both suspend on the store read, both find the slot
        // free, and both open a proposal for the one origin.
        if (openProposals.has(ctx.origin)) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.InvalidRequest,
                    'A connect request is already pending for this origin',
                ),
            )
        }
        openProposals.add(ctx.origin)
        const release = (response: JsonRpcResponse): Promise<void> => {
            openProposals.delete(ctx.origin)
            return deliver(respond, response)
        }
        const adapter = chainAdapter()
        if (!adapter) return release(chainNotSupported(request.id))

        const params = isRecord(request.params) ? request.params : {}
        const existing = await getConnection(ctx.origin)
        // Before any network answer: the wrong-network errors name the wallet's
        // active network, so running them first let an unapproved page read it
        // off a gesture-free connect(). A reconnect still needs no gesture.
        if (!existing && !ctx.hasUserActivation) {
            return release(
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.Unauthorized,
                    'connect() must be called from a user gesture',
                ),
            )
        }
        const network = adapter.resolveReportedNetwork(
            deps.getNetwork(),
            deps.getCustomNetworkGenesisHash(),
        )
        if (!network) {
            return release(
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.NetworkNotSupported,
                    'The wallet is on a network this connection cannot use',
                ),
            )
        }
        if (typeof params.network === 'string' && params.network !== network) {
            return release(
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.NetworkNotSupported,
                    `The wallet is on ${network}, not ${params.network}`,
                ),
            )
        }
        if (existing) {
            await store().upsert({
                ...existing,
                lastActiveAt: now(),
            })
            return release(
                jsonRpcResult(request.id, {
                    accounts: accountsFor(existing),
                    network,
                }),
            )
        }

        const proposalId = generateOrderedUniqueId()
        const peer = buildPeer(ctx, params)
        const expiresAt = now() + proposalTtlMs
        let settled = false
        const timer = setTimeout(() => {
            if (settled) return
            settle()
            releaseSlot()
            void deliver(
                respond,
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.RequestTimedOut,
                    'The connection request expired',
                ),
            )
        }, proposalTtlMs)
        pendingTimers.add(timer)
        const settle = (): void => {
            settled = true
            clearTimeout(timer)
            pendingTimers.delete(timer)
        }
        const releaseSlot = (): void => {
            openProposals.delete(ctx.origin)
        }

        const proposal: ConnectionProposal = {
            kind: DAPP_KIND,
            proposalId,
            peer,
            requesterOrigin: ctx.origin,
            requested: { networks: [network], methods: [...DAPP_METHODS] },
            expiresAt,
            approve: async accounts => {
                if (settled)
                    throw new Error(
                        'The connection proposal has already been settled',
                    )
                settle()
                const connection: DappConnection = {
                    id: ctx.origin,
                    kind: DAPP_KIND,
                    name: peer.name,
                    peer,
                    accounts,
                    status: 'active',
                    createdAt: now(),
                    lastActiveAt: now(),
                }
                try {
                    await store().upsert(connection)
                } finally {
                    // Freed only once the record exists (or the attempt has
                    // failed): a second tab claiming the slot mid-upsert would
                    // open a second proposal for the one origin.
                    releaseSlot()
                }
                await deliver(
                    respond,
                    jsonRpcResult(request.id, {
                        accounts: accountsFor(connection),
                        network,
                    }),
                )
                return connection
            },
            reject: async reason => {
                if (settled) return
                settle()
                releaseSlot()
                await deliver(
                    respond,
                    jsonRpcError(
                        request.id,
                        JsonRpcErrorCode.UserRejected,
                        sanitizeRejectReason(reason),
                    ),
                )
            },
        }
        requireContext().onProposal(proposal)
    }

    const handleSign = async (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
        type: WalletOperationType,
    ): Promise<void> => {
        const adapter = chainAdapter()
        if (!adapter) return deliver(respond, chainNotSupported(request.id))
        const connection = await getConnection(ctx.origin)
        if (!connection) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.Unauthorized,
                    'Not connected: call connect() first',
                ),
            )
        }
        const params = isRecord(request.params) ? request.params : {}
        const parsed = adapter.parseSigningParams(type, params)
        if (!parsed.ok) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.InvalidParams,
                    parsed.message,
                ),
            )
        }

        const correlationId = generateOrderedUniqueId()
        let settled = false
        const timer = setTimeout(() => {
            if (settled) return
            settle()
            requireContext().onRequestExpired(connection.id, correlationId)
            void deliver(
                respond,
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.RequestTimedOut,
                    'The wallet did not answer in time',
                ),
            )
        }, requestTtlMs)
        pendingTimers.add(timer)
        const settle = (): void => {
            settled = true
            clearTimeout(timer)
            pendingTimers.delete(timer)
        }

        requireContext().onMessage({
            kind: 'request',
            connectionId: connection.id,
            correlationId,
            sourceType: 'injected',
            authorizedAccounts: connection.accounts,
            peer: connection.peer,
            verifiedOrigin: ctx.origin,
            rawOperation: { type, params: parsed.payload },
            // Delivery failure must propagate so the request stays answerable
            // (the page may be reachable again on retry); settle only on success.
            respond: async result => {
                await respond(jsonRpcResult(request.id, toWireResult(result)))
                settle()
            },
            reject: async error => {
                await respond(
                    toErrorResponse(
                        request.id,
                        error,
                        adapter.relayableErrorNames,
                    ),
                )
                settle()
            },
        })
        await store().upsert({
            ...connection,
            lastActiveAt: now(),
        })
    }

    const disconnect = async (id: ConnectionId): Promise<void> => {
        const connection = await getConnection(id)
        if (!connection) return
        await store().remove(id)
        await deps.transport
            .notify(id, {
                jsonrpc: '2.0',
                method: DAPP_NOTIFICATIONS.disconnect,
                params: {},
            })
            .catch(() => {})
        requireContext().onDisconnected(id)
    }

    const dispatch = async (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): Promise<void> => {
        if (!isDappMethod(request.method)) {
            return deliver(
                respond,
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.MethodNotFound,
                    `Unknown method '${request.method}'`,
                ),
            )
        }
        switch (request.method) {
            case 'connect': {
                return handleConnect(ctx, request, respond)
            }
            case 'requestTransactionSigning': {
                return handleSign(ctx, request, respond, 'sign-transactions')
            }
            case 'requestDataSigning': {
                return handleSign(ctx, request, respond, 'sign-data')
            }
            case 'getAddresses': {
                const connection = await getConnection(ctx.origin)
                return deliver(
                    respond,
                    connection
                        ? jsonRpcResult(request.id, accountsFor(connection))
                        : jsonRpcError(
                              request.id,
                              JsonRpcErrorCode.Unauthorized,
                              'Not connected: call connect() first',
                          ),
                )
            }
            case 'disconnect': {
                await disconnect(ctx.origin)
                return deliver(respond, jsonRpcResult(request.id, null))
            }
        }
    }

    const onRequest = (
        ctx: DappRequestContext,
        request: JsonRpcRequest,
        respond: DappRespond,
    ): void => {
        void dispatch(ctx, request, respond).catch((error: unknown) => {
            // A connect that threw between claiming the origin's slot and
            // handing over the proposal would otherwise hold it forever; a
            // connect that got as far as a live proposal cannot be here.
            if (request.method === 'connect') openProposals.delete(ctx.origin)
            logger.error('[dapp] request failed', {
                method: request.method,
                error,
            })
            void deliver(
                respond,
                jsonRpcError(
                    request.id,
                    JsonRpcErrorCode.InternalError,
                    'Internal error',
                ),
            )
        })
    }

    const restore = async (): Promise<DappConnection[]> =>
        (await store().list()).filter(isDappConnection)

    return {
        kind: DAPP_KIND,
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
        matchesNetwork: () => true,
        methodsFor: () => [...DAPP_METHODS],
        async notify(id, notice: WalletNotice) {
            const notification =
                notice.type === 'accounts-changed'
                    ? {
                          method: DAPP_NOTIFICATIONS.accountsChanged,
                          params: { accounts: notice.accounts },
                      }
                    : {
                          method: DAPP_NOTIFICATIONS.networkChanged,
                          params: { network: notice.network },
                      }
            await deps.transport.notify(id, { jsonrpc: '2.0', ...notification })
        },
    }
}
