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

import type WalletConnect from '@perawallet/walletconnect'
import {
    logger,
    Networks,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'
import type { ConnectionProposal } from '@perawallet/wallet-core-connections'
import {
    connectionScope,
    pairingScope,
    type HandlerKit,
} from '@perawallet/wallet-core-connections/handlerKit'
import {
    abandonPairing as abandonConnectorPairing,
    ensureConnectorReady,
    forgetConnector,
    teardownConnector,
} from '../connection'
import { isAlgorandPermission } from '../models'
import {
    ALL_PERMISSIONS,
    SESSION_REQUEST_TTL_MS,
    WC_DELIVERY_TIMEOUT_MS,
} from '../shared/constants'
import { isChainIdAcceptable } from '../shared/chain'
import { toPeer } from '../shared/peer'
import {
    WalletConnectError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSessionRequestExpiredError,
} from '../shared/errors'
import {
    WALLET_CONNECT_V1_KIND,
    buildWalletConnectV1Connection,
} from './connection'
import type { V1ConnectorEventHandler, V1RequestHandlers } from './requests'
import { scopeFor } from './scope'
import type { WalletConnectV1SessionKeyStore } from './secrets'
import { asSessionRequestParams, asWcRequest } from './wire'

// The 4160 wildcard expands to every network, and TestNet's id also covers `custom`.
const networksForChainId = (chainId: number): Network[] =>
    Object.values(Networks).filter(network =>
        isChainIdAcceptable(chainId, network),
    )

export type V1ProposalHandlers = {
    handleSessionRequest: V1ConnectorEventHandler
    /** Releases what a pairing holds before it has a session. */
    forgetPairing: (clientId: string) => void
    clear: () => void
}

export const createV1ProposalHandlers = (deps: {
    kit: HandlerKit
    getNetwork: () => Network
    sessionKeys: WalletConnectV1SessionKeyStore
    connectionFor: V1RequestHandlers['connectionFor']
}): V1ProposalHandlers => {
    const { kit, getNetwork, sessionKeys, connectionFor } = deps
    const { reportError, store, requireContext, pendingOrigins } = kit

    // The proposal id already handed out for each pairing. The bridge replays a
    // topic's pending history on every re-subscription, and a pairing the user
    // has not approved yet has no stored record for the guard below to match,
    // so the sweep recreating its connector would emit the same proposal twice:
    // a second sheet on native, and an "already pending" reject of the live
    // pairing on web. A new handshake carries a new id and still gets through.
    const openProposals = new Map<string, string>()

    const forgetPairing = (clientId: string): void => {
        pendingOrigins.forget(clientId)
        openProposals.delete(clientId)
    }

    const approveProposal = async (input: {
        clientId: string
        chainId: number
        peer: ConnectionPeer
        expiresAt: number
        handshakeId: number
        permissions: string[]
        accounts: string[]
    }): Promise<Connection> => {
        // The dApp's side expires long before ours; approving late can only fake-succeed.
        if (Date.now() > input.expiresAt) {
            forgetPairing(input.clientId)
            throw new WalletConnectSessionRequestExpiredError()
        }

        // Revive before persisting: a failed delivery must leave nothing that
        // claims a session the dApp never heard about.
        const connector = await ensureConnectorReady(
            input.clientId,
            WC_DELIVERY_TIMEOUT_MS,
        )

        // The key comes from the pairing URI, so it is committable before the
        // dApp is told yes. Ordered that way because `approveSession` flips the
        // connector to `connected`, which `abandonPairing` then refuses to tear
        // down: a keystore fault after it would leave a live socket with no
        // record and no way for the user to disconnect it.
        const secretRef = await sessionKeys.commit(
            input.clientId,
            connector.session.key,
        )

        connector.approveSession({
            chainId: input.chainId,
            accounts: input.accounts,
        })

        const existing = await store().get(input.clientId)
        // A re-approval without an origin must not erase the stored one.
        const origin = pendingOrigins.get(input.clientId) ?? existing?.origin
        const now = Date.now()
        const connection = buildWalletConnectV1Connection({
            clientId: input.clientId,
            peer: input.peer,
            accounts: input.accounts,
            secretRef,
            createdAt: existing?.createdAt ?? now,
            lastActiveAt: now,
            origin,
            metadata: {
                bridge: connector.bridge,
                handshakeTopic: connector.handshakeTopic,
                peerId: connector.peerId,
                chainId: input.chainId,
                handshakeId: input.handshakeId,
                permissions: input.permissions,
            },
        })
        await store().upsert(connection)
        forgetPairing(input.clientId)
        return connection
    }

    // `rejectSession` fires 'disconnect' synchronously (which forgets the
    // connector) yet leaves the transport open, so tear the captured connector
    // down by reference or a late `session_request` pops a ghost approval sheet.
    const abandonDeclinedPairing = (
        clientId: string,
        connector: Nullable<WalletConnect>,
    ): void => {
        forgetPairing(clientId)
        if (connector) {
            teardownConnector(connector)
            forgetConnector(clientId)
            return
        }
        abandonConnectorPairing(clientId)
    }

    const rejectProposal = async (
        clientId: string,
        reason?: string,
    ): Promise<void> => {
        let connector: Nullable<WalletConnect> = null
        try {
            connector = await ensureConnectorReady(
                clientId,
                WC_DELIVERY_TIMEOUT_MS,
            )
            connector.rejectSession(reason ? { message: reason } : undefined)
        } catch (error) {
            // Never trap a user who declined behind a dead socket; the dApp times out.
            logger.warn('[WC v1] session reject delivery failed', {
                clientId,
                error,
            })
            reportError(
                new WalletConnectError(
                    "Couldn't notify the dApp of the rejection. It may keep waiting until it times out.",
                    error instanceof Error ? error : undefined,
                ),
                pairingScope(clientId),
            )
        } finally {
            abandonDeclinedPairing(clientId, connector)
        }
    }

    const handleSessionRequest: V1ConnectorEventHandler = async (
        connector,
        error,
        payload,
    ) => {
        const clientId = connector.clientId
        if (error) {
            reportError(error, scopeFor(connector))
            return
        }

        const request = asWcRequest(payload)
        const stored = await connectionFor(clientId)

        // The library rewrites peerMeta/peerId before this fires, so a fresh
        // handshake on a live session is refused, never re-proposed on poisoned metadata.
        if (connector.connected && stored) {
            if (
                request &&
                stored.metadata.handshakeId !== undefined &&
                stored.metadata.handshakeId === request.id
            ) {
                // The bridge replays a topic's pending history on every
                // re-subscription. Compare against the id snapshotted at
                // approval: the library overwrites `connector.handshakeId` from this frame.
                logger.debug(
                    '[WC v1] ignoring a replay of the approved handshake',
                    {
                        clientId,
                        requestId: request.id,
                    },
                )
                return
            }
            reportError(
                new WalletConnectInvalidSessionError(
                    'Ignored a repeat connection request on an active session.',
                ),
                connectionScope(clientId),
            )
            return
        }

        const params = asSessionRequestParams(
            request && Array.isArray(request.params)
                ? request.params[0]
                : undefined,
        )
        if (!request || !params) {
            reportError(
                new WalletConnectInvalidSessionError(
                    'Dropped a malformed WalletConnect handshake',
                ),
                pairingScope(clientId),
            )
            return
        }

        const network = getNetwork()
        const { chainId } = params
        if (
            typeof chainId !== 'number' ||
            !isChainIdAcceptable(chainId, network)
        ) {
            // `rejectSession()` throws on an already-connected connector.
            if (!connector.connected) {
                connector.rejectSession()
                abandonDeclinedPairing(clientId, connector)
            }
            reportError(
                new WalletConnectInvalidNetworkError(),
                pairingScope(clientId),
            )
            return
        }

        const peer = toPeer(params.peerMeta)
        const expiresAt = Date.now() + SESSION_REQUEST_TTL_MS
        const methods = params.permissions
            ? params.permissions.filter(isAlgorandPermission)
            : [...ALL_PERMISSIONS]
        const proposalId = `${clientId}:${request.id}`
        if (openProposals.get(clientId) === proposalId) {
            logger.debug('[WC v1] ignoring a replayed pairing handshake', {
                clientId,
                requestId: request.id,
            })
            return
        }
        openProposals.set(clientId, proposalId)

        const proposal: ConnectionProposal = {
            kind: WALLET_CONNECT_V1_KIND,
            proposalId,
            pairingId: clientId,
            peer,
            requested: {
                networks: networksForChainId(chainId),
                methods,
            },
            expiresAt,
            approve: accounts =>
                approveProposal({
                    clientId,
                    chainId,
                    peer,
                    expiresAt,
                    handshakeId: request.id,
                    permissions: methods,
                    accounts,
                }),
            reject: reason => rejectProposal(clientId, reason),
        }

        requireContext().onProposal(proposal)
    }

    return {
        handleSessionRequest,
        forgetPairing,
        clear: () => {
            openProposals.clear()
        },
    }
}
