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
    NetworkId,
    SignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { AppError, logger, toError } from '@perawallet/wallet-core-shared'
import {
    CONNECTION_LATE_PAIRING_GRACE_MS,
    DappRequestFailedError,
    DappRequestRejectedError,
    matchesScope,
    waitForPairingOutcome,
    type ConnectionProposal,
    type ConnectionRegistry,
    type InboundMessage,
} from '@perawallet/wallet-core-connections'
import { WalletConnectInvalidNetworkError } from '@perawallet/wallet-core-walletconnect'
import {
    decodeSignedTransactions,
    decodeWalletOperationResult,
    encodeWalletOperation,
    isConnectionsControlMessage,
    type ConnectionApprovalRequest,
    type ConnectionsControlHandler,
    type ConnectionsControlMessage,
    type ConnectionsControlResponse,
    type ConnectionsEvent,
} from '@perawallet/wallet-core-browser-runtime'

export type ConnectionsHostDeps = {
    registry: ConnectionRegistry
    activeNetworkId: () => NetworkId
    /** The wallet's addresses on any of `chainIds`. */
    knownAddresses: (chainIds: readonly ChainId[]) => readonly string[]
    /**
     * Resolves on the router's ack (acceptance for a proposal/request, dismissal
     * for an error notice); rejects when no surface will ever answer.
     */
    requestApproval: (request: ConnectionApprovalRequest) => Promise<void>
    broadcastEvent: (event: ConnectionsEvent) => Promise<void>
    /**
     * Records and broadcasts signed transactions on their own scope's node;
     * resolves with their ids once the node accepts them.
     */
    submitSignedTransactions: (signed: SignedTransaction[]) => Promise<string[]>
}

export type ConnectionsHost = {
    /** Assignable to `ConnectionsControlHandler`; `null` for anything not a control message. */
    handleControlMessage: (
        message: unknown,
    ) => ReturnType<ConnectionsControlHandler>
}

type InboundRequest = Extract<InboundMessage, { kind: 'request' }>

const ok = (result?: unknown): ConnectionsControlResponse => ({
    ok: true,
    result,
})
const fail = (error: string): ConnectionsControlResponse => ({
    ok: false,
    error,
})

const describeError = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

const requestKey = (connectionId: string, correlationId: string): string =>
    `${connectionId}:${correlationId}`

// Unsettled pairings each hold a live bridge socket; a handful covers any real
// multi-tab use while keeping the worst case a rounding error.
const MAX_UNSETTLED_PAIRINGS = 5

