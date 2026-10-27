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

import {
    addressCodecs,
    type ChainId,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { logger, toError, type Nullable } from '@perawallet/wallet-core-shared'
import type { KeyValueStorageService } from '@perawallet/wallet-extension-platform'
import {
    connectionScope,
    createHandlerKit,
    pairingScope,
} from '@perawallet/wallet-core-connections/handlerKit'
import {
    walletNoticeChainId,
    type ConnectionHandler,
    type ConnectionProposal,
    type WalletNotice,
} from '@perawallet/wallet-core-connections'
import {
    dappRequestChainAdapters,
    dappRequestFailureOf,
    dappRequestWireCodeOf,
    type DappRequestFailure,
    type WalletConnectV2ChainSupport,
} from '@perawallet/wallet-core-connections/dappRequest'
import type {
    Connection,
    ConnectionId,
    ConnectionOrigin,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'
import {
    WalletConnectError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectPermissionError,
    WalletConnectRequestExpiredError,
} from '../shared/errors'
import { toPeer } from '../shared/peer'
import {
    walletConnectSupportFor,
    type WalletConnectSupport,
} from '../shared/chainSupport'
import { parseCaip10AccountIn, toCaip10Account } from './caip'
import {
    createWalletKitClient,
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
import { loadWalletConnectSdk, type WalletConnectSdk } from './sdk'
import { createWalletConnectV2Storage } from './storage'
import { toPeerVerification } from './verification'

/**
 * JSON-RPC's server-error code, which is what v1's connector sends for a
 * failed or rejected request — dApps are tuned to it on both protocols.
 */
const JSON_RPC_SERVER_ERROR = -32_000

/** JSON-RPC's internal error, for a public-data answer that failed in the wallet. */
const JSON_RPC_INTERNAL_ERROR = -32_603

/**
 * The two session events the CAIP-25 namespace conventions define, and the
 * only ones dApps ask for. Always declared, because a proposal REQUIRING an
 * event is refused outright by `buildApprovedNamespaces`; emitted only by a
 * chain whose support declares `sessionEvents`, through
 * {@link ConnectionHandler.notify}.
 */
const PERA_V2_EVENTS: readonly string[] = ['accountsChanged', 'chainChanged']

type ProposalNamespaces = Record<
    string,
    { chains?: string[]; methods?: string[]; events?: string[] }
>

/** The chain's own namespace, or a key that is itself one of its chain ids. */
const isChainNamespaceKey = (
    support: WalletConnectSupport,
    key: string,
): boolean =>
    key === support.namespace || key.startsWith(`${support.namespace}:`)

/**
 * The CAIP-2 chains a proposal's namespaces ask for, this chain only. A key
 * may itself be a chain id (`<namespace>:<reference>`), in which case the
 * entry carries no `chains` of its own.
 */
const requestedChains = (
    support: WalletConnectSupport,
    namespaces: ProposalNamespaces,
): string[] =>
    Object.entries(namespaces).flatMap(([key, value]) => {
        if (key === support.namespace) return value.chains ?? []
        return key.startsWith(`${support.namespace}:`) ? [key] : []
    })

const requestedFrom = (
    support: WalletConnectSupport,
    namespaces: ProposalNamespaces,
    field: 'methods' | 'events',
): string[] =>
    Object.entries(namespaces).flatMap(([key, value]) =>
        isChainNamespaceKey(support, key) ? (value[field] ?? []) : [],
    )

const requestedMethods = (
    support: WalletConnectSupport,
    namespaces: ProposalNamespaces,
): string[] => requestedFrom(support, namespaces, 'methods')

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
    chains: readonly WalletConnectV2Chain[],
    namespaces: ProposalNamespaces,
): Nullable<ProposalRefusal> => {
    if (
        !Object.keys(namespaces).every(key =>
            chains.some(({ support }) => isChainNamespaceKey(support, key)),
        )
    ) {
        return 'UNSUPPORTED_NAMESPACE_KEY'
    }
    if (
        !chains.every(({ support }) =>
            requestedChains(support, namespaces).every(
                chainId => support.networkForCaip2ChainId(chainId) !== null,
            ),
        )
    ) {
        return 'UNSUPPORTED_CHAINS'
    }
    if (
        !chains.every(({ support, v2 }) =>
            requestedMethods(support, namespaces).every(method =>
                v2.methods.includes(method),
            ),
        )
    ) {
        return 'UNSUPPORTED_METHODS'
    }
    return chains.every(({ support }) =>
        requestedFrom(support, namespaces, 'events').every(event =>
            PERA_V2_EVENTS.includes(event),
        ),
    )
        ? null
        : 'UNSUPPORTED_EVENTS'
}

export type CreateWalletConnectV2HandlerOptions = {
    /**
     * Each chain's selected network. Injected, as in v1: a store default would
     * drag a chain's runtime into every importer's module graph,
     * `apps/browser` included. A session may name several networks per chain,
     * but a request is served only on the selected one.
     */
    getNetworkId: (chainId: ChainId) => NetworkId
    /**
     * Whether a NEW session may include the chain; read on every proposal and
     * settle. Existing sessions and their requests never consult it.
     */
    isDappConnectEnabled: (chainId: ChainId) => boolean
    /**
     * Reown Cloud project id, from `config.reownProjectId`. Empty means v2 is
     * unavailable rather than broken — the relay has no anonymous mode.
     */
    projectId: string
    /** The MMKV store WalletKit persists its sessions and keychain into. */
    keyValueStorage: KeyValueStorageService
    /** Overridden by the spec so a fake WalletKit drives the handler. */
    createWalletKit?: WalletKitFactory
    /**
     * Moves the boot start off `initialize`: the client starts once this
     * resolves, and only for a wallet that already has v2 sessions; any other
     * loads the SDK on its first pairing, which never waits for this. Loading
     * the SDK costs seconds of JS time on a mid-range phone, so the app holds
     * it until the lock screen is gone. Without it, `initialize` starts the
     * client itself.
     */
    startWhen?: () => Promise<void>
}

const dedupe = (values: string[]): string[] => [...new Set(values)]

/**
 * The networks a proposal asks for on one chain. Network ids are chain-local,
 * so each chain's are resolved through its own adapter and never compared
 * across chains.
 */
const requestedNetworks = (
    support: WalletConnectSupport,
    proposal: WalletKitSessionProposal['params'],
): NetworkId[] =>
    dedupe([
        ...requestedChains(support, proposal.requiredNamespaces),
        ...requestedChains(support, proposal.optionalNamespaces),
    ]).flatMap(chainId => {
        const network = support.networkForCaip2ChainId(chainId)
        return network === null ? [] : [network]
    })

type SupportedNamespace = {
    chains: string[]
    methods: string[]
    events: string[]
    accounts: string[]
}

type WalletConnectV2Chain = {
    chainId: ChainId
    support: WalletConnectSupport
    v2: WalletConnectV2ChainSupport
}

const v2Chains = (): WalletConnectV2Chain[] =>
    dappRequestChainAdapters
        .list()
        .flatMap(({ chainId, walletConnect: support }) =>
            support.v2 ? [{ chainId, support, v2: support.v2 }] : [],
        )

const v2ChainFor = (chainId: ChainId): Nullable<WalletConnectV2Chain> => {
    if (!dappRequestChainAdapters.has(chainId)) return null
    const { walletConnect: support } = dappRequestChainAdapters.get(chainId)
    return support.v2 ? { chainId, support, v2: support.v2 } : null
}

const v2ChainForCaip2 = (caip2: string): Nullable<WalletConnectV2Chain> =>
    v2Chains().find(
        ({ support }) => support.networkForCaip2ChainId(caip2) !== null,
    ) ?? null

// No codec means no addresses: an address nobody can validate must not be
// offered to, or signed for, a chain.
const addressesOnChain = (
    chainId: ChainId,
    addresses: readonly string[],
): string[] => {
    if (!addressCodecs.has(chainId)) return []
    const codec = addressCodecs.get(chainId)
    return dedupe(
        addresses
            .filter(address => codec.isValid(address))
            .map(address => codec.normalize(address)),
    )
}

/**
 * One namespace per given chain that the proposal asks for and that has an
 * approved address on it, so a chain the dApp never named adds nothing to the
 * session and each namespace lists only its own chain's accounts.
 */
const supportedNamespacesFor = (
    chains: readonly WalletConnectV2Chain[],
    proposal: WalletKitSessionProposal['params'],
    addresses: readonly string[],
): Record<string, SupportedNamespace> =>
    Object.fromEntries(
        chains.flatMap(({ chainId, support, v2 }) => {
            const caip2Ids = requestedNetworks(support, proposal).flatMap(
                network => {
                    const caip2 = support.caip2ChainIdFor(network)
                    return caip2 === null ? [] : [caip2]
                },
            )
            const own = addressesOnChain(chainId, addresses)
            if (caip2Ids.length === 0 || own.length === 0) return []
            const namespace: SupportedNamespace = {
                chains: caip2Ids,
                methods: [...v2.methods],
                events: [...PERA_V2_EVENTS],
                accounts: caip2Ids.flatMap(caip2 =>
                    own.map(address => toCaip10Account(caip2, address)),
                ),
            }
            return [[support.namespace, namespace] as const]
        }),
    )

/**
 * WalletConnect v2 as one implementation of {@link ConnectionHandler}. Unlike
 * v1's socket per session, v2 is a single relay connection multiplexing every
 * session, so this handler owns one WalletKit client for all of them.
 */
export const createWalletConnectV2Handler = (
    options: CreateWalletConnectV2HandlerOptions,
): ConnectionHandler<WalletConnectV2Connection> => {
    const {
        getNetworkId,
        isDappConnectEnabled,
        projectId,
        keyValueStorage,
        createWalletKit = createWalletKitClient,
        startWhen,
    } = options

    const kit = createHandlerKit(WALLET_CONNECT_V2_KIND, {
        logTag: '[WC v2]',
        notInitializedError: () =>
            new WalletConnectError(
                'The WalletConnect v2 handler was used before initialize()',
            ),
    })
    // Pending origins are keyed by PAIRING topic: the origin is known at
    // `pair()` and only has a record to live on once a session settles under
    // a different topic.
    const {
        requireContext,
        store,
        reportError,
        recordActivity,
        pendingOrigins,
    } = kit
    let client: Nullable<WalletKitClient> = null
    // Loaded in `initialize`, before `client`; whatever reaches `client`
    // reaches this too.
    let sdk: Nullable<WalletConnectSdk> = null
    let starting: Nullable<Promise<WalletKitClient>> = null
    // The boot start is waiting on `startWhen` or still loading; until it
    // lands, the store is the only record of the sessions.
    let isBootStartPending = false
    // Bumped by teardown, so a start that lands afterwards drops its client.
    let generation = 0
    let unbinders: (() => void)[] = []
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

    const requireClient = (): WalletKitClient => {
        if (!client) {
            throw new WalletConnectError('WalletConnect v2 is unavailable')
        }
        return client
    }

    const requireSdk = (): WalletConnectSdk => {
        if (!sdk) {
            throw new WalletConnectError('WalletConnect v2 is unavailable')
        }
        return sdk
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
                reportError(error, pairingScope(event.params.pairingTopic))
            })
        })
        bind(walletKit, 'session_request', event => {
            void handleRequest(event).catch((error: unknown) => {
                reportError(error, connectionScope(event.topic))
            })
        })
        // The peer hung up: the record goes, whatever else is pending. No
        // context means teardown has run mid-emit, and throwing back into the
        // relay callback is worse than dropping a record the next `restore()`
        // reconciles anyway.
        bind(walletKit, 'session_delete', ({ topic }) => {
            kit.currentContext()?.onDisconnected(topic)
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
            kit.currentContext()?.onRequestExpired(topic, String(id))
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
        const expiredEvent = requireSdk().expirerExpiredEvent
        walletKit.core.expirer.on(expiredEvent, listener)
        unbinders.push(
            () => void walletKit.core.expirer.off(expiredEvent, listener),
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
        const current = kit.currentContext()
        if (!current) return
        const stored = await current.store.get(topic)
        if (!stored || !isWalletConnectV2Connection(stored)) return
        current.onDisconnected(topic)
    }

    const connectableChains = (): WalletConnectV2Chain[] =>
        v2Chains().filter(({ chainId }) => isDappConnectEnabled(chainId))

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
        // Typed `any` on the event; nothing here reads into it.
        const rawParams: unknown = event.params.request.params

        const chain = v2ChainForCaip2(event.params.chainId)
        if (!chain) {
            refuseRequest(
                topic,
                id,
                'UNSUPPORTED_CHAINS',
                new WalletConnectInvalidNetworkError(),
            )
            return
        }
        const { support, v2 } = chain

        const route = v2.handleRequest(method, rawParams)
        // Never shown to the user, and answered before the session lookup: it
        // says only what the dApp asked for was wrong.
        if (route.kind === 'refused') {
            answerWithError(topic, id, route.error)
            return
        }
        if (route.kind === 'unsupported') {
            refuseRequest(
                topic,
                id,
                'UNSUPPORTED_METHODS',
                new WalletConnectPermissionError(
                    `WalletConnect v2 does not serve ${method}`,
                ),
                { support, failure: 'unsupported-method' },
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

        // A session may be approved for several networks at once; only the
        // selected one's may sign, or a mainnet dApp could have a testnet
        // group signed while the wallet shows mainnet. A switch is judged by
        // its target instead: the dApp asks from whichever session chain it
        // believes it is on, and no dApp moves the wallet's selection.
        const networkId = getNetworkId(chain.chainId)
        const activeChainId = support.caip2ChainIdFor(networkId)
        const isOffSelectedNetwork =
            route.kind === 'switch-network'
                ? route.networkId !== networkId
                : activeChainId === null ||
                  event.params.chainId !== activeChainId
        if (isOffSelectedNetwork) {
            refuseRequest(
                topic,
                id,
                'UNSUPPORTED_CHAINS',
                new WalletConnectInvalidNetworkError(),
                { support, failure: 'unselected-chain' },
            )
            return
        }

        const authorizedAccounts = addressesOnChain(
            chain.chainId,
            record.accounts,
        )

        if (route.kind === 'public-data') {
            answerPublicData(
                topic,
                id,
                () => route.answer(authorizedAccounts, networkId),
                support,
            )
            return
        }

        // Without this the settings list, which sorts on `lastActiveAt`, stays
        // in approval order for the life of the session.
        recordActivity(topic)

        // A chain the session already holds was consented to at approval, so
        // only a switch that would add one asks the user.
        if (
            route.kind === 'switch-network' &&
            activeChainId !== null &&
            sessionChainsOf(topic, support).includes(activeChainId)
        ) {
            answerSwitch(topic, id, support)
            return
        }

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
            chainId: chain.chainId,
            connectionId: topic,
            correlationId: String(id),
            sourceType: 'walletconnect',
            authorizedAccounts,
            // The approval-time snapshot, not the live session metadata a
            // dApp can update; it is the anti-spoofing `sourceMetadata`. The
            // origin verdict is this request's own, never a stored one.
            peer: {
                ...record.peer,
                verification: toPeerVerification(event.verifyContext),
            },
            verifiedOrigin: record.origin?.requesterOrigin,
            rawOperation:
                route.kind === 'switch-network'
                    ? {
                          type: 'switch-network',
                          params: { networkId: route.networkId },
                      }
                    : { type: route.type, params: route.params },
            respond: async result => {
                if (
                    result.type === 'switch-network' &&
                    route.kind === 'switch-network'
                ) {
                    await applySwitch(record, chain, route.networkId)
                }
                await respond({
                    id,
                    jsonrpc: '2.0',
                    result: support.toWireResult(result),
                })
            },
            reject: async error => {
                const failure = dappRequestFailureOf(error)
                await respond({
                    id,
                    jsonrpc: '2.0',
                    error: {
                        code:
                            dappRequestWireCodeOf(error) ??
                            (failure && support.toWireErrorCode?.(failure)) ??
                            JSON_RPC_SERVER_ERROR,
                        message: error.message,
                    },
                })
            },
        })
    }

    // Fire and forget, like a refusal: the peer times out if it cannot be delivered.
    const answerWithError = (
        topic: string,
        id: number,
        error: { code: number; message: string },
    ): void => {
        if (!client) return
        void client
            .respondSessionRequest({
                topic,
                response: { id, jsonrpc: '2.0', error },
            })
            .catch((deliveryError: unknown) => {
                logger.warn('[WC v2] error delivery failed', {
                    connectionId: topic,
                    correlationId: String(id),
                    error: deliveryError,
                })
            })
    }

    /**
     * Adds `caip2` to the session's namespace for `chain`, for the addresses
     * the session already holds on it and never a new account. `updateSession`
     * is awaited but not its `acknowledged()`: a backgrounded dApp may never ack.
     */
    const includeChainInSession = async (
        record: WalletConnectV2Connection,
        chain: WalletConnectV2Chain,
        caip2: string,
    ): Promise<void> => {
        const walletKit = requireClient()
        const session = walletKit.getActiveSessions()[record.id] as
            | WalletKitSession
            | undefined
        const namespace = session?.namespaces[chain.support.namespace] as
            | WalletKitSession['namespaces'][string]
            | undefined
        if (!session || !namespace) {
            throw new WalletConnectInvalidSessionError('No session found')
        }
        if (namespace.chains?.includes(caip2)) return

        await walletKit.updateSession({
            topic: record.id,
            namespaces: {
                ...session.namespaces,
                [chain.support.namespace]: {
                    ...namespace,
                    chains: [...(namespace.chains ?? []), caip2],
                    accounts: dedupe([
                        ...namespace.accounts,
                        ...addressesOnChain(chain.chainId, record.accounts).map(
                            address => toCaip10Account(caip2, address),
                        ),
                    ]),
                },
            },
        })

        // Re-read: `recordActivity` may have written since the caller's copy.
        const stored = await store().get(record.id)
        const current =
            stored && isWalletConnectV2Connection(stored) ? stored : record
        await store().upsert({
            ...current,
            metadata: {
                ...current.metadata,
                chains: dedupe([...current.metadata.chains, caip2]),
            },
        })
    }

    const sessionChainsOf = (
        topic: string,
        support: WalletConnectSupport,
    ): string[] => {
        const session = client?.getActiveSessions()[topic] as
            | WalletKitSession
            | undefined
        return session?.namespaces[support.namespace]?.chains ?? []
    }

    // Fire and forget, like a refusal: the peer times out if it cannot be delivered.
    const answerSwitch = (
        topic: string,
        id: number,
        support: WalletConnectSupport,
    ): void => {
        if (!client) return
        void client
            .respondSessionRequest({
                topic,
                response: {
                    id,
                    jsonrpc: '2.0',
                    result: support.toWireResult({ type: 'switch-network' }),
                },
            })
            .catch((error: unknown) => {
                logger.warn('[WC v2] answering a switch request failed', {
                    connectionId: topic,
                    correlationId: String(id),
                    error,
                })
            })
    }

    /**
     * Runs once the user approves adding the chain. Throws if the selection
     * moved while the prompt was open, so the dApp is declined rather than
     * pointed at a network whose requests would be refused.
     */
    const applySwitch = async (
        record: WalletConnectV2Connection,
        chain: WalletConnectV2Chain,
        networkId: NetworkId,
    ): Promise<void> => {
        const caip2 = chain.support.caip2ChainIdFor(networkId)
        if (caip2 === null || getNetworkId(chain.chainId) !== networkId) {
            throw new WalletConnectInvalidNetworkError()
        }
        await includeChainInSession(record, chain, caip2)
    }

    // Never surfaced to the user: the dApp asks unprompted, and a refusal
    // only leaves what it asked about unknown. Only an absent answer refuses,
    // so a falsy result still reaches the dApp. Only a chain's own wire code
    // carries the error's message; anything else could name wallet internals.
    const answerPublicData = (
        topic: string,
        id: number,
        answer: () => Nullable<unknown> | Promise<Nullable<unknown>>,
        support: WalletConnectSupport,
    ): void => {
        if (!client || !sdk) return
        const activeClient = client
        void Promise.resolve()
            .then(answer)
            .then(
                (result): WalletKitJsonRpcResponse =>
                    result === null || result === undefined
                        ? refusalResponse(id, 'UNSUPPORTED_CHAINS', {
                              support,
                              failure: 'unselected-chain',
                          })
                        : { id, jsonrpc: '2.0', result },
                (error: unknown): WalletKitJsonRpcResponse => {
                    const wireCode = dappRequestWireCodeOf(toError(error))
                    return {
                        id,
                        jsonrpc: '2.0',
                        error:
                            wireCode === undefined
                                ? {
                                      code: JSON_RPC_INTERNAL_ERROR,
                                      message: 'Internal error',
                                  }
                                : {
                                      code: wireCode,
                                      message: toError(error).message,
                                  },
                    }
                },
            )
            .then(response =>
                activeClient.respondSessionRequest({ topic, response }),
            )
            .catch((deliveryError: unknown) => {
                logger.warn('[WC v2] public data delivery failed', {
                    connectionId: topic,
                    correlationId: String(id),
                    error: deliveryError,
                })
            })
    }

    /**
     * The SDK's refusal, unless the namespace maps `wire.failure` to a code of
     * its own: a namespace's dApps may read only the codes their standard names.
     */
    const refusalResponse = (
        id: number,
        key: 'UNSUPPORTED_METHODS' | 'UNSUPPORTED_CHAINS' | 'USER_DISCONNECTED',
        wire?: { support: WalletConnectSupport; failure: DappRequestFailure },
    ): WalletKitJsonRpcResponse => {
        const sdkError = requireSdk().getSdkError(key)
        const code = wire?.support.toWireErrorCode?.(wire.failure)
        return {
            id,
            jsonrpc: '2.0',
            error:
                code === undefined
                    ? sdkError
                    : { code, message: sdkError.message },
        }
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
        wire?: { support: WalletConnectSupport; failure: DappRequestFailure },
    ): void => {
        if (client && sdk) {
            void client
                .respondSessionRequest({
                    topic,
                    response: refusalResponse(id, key, wire),
                })
                .catch((deliveryError: unknown) => {
                    logger.warn('[WC v2] refusal delivery failed', {
                        connectionId: topic,
                        correlationId: String(id),
                        error: deliveryError,
                    })
                })
        }
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
            reportError(error, pairingScope(pairingId))
            throw error
        }
    }

    const settleProposal = async (
        input: {
            id: number
            proposal: WalletKitSessionProposal['params']
            accounts: string[]
        },
        pairingId: string,
    ): Promise<Connection> => {
        const walletKit = requireClient()
        // Re-read: the capability may have flipped since the sheet opened.
        const chains = connectableChains()
        if (chains.length === 0) {
            throw new WalletConnectError(
                'WalletConnect v2 has no connectable chain',
            )
        }

        // A required chain whose capability flipped off while the sheet was
        // open is no longer in `chains`, so it never reaches `uncovered` below.
        const refusal = screenRequiredNamespaces(
            chains,
            input.proposal.requiredNamespaces,
        )
        if (refusal) {
            throw new WalletConnectError(
                `The proposal is no longer supported: ${refusal}`,
            )
        }

        const supportedNamespaces = supportedNamespacesFor(
            chains,
            input.proposal,
            input.accounts,
        )
        // Typed and terminal: the library's own refusal is a plain Error the
        // sheet would report as a network failure, and with no account on the
        // chain a retry can never succeed.
        const uncovered = chains.find(
            ({ support }) =>
                !(support.namespace in supportedNamespaces) &&
                Object.keys(input.proposal.requiredNamespaces).some(key =>
                    isChainNamespaceKey(support, key),
                ),
        )
        if (uncovered) {
            throw new WalletConnectError(
                `No approved account on the required ${uncovered.support.namespace} chain`,
            )
        }

        const namespaces = requireSdk().buildApprovedNamespaces({
            proposal: input.proposal,
            supportedNamespaces,
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
            pendingOrigins.forget(pairingId)
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
        pendingOrigins.forget(pairingId)
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
        try {
            const sdkError = requireSdk().getSdkError(key)
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
            // Started if need be: a session ended only in the store would be
            // restored from the relay the moment the client starts.
            const walletKit = await ensureClient()
            await walletKit.disconnectSession({
                topic,
                reason: requireSdk().getSdkError('USER_DISCONNECTED'),
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

        const chains = connectableChains()
        if (chains.length === 0) {
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

        const refusal = screenRequiredNamespaces(
            chains,
            params.requiredNamespaces,
        )
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

        const offered = chains.flatMap(chain => {
            const chainNetworks = requestedNetworks(chain.support, params)
            return chainNetworks.length === 0
                ? []
                : [{ chain, networks: chainNetworks }]
        })
        const networks = offered.flatMap(({ networks: own }) => own)
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

        // Public-data methods are answered unprompted, not a permission to show.
        const methods = dedupe(
            offered.flatMap(({ chain }) =>
                [
                    ...requestedMethods(
                        chain.support,
                        params.requiredNamespaces,
                    ),
                    ...requestedMethods(
                        chain.support,
                        params.optionalNamespaces,
                    ),
                ].filter(method => chain.v2.signingMethods.includes(method)),
            ),
        )
        const peer: ConnectionPeer = {
            ...toPeer(params.proposer.metadata),
            verification: toPeerVerification(event.verifyContext),
        }

        // Before the proposal is tracked: a torn-down handler has nobody to
        // answer it, and a tracked one would then never be released.
        const { onProposal } = requireContext()
        pendingProposals.set(id, pairingId)
        const proposal: ConnectionProposal = {
            kind: WALLET_CONNECT_V2_KIND,
            proposalId: String(id),
            pairingId,
            peer,
            requested: {
                networks,
                chains: offered.map(({ chain }) => chain.chainId),
                methods,
            },
            // Seconds on the wire, milliseconds on the interface.
            expiresAt: params.expiryTimestamp * 1000,
            approve: accounts =>
                approveProposal({ id, proposal: params, accounts }),
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
        const namespaces = v2Chains().flatMap(({ support }) => {
            const namespace = session.namespaces[support.namespace]
            return namespace ? [{ support, namespace }] : []
        })
        if (namespaces.length === 0) {
            // Pera approves nothing outside its own namespaces, so this is a
            // session it cannot serve; omitted, which is what deletes it.
            logger.warn('[WC v2] session has no matching chain namespace', {
                connectionId: session.topic,
            })
            return null
        }

        const parsedByNamespace = namespaces.map(({ support, namespace }) => ({
            support,
            namespace,
            parsed: namespace.accounts.flatMap(account => {
                const caip10 = parseCaip10AccountIn(support, account)
                return caip10 === null ? [] : [caip10]
            }),
        }))
        const accounts = dedupe(
            parsedByNamespace.flatMap(({ parsed }) =>
                parsed.map(({ address }) => address),
            ),
        )
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
                // A namespace's `chains` is absent, or empty, when its key is
                // itself a chain id, in which case the accounts carry the only
                // copy. An empty list matches no network, so the record would
                // be invisible to `matchesChainScope`.
                chains: dedupe(
                    parsedByNamespace.flatMap(({ namespace, parsed }) =>
                        namespace.chains?.length
                            ? namespace.chains
                            : parsed.map(({ chainId }) => chainId),
                    ),
                ),
                methods: dedupe(
                    parsedByNamespace.flatMap(
                        ({ namespace }) => namespace.methods,
                    ),
                ),
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
        // Reporting no sessions here would read as "prune every v2 row".
        if (isBootStartPending) return [...(await storedById()).values()]
        const walletKit = client
        // No client means v2 is unavailable, so it claims no connections and
        // reconciliation prunes whatever v2 rows are left over.
        if (!walletKit) return []

        if (v2Chains().length === 0) {
            // Unlike "no client", this is a bootstrap ordering bug: the chain
            // must register before any handler's `restore()` runs. Returning
            // `[]` here would read to reconciliation as "prune every v2 row",
            // wiping every session over what is recoverable by registering
            // the chain and retrying.
            throw new WalletConnectError(
                'WalletConnect v2 restore ran before a chain adapter was registered',
            )
        }

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
        if (walletKit) await closeClient(walletKit)
    }

    const closeClient = async (walletKit: WalletKitClient): Promise<void> => {
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

    const startClient = (): Promise<WalletKitClient> => {
        if (client) return Promise.resolve(client)
        if (!starting) {
            const startedIn = generation
            starting = (async () => {
                sdk = await loadWalletConnectSdk()
                const walletKit = await createWalletKit({
                    projectId,
                    storage: createWalletConnectV2Storage(keyValueStorage),
                })
                if (startedIn !== generation) {
                    await closeClient(walletKit)
                    throw new WalletConnectError(
                        'WalletConnect v2 was torn down while starting',
                    )
                }
                client = walletKit
                bindEvents(walletKit)
                return walletKit
            })().finally(() => {
                starting = null
            })
        }
        return starting
    }

    // For a user action, which never waits on `startWhen`.
    const ensureClient = (): Promise<WalletKitClient> =>
        projectId.length === 0
            ? Promise.resolve(requireClient())
            : startClient()

    // What the registry's reconcile would have done at boot, had `restore()`
    // not answered from the store while the start was pending.
    const reconcileStored = async (): Promise<void> => {
        const live = await restore()
        const liveIds = new Set(live.map(connection => connection.id))
        for (const id of (await storedById()).keys()) {
            if (!liveIds.has(id)) await store().remove(id)
        }
        for (const connection of live) await store().upsert(connection)
    }

    const startAtBoot = async (startedIn: number): Promise<void> => {
        try {
            await startWhen?.()
            if (startedIn !== generation) return
            // A wallet with no v2 sessions loads the SDK on its first pairing.
            if ((await storedById()).size === 0) return
            await startClient()
        } finally {
            if (startedIn === generation) isBootStartPending = false
        }
        if (startedIn === generation && client) await reconcileStored()
    }

    /**
     * Pushes a session event, only for a chain declaring `sessionEvents`, only
     * on a session holding its namespace, and only an event that namespace
     * lists: `emitSessionEvent` rejects any other.
     */
    const notify = async (
        id: ConnectionId,
        notice: WalletNotice,
    ): Promise<void> => {
        const walletKit = client
        const current = kit.currentContext()
        const chain = v2ChainFor(walletNoticeChainId(notice))
        if (!walletKit || !current || !chain?.v2.sessionEvents) return
        const stored = await current.store.get(id)
        if (!stored || !isWalletConnectV2Connection(stored)) return
        const namespace = walletKit.getActiveSessions()[id]?.namespaces[
            chain.support.namespace
        ] as WalletKitSession['namespaces'][string] | undefined
        if (!namespace) return
        const events = namespace.events ?? []

        if (notice.type === 'network-changed') {
            const { networkId } = notice.scope
            const caip2 = chain.support.caip2ChainIdFor(networkId)
            const data = chain.v2.sessionEvents.chainChangedData(networkId)
            // A session lacking the new network was never granted it; the
            // dApp's own switch request is what asks the user to add it.
            if (
                caip2 === null ||
                data === null ||
                !events.includes('chainChanged') ||
                !namespace.chains?.includes(caip2)
            ) {
                return
            }
            await walletKit.emitSessionEvent({
                topic: id,
                event: { name: 'chainChanged', data },
                chainId: caip2,
            })
            return
        }

        if (!events.includes('accountsChanged')) return
        const held = addressesOnChain(chain.chainId, stored.accounts)
        const changed = addressesOnChain(chain.chainId, notice.changed)
        if (!held.some(address => changed.includes(address))) return
        const walletHolds = addressesOnChain(chain.chainId, notice.accounts)
        const active = chain.support.caip2ChainIdFor(
            getNetworkId(chain.chainId),
        )
        await walletKit.emitSessionEvent({
            topic: id,
            event: {
                name: 'accountsChanged',
                data: held.filter(address => walletHolds.includes(address)),
            },
            chainId:
                active !== null && namespace.chains?.includes(active)
                    ? active
                    : (namespace.chains?.[0] ?? ''),
        })
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
            const walletKit = await ensureClient()
            const { topic } = await walletKit.core.pairing.pair({ uri })
            abandonedPairings.delete(topic)
            // Cleared, not left: a re-pairing of the same topic from another
            // entry point would otherwise inherit the first one's origin.
            pendingOrigins.remember(topic, opts?.origin)
            return topic
        },

        abandonPairing: pairingId => {
            pendingOrigins.forget(pairingId)
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
            kit.attach(next)
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
            if (!startWhen) {
                await startClient()
                return
            }
            isBootStartPending = true
            const startedIn = generation
            void startAtBoot(startedIn).catch((error: unknown) => {
                logger.error('[WC v2] starting the client failed', { error })
            })
        },

        teardown: async () => {
            generation += 1
            isBootStartPending = false
            kit.detach()
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
        matchesChainScope: (connection, scope) => {
            if (!isWalletConnectV2Connection(connection)) return false
            const chainId =
                walletConnectSupportFor(scope)?.caip2ChainIdFor(
                    scope.networkId,
                ) ?? null
            return (
                chainId !== null && connection.metadata.chains.includes(chainId)
            )
        },

        notify,

        methodsFor: connection =>
            isWalletConnectV2Connection(connection)
                ? connection.metadata.methods
                : [],
    }
}
