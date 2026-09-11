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

import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { KeyValueStorageService } from '@perawallet/wallet-extension-platform'
import type {
    ConnectionErrorScope,
    ConnectionHandler,
    ConnectionHandlerContext,
    ConnectionProposal,
    WalletOperationType,
} from '@perawallet/wallet-core-connections'
import type {
    Connection,
    ConnectionId,
    ConnectionOrigin,
    ConnectionPeer,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import { AlgorandPermission } from '../models'
import {
    WalletConnectError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectPermissionError,
    WalletConnectRequestExpiredError,
} from '../shared/errors'
import { toPeer } from '../shared/peer'
import { toWireResult } from '../shared/wire'
import {
    ALGORAND_CAIP2_NAMESPACE,
    getCaip2ChainId,
    getNetworkFromCaip2ChainId,
    parseAlgorandCaip10Account,
} from './caip'
import {
    createWalletKitClient,
    EXPIRER_EXPIRED_EVENT,
    type ExpirerExpiredEvent,
    type WalletKitClient,
    type WalletKitEvent,
    type WalletKitEventArguments,
    type WalletKitFactory,
    type WalletKitJsonRpcResponse,
    type WalletKitSession,
    type WalletKitSessionProposal,
    type WalletKitSessionRequest,
} from './client'
import {
    describeV2PairingUri,
    isV2PairingUri,
    isWalletConnectV2Connection,
    WALLET_CONNECT_V2_KIND,
    type WalletConnectV2Connection,
} from './connection'
import { createWalletConnectV2Storage } from './storage'

/**
 * The methods Pera answers over v2. ARC-0025 registers the `algorand`
 * namespace around `algo_signTxn`; `algo_signData` is the ARC-60 counterpart
 * v1 already serves. v1's third permission, `algo_getAccounts`, has no v2
 * equivalent — a v2 session discloses its accounts in the namespace itself.
 */
const OPERATION_TYPE_BY_METHOD: Readonly<Record<string, WalletOperationType>> =
    {
        [AlgorandPermission.TX_PERMISSION]: 'sign-transactions',
        [AlgorandPermission.DATA_PERMISSION]: 'sign-data',
    }

const PERA_V2_METHODS: readonly string[] = Object.keys(OPERATION_TYPE_BY_METHOD)

/**
 * JSON-RPC's server-error code, which is what v1's connector sends for a
 * failed or rejected request — dApps are tuned to it on both protocols.
 */
const JSON_RPC_SERVER_ERROR = -32_000

/**
 * Takes the JSON-RPC envelope off, and nothing else. ARC-0025 carries the
 * ARC-0001 group in the first positional slot (`params: [WalletTransaction[]]`)
 * exactly as v1 does; the registry's validator is what parses it, and a copy
 * of its schema here would strip the `msig` slots the resolver answers 4200
 * for. A non-array reaches the validator as it arrived, so the breadcrumb
 * describes what the dApp actually sent. `algo_signData` carries its payload
 * directly on both protocols.
 */
const toRawOperationParams = (
    type: WalletOperationType,
    params: unknown,
): unknown => {
    if (type !== 'sign-transactions' || !Array.isArray(params)) return params
    const positional: unknown[] = params
    return positional[0]
}

/**
 * The two session events the CAIP-25 namespace conventions define, and the
 * only ones dApps ask for. Declared, never emitted: a proposal REQUIRING an
 * event is refused outright by `buildApprovedNamespaces`, and refusing a real
 * dApp over a frame v1 never sends either is the worse trade. Emission would
 * live behind {@link ConnectionHandler.notify}.
 */
const PERA_V2_EVENTS: readonly string[] = ['accountsChanged', 'chainChanged']

type ProposalNamespaces = Record<
    string,
    { chains?: string[]; methods?: string[]; events?: string[] }
>

/** `algorand`, or a key that is itself an `algorand:<reference>` chain id. */
const isAlgorandNamespaceKey = (key: string): boolean =>
    key === ALGORAND_CAIP2_NAMESPACE ||
    key.startsWith(`${ALGORAND_CAIP2_NAMESPACE}:`)

/**
 * The CAIP-2 chains a proposal's namespaces ask for, `algorand` only. A key
 * may itself be a chain id (`algorand:<reference>`), in which case the entry
 * carries no `chains` of its own.
 */
const requestedChains = (namespaces: ProposalNamespaces): string[] =>
    Object.entries(namespaces).flatMap(([key, value]) => {
        if (key === ALGORAND_CAIP2_NAMESPACE) return value.chains ?? []
        return key.startsWith(`${ALGORAND_CAIP2_NAMESPACE}:`) ? [key] : []
    })

const requestedFrom = (
    namespaces: ProposalNamespaces,
    field: 'methods' | 'events',
): string[] =>
    Object.entries(namespaces).flatMap(([key, value]) =>
        isAlgorandNamespaceKey(key) ? (value[field] ?? []) : [],
    )

const requestedMethods = (namespaces: ProposalNamespaces): string[] =>
    requestedFrom(namespaces, 'methods')

/** The rejection a screened-out proposal earns, in the namespace's own terms. */
type ProposalRefusal =
    | 'UNSUPPORTED_NAMESPACE_KEY'
    | 'UNSUPPORTED_CHAINS'
    | 'UNSUPPORTED_METHODS'
    | 'UNSUPPORTED_EVENTS'

/**
 * What `buildApprovedNamespaces` would refuse, decided before the user sees
 * anything: it requires EVERY required chain, method, event and namespace key
 * to be covered, and failing it under Connect throws a raw library error that
 * no retry can fix while the dApp hangs to its own expiry. Only the REQUIRED
 * set matters — optional namespaces are filtered down silently.
 */
const screenRequiredNamespaces = (
    namespaces: ProposalNamespaces,
): Nullable<ProposalRefusal> => {
    if (!Object.keys(namespaces).every(isAlgorandNamespaceKey)) {
        return 'UNSUPPORTED_NAMESPACE_KEY'
    }
    if (
        !requestedChains(namespaces).every(
            chainId => getNetworkFromCaip2ChainId(chainId) !== null,
        )
    ) {
        return 'UNSUPPORTED_CHAINS'
    }
    if (
        !requestedMethods(namespaces).every(method =>
            PERA_V2_METHODS.includes(method),
        )
    ) {
        return 'UNSUPPORTED_METHODS'
    }
    return requestedFrom(namespaces, 'events').every(event =>
        PERA_V2_EVENTS.includes(event),
    )
        ? null
        : 'UNSUPPORTED_EVENTS'
}

export type CreateWalletConnectV2HandlerOptions = {
    /**
     * The injection point for anything chain-shaped, mirroring v1: a store
     * default would drag the blockchain package into every importer's module
     * graph, `apps/browser` included. A v2 session is approved for every chain
     * the dApp asked for that the wallet knows, so this is what decides which
     * of them may sign: a request naming any other chain is refused to the
     * peer.
     */
    getNetwork: () => Network
    /**
     * Reown Cloud project id, from `config.reownProjectId`. Empty means v2 is
     * unavailable rather than broken — the relay has no anonymous mode.
     */
    projectId: string
    /** The MMKV store WalletKit persists its sessions and keychain into. */
    keyValueStorage: KeyValueStorageService
    /** Overridden by the spec so a fake WalletKit drives the handler. */
    createWalletKit?: WalletKitFactory
}

const dedupe = (values: string[]): string[] => [...new Set(values)]

/**
 * WalletConnect v2 as one implementation of {@link ConnectionHandler}. Unlike
 * v1's socket per session, v2 is a single relay connection multiplexing every
 * session, so this handler owns one WalletKit client for all of them.
 */
export const createWalletConnectV2Handler = (
    options: CreateWalletConnectV2HandlerOptions,
): ConnectionHandler<WalletConnectV2Connection> => {
    const {
        getNetwork,
        projectId,
        keyValueStorage,
        createWalletKit = createWalletKitClient,
    } = options

    let context: Nullable<ConnectionHandlerContext> = null
    let client: Nullable<WalletKitClient> = null
    let unbinders: (() => void)[] = []
    // Keyed by PAIRING topic: the origin is known at `pair()` and only has a
    // record to live on once a session settles under a different topic.
    const pendingOrigins = new Map<string, ConnectionOrigin>()
    // Proposal id to pairing topic, and the once-only ledger: a proposal
    // missing from here has been approved, rejected or expired.
    const pendingProposals = new Map<number, string>()
    // Request id to session topic: `session_request_expire` carries only the
    // id, and the registry addresses requests by connection.
    const pendingRequests = new Map<number, string>()
    // Pairings the caller gave up on. Tombstoned rather than forgotten,
    // because a slow dApp can still deliver a proposal on one and a sheet
    // appearing from nowhere is worse than a map entry per abandon.
    const abandonedPairings = new Set<string>()

    const requireContext = (): ConnectionHandlerContext => {
        if (!context) {
            throw new WalletConnectError(
                'The WalletConnect v2 handler was used before initialize()',
            )
        }
        return context
    }

    const store = (): ConnectionStoreAPI => requireContext().store

    const reportError = (error: Error, scope?: ConnectionErrorScope): void => {
        logger.error(error, scope)
        context?.onError(error, scope)
    }

    const connectionScope = (id: ConnectionId): ConnectionErrorScope => ({
        connectionId: id,
    })

    const pairingScope = (pairingId: string): ConnectionErrorScope => ({
        pairingId,
    })

    const requireClient = (): WalletKitClient => {
        if (!client) {
            throw new WalletConnectError('WalletConnect v2 is unavailable')
        }
        return client
    }

    const bind = <E extends WalletKitEvent>(
        walletKit: WalletKitClient,
        event: E,
        listener: (args: WalletKitEventArguments[E]) => void,
    ): void => {
        walletKit.on(event, listener)
        unbinders.push(() => void walletKit.off(event, listener))
    }

    const bindEvents = (walletKit: WalletKitClient): void => {
        bind(walletKit, 'session_proposal', event => {
            void handleProposal(event).catch((error: unknown) => {
                reportError(
                    error instanceof Error ? error : new Error(String(error)),
                    pairingScope(event.params.pairingTopic),
                )
            })
        })
        bind(walletKit, 'session_request', event => {
            void handleRequest(event).catch((error: unknown) => {
                reportError(
                    error instanceof Error ? error : new Error(String(error)),
                    connectionScope(event.topic),
                )
            })
        })
        // The peer hung up: the record goes, whatever else is pending. No
        // context means teardown has run mid-emit, and throwing back into the
        // relay callback is worse than dropping a record the next `restore()`
        // reconciles anyway.
        bind(walletKit, 'session_delete', ({ topic }) => {
            context?.onDisconnected(topic)
        })
        // WalletKit has already dropped the proposal; releasing ours is what
        // stops a sheet from outliving the answer window it had.
        bind(walletKit, 'proposal_expire', ({ id }) => {
            const pairingId = pendingProposals.get(id)
            if (pairingId === undefined) return
            pendingProposals.delete(id)
            releasePairing(pairingId)
            reportError(
                new WalletConnectInvalidSessionError(
                    'The connection request expired before it was answered',
                ),
                pairingScope(pairingId),
            )
        })
        // WalletKit has dropped the request, so any answer now fails with
        // "No matching key": the sheet has to go, and the user hears why.
        bind(walletKit, 'session_request_expire', ({ id }) => {
            const topic = pendingRequests.get(id)
            if (topic === undefined) return
            pendingRequests.delete(id)
            context?.onRequestExpired(topic, String(id))
            reportError(
                new WalletConnectRequestExpiredError(),
                connectionScope(topic),
            )
        })
        // `session_authenticate` stays unbound on purpose. A dApp's
        // `authenticate()` sends a fallback `wc_sessionPropose` beside it, and
        // sign-client drops that fallback once the wallet has a listener for
        // the event, so binding one, even to reject, would refuse a pairing
        // that works today.
        bindExpirer(walletKit)
    }

    /**
     * WalletKit re-emits no `session_expire`, so core's expirer is the only
     * notice that a session died while the app was open. Without it the
     * settings list keeps showing a dApp that can no longer sign until the
     * next `restore()`.
     */
    const bindExpirer = (walletKit: WalletKitClient): void => {
        const listener = ({ target }: ExpirerExpiredEvent): void => {
            const topic = expiredTopic(target)
            if (topic === null) return
            void handleExpiry(topic).catch((error: unknown) => {
                logger.warn('[WC v2] handling a session expiry failed', {
                    connectionId: topic,
                    error,
                })
            })
        }
        walletKit.core.expirer.on(EXPIRER_EXPIRED_EVENT, listener)
        unbinders.push(
            () =>
                void walletKit.core.expirer.off(
                    EXPIRER_EXPIRED_EVENT,
                    listener,
                ),
        )
    }

    /**
     * The topic an expiry names, if it names one: pending requests and
     * proposals expire under `id:<value>` instead, and both are already
     * covered by WalletKit's own events.
     */
    const expiredTopic = (target: string): Nullable<string> => {
        const [kind, value] = target.split(':')
        return kind === 'topic' && value ? value : null
    }

    // Pairings expire through the same channel and have no record, which is
    // exactly what tells the two apart.
    const handleExpiry = async (topic: string): Promise<void> => {
        const current = context
        if (!current) return
        const stored = await current.store.get(topic)
        if (!stored || !isWalletConnectV2Connection(stored)) return
        current.onDisconnected(topic)
    }

    // Requests are user-paced, so this needs no debounce. Re-read first so a
    // disconnect that already landed is not undone; a remove that lands between
    // the read and the write can still be, and the next reconcile drops it.
    const recordActivity = (id: ConnectionId): void => {
        void (async () => {
            const current = await store().get(id)
            if (!current) return
            await store().upsert({ ...current, lastActiveAt: Date.now() })
        })().catch((error: unknown) => {
            logger.warn('[WC v2] failed to record connection activity', {
                connectionId: id,
                error,
            })
        })
    }

    /**
     * One inbound signing request. The payload stays raw: the registry's
     * validator is what turns it into a typed operation, and the record is
     * re-read per request rather than snapshotted, so a disconnect that
     * already landed cannot be signed against.
     */
    const handleRequest = async (
        event: WalletKitSessionRequest,
    ): Promise<void> => {
        const { id, topic } = event
        const { method } = event.params.request

        const type = OPERATION_TYPE_BY_METHOD[method]
        if (!type) {
            refuseRequest(
                topic,
                id,
                'UNSUPPORTED_METHODS',
                new WalletConnectPermissionError(
                    `WalletConnect v2 does not serve ${method}`,
                ),
            )
            return
        }

        const stored = await store().get(topic)
        const record =
            stored && isWalletConnectV2Connection(stored) ? stored : null
        if (!record) {
            refuseRequest(
                topic,
                id,
                'USER_DISCONNECTED',
                new WalletConnectInvalidSessionError('No session found'),
            )
            return
        }

        // A session may be approved for several chains at once; only the
        // active network's may sign, or a mainnet dApp could have a testnet
        // group signed while the wallet shows mainnet.
        const activeChainId = getCaip2ChainId(getNetwork())
        if (activeChainId === null || event.params.chainId !== activeChainId) {
            refuseRequest(
                topic,
                id,
                'UNSUPPORTED_CHAINS',
                new WalletConnectInvalidNetworkError(),
            )
            return
        }

        // Without this the settings list, which sorts on `lastActiveAt`, stays
        // in approval order for the life of the session.
        recordActivity(topic)

        // Typed `any` on the event; nothing here reads into it.
        const rawParams: unknown = event.params.request.params

        const respond = async (
            response: WalletKitJsonRpcResponse,
        ): Promise<void> => {
            // Deliberately unguarded: the rejection IS how the signing
            // pipeline learns the answer never landed, and the registry's
            // once-only guard releases on it so a retry can still answer.
            await requireClient().respondSessionRequest({ topic, response })
            pendingRequests.delete(id)
        }

        pendingRequests.set(id, topic)
        requireContext().onMessage({
            kind: 'request',
            connectionId: topic,
            correlationId: String(id),
            sourceType: 'walletconnect',
            authorizedAccounts: record.accounts,
            // The approval-time snapshot, not the live session metadata a
            // dApp can update; it is the anti-spoofing `sourceMetadata`.
            peer: record.peer,
            rawOperation: {
                type,
                params: toRawOperationParams(type, rawParams),
            },
            respond: async result =>
                await respond({
                    id,
                    jsonrpc: '2.0',
                    result: toWireResult(result),
                }),
            reject: async error =>
                await respond({
                    id,
                    jsonrpc: '2.0',
                    error: {
                        code: JSON_RPC_SERVER_ERROR,
                        message: error.message,
                    },
                }),
        })
    }

    /**
     * Refuses a request in the namespace's own terms. Fire and forget: the
     * peer times out if the refusal cannot be delivered, and nothing upstream
     * is waiting on it.
     */
    const refuseRequest = (
        topic: string,
        id: number,
        key: 'UNSUPPORTED_METHODS' | 'UNSUPPORTED_CHAINS' | 'USER_DISCONNECTED',
        error: Error,
    ): void => {
        void client
            ?.respondSessionRequest({
                topic,
                response: { id, jsonrpc: '2.0', error: getSdkError(key) },
            })
            .catch((deliveryError: unknown) => {
                logger.warn('[WC v2] refusal delivery failed', {
                    connectionId: topic,
                    correlationId: String(id),
                    error: deliveryError,
                })
            })
        reportError(error, connectionScope(topic))
    }

    /**
     * Claims a proposal, or throws if something already answered it. The claim
     * happens BEFORE the transport work so a double-tap cannot approve twice;
     * a failed approval hands it back, since the user must be able to retry
     * Connect.
     */
    const claimProposal = (id: number): string => {
        const pairingId = pendingProposals.get(id)
        if (pairingId === undefined) {
            throw new WalletConnectInvalidSessionError(
                'This connection request has already been answered',
            )
        }
        pendingProposals.delete(id)
        return pairingId
    }

    const approveProposal = async (input: {
        id: number
        proposal: WalletKitSessionProposal['params']
        networks: Network[]
        accounts: string[]
    }): Promise<Connection> => {
        if (input.accounts.length === 0) {
            // Before the claim: the library would refuse this too, and it is
            // the caller's bug, not the user's answer.
            throw new WalletConnectError(
                'Approving a WalletConnect session needs at least one account',
            )
        }
        const pairingId = claimProposal(input.id)
        try {
            return await settleProposal(input, pairingId)
        } catch (error) {
            // Everything from here to the record write can throw — the
            // namespace build, the relay, a session naming no usable account.
            // The proposal goes back so a second Connect works.
            pendingProposals.set(input.id, pairingId)
            reportError(
                error instanceof Error ? error : new Error(String(error)),
                pairingScope(pairingId),
            )
            throw error
        }
    }

    const settleProposal = async (
        input: {
            id: number
            proposal: WalletKitSessionProposal['params']
            networks: Network[]
            accounts: string[]
        },
        pairingId: string,
    ): Promise<Connection> => {
        const walletKit = requireClient()

        const chains = input.networks.flatMap(network => {
            const chainId = getCaip2ChainId(network)
            return chainId === null ? [] : [chainId]
        })
        const namespaces = buildApprovedNamespaces({
            proposal: input.proposal,
            supportedNamespaces: {
                [ALGORAND_CAIP2_NAMESPACE]: {
                    chains,
                    methods: [...PERA_V2_METHODS],
                    events: [...PERA_V2_EVENTS],
                    accounts: chains.flatMap(chainId =>
                        input.accounts.map(address => `${chainId}:${address}`),
                    ),
                },
            },
        })

        const session = await walletKit.approveSession({
            id: input.id,
            namespaces,
        })

        try {
            const existing = await store().get(session.topic)
            const record = toConnection(
                session,
                existing && isWalletConnectV2Connection(existing)
                    ? existing
                    : null,
                pendingOrigins.get(pairingId),
            )
            if (!record) {
                throw new WalletConnectInvalidSessionError(
                    'The approved session names no account this wallet can sign for',
                )
            }
            const approved: WalletConnectV2Connection = {
                ...record,
                lastActiveAt: Date.now(),
            }
            await store().upsert(approved)
            pendingOrigins.delete(pairingId)
            return approved
        } catch (error) {
            // The session settled, so the dApp believes it is connected: left
            // alive it would be a session with no record — invisible in
            // settings and unanswerable when it sends a request.
            await endSession(session.topic)
            throw error
        }
    }

    const rejectProposal = async (
        id: number,
        reason?: string,
    ): Promise<void> => {
        const pairingId = claimProposal(id)
        await deliverRejection(id, 'USER_REJECTED', reason, pairingId)
        releasePairing(pairingId)
    }

    /**
     * Everything a pairing that can no longer produce a session holds: the
     * origin it carried in, and the pairing itself — left live, it lets a
     * persistent dApp re-propose and pop a sheet from nowhere, and a second
     * proposal on it would approve with no origin.
     */
    const releasePairing = (pairingId: string): void => {
        pendingOrigins.delete(pairingId)
        expirePairing(pairingId)
    }

    // Fire and forget: a relay that will not take the delete must not turn a
    // delivered rejection into a failure the user sees.
    const expirePairing = (pairingId: string): void => {
        void client?.core.pairing
            .disconnect({ topic: pairingId })
            .catch((error: unknown) => {
                logger.warn('[WC v2] expiring a pairing failed', {
                    pairingId,
                    error,
                })
            })
    }

    const deliverRejection = async (
        id: number,
        key: 'USER_REJECTED' | ProposalRefusal,
        reason: string | undefined,
        pairingId: string,
    ): Promise<void> => {
        const sdkError = getSdkError(key)
        try {
            await requireClient().rejectSession({
                id,
                reason: reason ? { ...sdkError, message: reason } : sdkError,
            })
        } catch (error) {
            // Never trap a user who declined behind a dead relay; the dApp
            // times out instead.
            reportError(
                new WalletConnectError(
                    "Couldn't notify the dApp of the rejection. It may keep waiting until it times out.",
                    error instanceof Error ? error : undefined,
                ),
                pairingScope(pairingId),
            )
        }
    }

    /**
     * Ends a settled session with the peer. Never throws: every caller has
     * already decided the session is over, and a dead relay must not undo
     * that.
     */
    const endSession = async (topic: string): Promise<void> => {
        try {
            await requireClient().disconnectSession({
                topic,
                reason: getSdkError('USER_DISCONNECTED'),
            })
        } catch (error) {
            logger.warn('[WC v2] disconnecting a session failed', {
                connectionId: topic,
                error,
            })
        }
    }

    const handleProposal = async (
        event: WalletKitSessionProposal,
    ): Promise<void> => {
        const { id, params } = event
        const pairingId = params.pairingTopic

        if (abandonedPairings.has(pairingId)) {
            logger.debug('[WC v2] dropped a proposal on an abandoned pairing', {
                pairingId,
            })
            return
        }

        const refusal = screenRequiredNamespaces(params.requiredNamespaces)
        if (refusal) {
            await deliverRejection(id, refusal, undefined, pairingId)
            releasePairing(pairingId)
            reportError(
                refusal === 'UNSUPPORTED_CHAINS'
                    ? new WalletConnectInvalidNetworkError()
                    : new WalletConnectPermissionError(
                          'This dApp requires a WalletConnect capability Pera does not support.',
                      ),
                pairingScope(pairingId),
            )
            return
        }

        const chains = dedupe([
            ...requestedChains(params.requiredNamespaces),
            ...requestedChains(params.optionalNamespaces),
        ])
        const networks = chains.flatMap(chainId => {
            const network = getNetworkFromCaip2ChainId(chainId)
            return network === null ? [] : [network]
        })
        if (networks.length === 0) {
            // Surfacing it would offer the user a session that cannot be
            // built: every chain the dApp named is one Pera has no network for.
            await deliverRejection(
                id,
                'UNSUPPORTED_CHAINS',
                undefined,
                pairingId,
            )
            releasePairing(pairingId)
            reportError(
                new WalletConnectInvalidNetworkError(),
                pairingScope(pairingId),
            )
            return
        }

        const methods = dedupe([
            ...requestedMethods(params.requiredNamespaces),
            ...requestedMethods(params.optionalNamespaces),
        ]).filter(method => PERA_V2_METHODS.includes(method))
        const peer: ConnectionPeer = toPeer(params.proposer.metadata)

        // Before the proposal is tracked: a torn-down handler has nobody to
        // answer it, and a tracked one would then never be released.
        const { onProposal } = requireContext()
        pendingProposals.set(id, pairingId)
        const proposal: ConnectionProposal = {
            kind: WALLET_CONNECT_V2_KIND,
            proposalId: String(id),
            pairingId,
            peer,
            requested: { networks, methods },
            // Seconds on the wire, milliseconds on the interface.
            expiresAt: params.expiryTimestamp * 1000,
            approve: accounts =>
                approveProposal({ id, proposal: params, networks, accounts }),
            reject: reason => rejectProposal(id, reason),
        }
        onProposal(proposal)
    }

    /**
     * A complete record or nothing: the guard requires all four metadata
     * fields, so a partial upsert makes the row vanish from every read and
     * reconciliation then drops it.
     */
    const toConnection = (
        session: WalletKitSession,
        existing: Nullable<WalletConnectV2Connection>,
        /** From `pair()`; a re-approval without one keeps the stored origin. */
        origin?: ConnectionOrigin,
    ): Nullable<WalletConnectV2Connection> => {
        const namespace = session.namespaces[ALGORAND_CAIP2_NAMESPACE]
        if (!namespace) {
            // Pera approves nothing outside the `algorand` namespace, so this
            // is a session it cannot serve; omitted, which is what deletes it.
            logger.warn('[WC v2] session has no algorand namespace', {
                connectionId: session.topic,
            })
            return null
        }

        const parsed = namespace.accounts.flatMap(account => {
            const caip10 = parseAlgorandCaip10Account(account)
            return caip10 === null ? [] : [caip10]
        })
        const accounts = dedupe(parsed.map(({ address }) => address))
        if (accounts.length === 0) {
            // A session authorised for no address can sign nothing, and would
            // show in settings as a dApp connected to no account.
            logger.warn('[WC v2] session has no usable approved accounts', {
                connectionId: session.topic,
            })
            return null
        }

        const peer = toPeer(session.peer.metadata)
        const now = Date.now()
        const resolvedOrigin = origin ?? existing?.origin

        return {
            id: session.topic,
            kind: WALLET_CONNECT_V2_KIND,
            name: existing?.name ?? peer.name,
            peer,
            accounts,
            status: 'active',
            // Milliseconds, unlike the session's `expiry`. Carried from the
            // stored record so the settings list does not reorder every boot.
            createdAt: existing?.createdAt ?? now,
            lastActiveAt: existing?.lastActiveAt ?? now,
            metadata: {
                topic: session.topic,
                // `chains` is absent — or empty, which `??` would keep — when
                // the namespace key is itself a chain id, in which case the
                // accounts carry the only copy. An empty list here matches no
                // network, so the record is invisible to `networksFor`.
                chains: namespace.chains?.length
                    ? namespace.chains
                    : dedupe(parsed.map(({ chainId }) => chainId)),
                methods: namespace.methods,
                // Seconds, as WalletKit reports it.
                expiry: session.expiry,
            },
            ...(resolvedOrigin ? { origin: resolvedOrigin } : {}),
        }
    }

    const storedById = async (): Promise<
        Map<ConnectionId, WalletConnectV2Connection>
    > => {
        const records = await store().list()
        return new Map(
            records
                .filter(isWalletConnectV2Connection)
                .map(record => [record.id, record]),
        )
    }

    /**
     * WalletKit's active sessions ARE the answer: it expires sessions while the
     * app is closed, so one missing from `getActiveSessions()` must disappear
     * from the store, and omitting it here is exactly how that happens. A
     * restore that merged with stored records would keep dead dApps in
     * settings forever.
     */
    const restore = async (): Promise<WalletConnectV2Connection[]> => {
        const walletKit = client
        // No client means v2 is unavailable, so it claims no connections and
        // reconciliation prunes whatever v2 rows are left over.
        if (!walletKit) return []

        const existing = await storedById()
        const restored: WalletConnectV2Connection[] = []
        for (const session of Object.values(walletKit.getActiveSessions())) {
            const record = toConnection(
                session,
                existing.get(session.topic) ?? null,
            )
            if (record) restored.push(record)
        }
        return restored
    }

    /**
     * Unbinds and closes the current client, leaving `context` alone. The relay
     * close is awaited because two clients on one relay double every inbound
     * frame, and both `teardown` and a repeat `initialize` have to be sure the
     * old socket is gone before the next one opens.
     */
    const releaseClient = async (): Promise<void> => {
        for (const unbind of unbinders) unbind()
        unbinders = []
        const walletKit = client
        client = null
        if (!walletKit) return
        try {
            await walletKit.core.relayer.transportClose()
        } catch (error) {
            // A socket that will not close cleanly is still gone once the
            // client is dropped; a rejection here must not fail teardown.
            logger.warn('[WC v2] relay transport close failed', { error })
        }
        // Closing the transport leaves the heartbeat pulsing, and the expirer
        // it drives persists into the same namespace the next client owns.
        walletKit.core.heartbeat.stop()
    }

    // The record goes whatever the relay says: a dApp the user removed must
    // not reappear in settings because the peer was unreachable.
    const disconnect = async (id: ConnectionId): Promise<void> => {
        await endSession(id)
        await store().remove(id)
    }

    return {
        kind: WALLET_CONNECT_V2_KIND,

        canHandleUri: isV2PairingUri,

        describeUri: describeV2PairingUri,

        pair: async (uri, opts) => {
            if (!isV2PairingUri(uri)) {
                // No URI in the payload, redacted or not: `symKey=` survives
                // any redaction that keeps the value recognisable.
                logger.warn('[WC v2] refused a URI this handler cannot pair')
                throw new WalletConnectError(
                    'Not a WalletConnect v2 pairing URI',
                )
            }
            // The topic comes from the pairing WalletKit built, not from the
            // URI: they agree, but only one of them is what the relay
            // subscribed to.
            const { topic } = await requireClient().core.pairing.pair({ uri })
            abandonedPairings.delete(topic)
            // Cleared, not left: a re-pairing of the same topic from another
            // entry point would otherwise inherit the first one's origin.
            if (opts?.origin) pendingOrigins.set(topic, opts.origin)
            else pendingOrigins.delete(topic)
            return topic
        },

        abandonPairing: pairingId => {
            pendingOrigins.delete(pairingId)
            // Tombstoned before the delete: the caller has moved on, and a
            // relay that will not take it still leaves the tombstone.
            abandonedPairings.add(pairingId)
            expirePairing(pairingId)
        },

        initialize: async next => {
            // The registry serialises initialize behind teardown, so a second
            // one without a teardown between is a caller bug — but leaving the
            // old client alive would double every inbound frame silently.
            if (client) {
                logger.warn('[WC v2] initialize replaced a live client')
                await releaseClient()
            }
            context = next
            if (projectId.length === 0) {
                // Logged, not thrown or reported: v2 being unconfigured is a
                // build fact, not a failure of this boot, and every other
                // handler must still come up. The user hears about it from
                // `pair()` when they scan a v2 URI, not as a toast on every
                // launch. `restore()` then reports no connections, so stale
                // v2 rows are pruned.
                logger.warn(
                    '[WC v2] unavailable: no Reown project id is configured',
                )
                return
            }
            const walletKit = await createWalletKit({
                projectId,
                storage: createWalletConnectV2Storage(keyValueStorage),
            })
            client = walletKit
            bindEvents(walletKit)
        },

        teardown: async () => {
            context = null
            pendingOrigins.clear()
            pendingProposals.clear()
            pendingRequests.clear()
            abandonedPairings.clear()
            await releaseClient()
        },

        disconnect,

        disconnectAll: async () => {
            const own = (await store().list()).filter(
                isWalletConnectV2Connection,
            )
            // allSettled: one unreachable peer must not abort the sweep.
            await Promise.allSettled(own.map(({ id }) => disconnect(id)))
        },

        restore,

        // Narrowed first: a malformed own-kind record must not throw here.
        matchesNetwork: (connection, network) => {
            if (!isWalletConnectV2Connection(connection)) return false
            const chainId = getCaip2ChainId(network)
            return (
                chainId !== null && connection.metadata.chains.includes(chainId)
            )
        },

        methodsFor: connection =>
            isWalletConnectV2Connection(connection)
                ? connection.metadata.methods
                : [],
    }
}