// Owns the handlers and their sockets but has no UI or vault, so every decision
// goes out as an approval request and comes back over the control channel.
export const startConnectionsHost = (
    deps: ConnectionsHostDeps,
): ConnectionsHost => {
    const { registry } = deps
    const proposals = new Map<string, ConnectionProposal>()
    const requests = new Map<string, InboundRequest>()
    const requesterOrigins = new Map<string, string>()
    const unsettledPairings = new Set<string>()
    // A page can trigger `pair` at will; one open notice at a time stops a hostile
    // page from spamming wrong-network dialogs. Cleared when the notice is dismissed.
    let errorNoticeOpen = false

    const notifyNetworkMismatch = (pairingId: string): void => {
        if (errorNoticeOpen) return
        errorNoticeOpen = true
        void deps
            .requestApproval({
                kind: 'connection-error',
                reason: 'network-mismatch',
                pairingId,
                activeNetwork: deps.activeNetworkId(),
            })
            .catch((error: unknown) => {
                logger.error(
                    '[connections-host] network-mismatch notice failed',
                    {
                        pairingId,
                        error,
                    },
                )
            })
            .finally(() => {
                errorNoticeOpen = false
            })
    }

    registry.subscribeToProposals(proposal => {
        proposals.set(proposal.proposalId, proposal)
        const { approve: _approve, reject: _reject, ...summary } = proposal
        void deps.broadcastEvent({ kind: 'proposal', proposal: summary })
        void deps
            .requestApproval({
                kind: 'connection-proposal',
                proposalId: proposal.proposalId,
                pairingId: proposal.pairingId,
                connectionKind: proposal.kind,
                peer: proposal.peer,
                requested: proposal.requested,
                expiresAt: proposal.expiresAt,
                requesterOrigin:
                    proposal.requesterOrigin ??
                    (proposal.pairingId === undefined
                        ? undefined
                        : requesterOrigins.get(proposal.pairingId)),
            })
            .catch((error: unknown) => {
                proposals.delete(proposal.proposalId)
                logger.error(
                    '[connections-host] proposal approval request failed',
                    {
                        proposalId: proposal.proposalId,
                        error,
                    },
                )
                proposal
                    .reject('Approval surface unavailable')
                    .catch((rejectError: unknown) => {
                        logger.warn(
                            '[connections-host] proposal reject failed',
                            {
                                proposalId: proposal.proposalId,
                                error: rejectError,
                            },
                        )
                    })
            })
    })

    // The peer has had its answer (a timeout) or the connection is gone.
    // Nothing may approve it now, or the user would sign into a discarded result.
    const withdrawRequest = (
        connectionId: string,
        correlationId: string,
    ): void => {
        const key = requestKey(connectionId, correlationId)
        if (!requests.delete(key)) return
        void deps
            .requestApproval({
                kind: 'connection-request-withdrawn',
                connectionId,
                correlationId,
            })
            .catch((error: unknown) => {
                logger.error('[connections-host] request withdrawal failed', {
                    key,
                    error,
                })
            })
    }

    registry.subscribeToMessages(message => {
        if (message.kind === 'request-expired') {
            withdrawRequest(message.connectionId, message.correlationId)
            return
        }
        if (message.kind === 'connection-closed') {
            for (const request of [...requests.values()]) {
                if (request.connectionId === message.connectionId) {
                    withdrawRequest(request.connectionId, request.correlationId)
                }
            }
            return
        }
        if (message.kind !== 'request') return
        const key = requestKey(message.connectionId, message.correlationId)
        requests.set(key, message)
        void deps
            .requestApproval({
                kind: 'connection-request',
                connectionId: message.connectionId,
                correlationId: message.correlationId,
                chainId: message.chainId,
                operation: encodeWalletOperation(message.operation),
                authorizedAccounts: message.authorizedAccounts,
                peer: message.peer,
                sourceType: message.sourceType,
                verifiedOrigin: message.verifiedOrigin,
            })
            .catch((error: unknown) => {
                requests.delete(key)
                logger.error('[connections-host] request approval failed', {
                    key,
                    error,
                })
                message
                    .reject(new Error('Approval surface unavailable'))
                    .catch((rejectError: unknown) => {
                        logger.warn(
                            '[connections-host] request reject failed',
                            {
                                key,
                                error: rejectError,
                            },
                        )
                    })
            })
    })

    registry.subscribeToErrors((error, scope) => {
        void deps.broadcastEvent({
            kind: 'error',
            message: error.message,
            name: error.name,
            messageKey:
                error instanceof AppError
                    ? error.metadata.messageKey
                    : undefined,
            scope,
        })
        if (!scope) return
        // Whatever the failure, the peer has been answered; nothing will ever approve these.
        for (const [proposalId, proposal] of proposals) {
            if (matchesScope(proposal, scope)) proposals.delete(proposalId)
        }
        if (
            scope.pairingId !== undefined &&
            error instanceof WalletConnectInvalidNetworkError
        ) {
            notifyNetworkMismatch(scope.pairingId)
        }
    })

    const pair = async (
        message: Extract<ConnectionsControlMessage, { kind: 'pair' }>,
    ): Promise<ConnectionsControlResponse> => {
        const origin =
            message.requesterOrigin === undefined
                ? message.origin
                : {
                      ...message.origin,
                      requesterOrigin: message.requesterOrigin,
                  }
        const requesterOrigin = message.requesterOrigin
        const pageInitiated = requesterOrigin !== undefined
        const pairingId = await registry.pair(message.uri, { origin })

        // Each unsettled pairing holds a live connector and socket in this
        // document, and a page can mint them faster than any peer answers.
        // Insertion order makes the first entry the oldest.
        for (const staleId of unsettledPairings) {
            if (unsettledPairings.size < MAX_UNSETTLED_PAIRINGS) break
            unsettledPairings.delete(staleId)
            registry.abandonPairing(staleId)
        }
        unsettledPairings.add(pairingId)

        if (requesterOrigin !== undefined) {
            requesterOrigins.set(pairingId, requesterOrigin)
        }
        void waitForPairingOutcome(
            registry,
            pairingId,
            CONNECTION_LATE_PAIRING_GRACE_MS,
        ).then(outcome => {
            unsettledPairings.delete(pairingId)
            requesterOrigins.delete(pairingId)
            // A pairing nothing ever answered would otherwise keep its socket
            // open forever. Only page-initiated ones are torn down: they are
            // attacker-mintable, while a QR/manual pairing the user is still
            // waiting on keeps the pre-existing lenient behavior.
            if (pageInitiated && outcome.type === 'timeout') {
                registry.abandonPairing(pairingId)
            }
        })
        return ok({ pairingId })
    }

    const approveProposal = async (
        message: Extract<
            ConnectionsControlMessage,
            { kind: 'approve-proposal' }
        >,
    ): Promise<ConnectionsControlResponse> => {
        const proposal = proposals.get(message.proposalId)
        if (!proposal) return fail(`Unknown proposal ${message.proposalId}`)
        proposals.delete(message.proposalId)
        // The control channel admits any extension page, so the accounts are caller-chosen.
        const known = new Set(deps.knownAddresses(proposal.requested.chains))
        const accounts = message.accounts.filter(address => known.has(address))
        if (accounts.length === 0) {
            logger.error(
                '[connections-host] approve-proposal rejected: no approved account belongs to this wallet',
                { proposalId: message.proposalId },
            )
            await proposal.reject('No wallet account was approved')
            return fail('None of the approved accounts belong to this wallet')
        }
        const connection = await proposal.approve(accounts)
        return ok({ connection })
    }

    const rejectProposal = async (
        message: Extract<
            ConnectionsControlMessage,
            { kind: 'reject-proposal' }
        >,
    ): Promise<ConnectionsControlResponse> => {
        const proposal = proposals.get(message.proposalId)
        if (!proposal) return fail(`Unknown proposal ${message.proposalId}`)
        proposals.delete(message.proposalId)
        await proposal.reject(message.reason)
        return ok()
    }

    const respond = async (
        message: Extract<ConnectionsControlMessage, { kind: 'respond' }>,
    ): Promise<ConnectionsControlResponse> => {
        const key = requestKey(message.connectionId, message.correlationId)
        const request = requests.get(key)
        if (!request) return fail(`Unknown request ${key}`)
        // Dropped only once the peer has actually been answered. `answerOnce`
        // releases its guard on a failed delivery, so forgetting the request
        // first would leave nothing for a retry to address.
        if (message.outcome.ok) {
            await request.respond(
                decodeWalletOperationResult(message.outcome.result),
            )
        } else {
            await request.reject(
                message.outcome.isUserRejection
                    ? new DappRequestRejectedError()
                    : new DappRequestFailedError(
                          message.outcome.message,
                          message.outcome.failure,
                      ),
            )
        }
        requests.delete(key)
        return ok()
    }

    // The approval surface signed this send and may already be gone: from
    // here only the broadcast's own outcome answers the dApp.
    const submitSend = async (
        message: Extract<ConnectionsControlMessage, { kind: 'submit-send' }>,
    ): Promise<ConnectionsControlResponse> => {
        const key = requestKey(message.connectionId, message.correlationId)
        const request = requests.get(key)
        if (!request) return fail(`Unknown request ${key}`)
        if (request.operation.type !== 'send-transaction') {
            return fail(`Request ${key} is not a send`)
        }
        const signed = decodeSignedTransactions(message.signedTransactions)
        if (signed.some(({ scope }) => scope.chainId !== request.chainId)) {
            return fail(`Request ${key} is not for ${signed[0]?.scope.chainId}`)
        }
        // Claimed before the broadcast, so a late decline or withdrawal finds
        // nothing to answer.
        requests.delete(key)
        request.commit?.()
        let txId: string
        try {
            const [submitted] = await deps.submitSignedTransactions(signed)
            if (submitted === undefined) {
                throw new Error('The node returned no transaction id')
            }
            txId = submitted
        } catch (error) {
            const failure = toError(error)
            await request.reject(failure).catch((rejectError: unknown) => {
                logger.warn(
                    '[connections-host] send failure never reached the peer',
                    {
                        key,
                        error: rejectError,
                    },
                )
            })
            return ok({
                failure: {
                    name: failure.name,
                    message: failure.message,
                    ...(failure instanceof AppError &&
                        failure.metadata.messageKey && {
                            messageKey: failure.metadata.messageKey,
                        }),
                },
            })
        }
        await request
            .respond({ type: 'send-transaction', txId })
            .catch((error: unknown) => {
                logger.warn(
                    '[connections-host] send answer never reached the peer',
                    {
                        key,
                        error,
                    },
                )
            })
        return ok({ txIds: [txId] })
    }

    const dispatch = (
        message: ConnectionsControlMessage,
    ): Promise<ConnectionsControlResponse> | ConnectionsControlResponse => {
        switch (message.kind) {
            case 'pair': {
                return pair(message)
            }
            case 'abandon-pairing': {
                registry.abandonPairing(message.pairingId)
                return ok()
            }
            case 'disconnect': {
                return registry
                    .disconnect(message.connectionId)
                    .then(() => ok())
            }
            case 'disconnect-all': {
                return registry.disconnectAll().then(() => ok())
            }
            case 'reconnect-all': {
                registry.reconnect()
                return ok()
            }
            case 'approve-proposal': {
                return approveProposal(message)
            }
            case 'reject-proposal': {
                return rejectProposal(message)
            }
            case 'respond': {
                return respond(message)
            }
            case 'submit-send': {
                return submitSend(message)
            }
        }
    }

    const handleControlMessage: ConnectionsHost['handleControlMessage'] =
        message => {
            if (!isConnectionsControlMessage(message)) return null
            try {
                const outcome = dispatch(message)
                return outcome instanceof Promise
                    ? outcome.catch((error: unknown) => {
                          logger.warn(
                              '[connections-host] control message failed',
                              {
                                  kind: message.kind,
                                  error,
                              },
                          )
                          return fail(describeError(error))
                      })
                    : outcome
            } catch (error) {
                return fail(describeError(error))
            }
        }

    return { handleControlMessage }
}
