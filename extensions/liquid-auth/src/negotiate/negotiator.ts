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

import { classifyFrame } from './classifyFrame'
import { parseOffer, buildSelect, buildSelectError } from './frames'
import { NegotiationError } from './errors'
import { selectProtocol } from './selectProtocol'
import {
    HANDSHAKE_VERSION,
    NEGOTIATION_ERROR_CODES,
    type NegotiateOffer,
    type NegotiatorRoutes,
    type PeerIdentity,
    type ProtocolRoute,
    type WalletProtocol,
} from './types'

export type NegotiatorDeps = {
    /** Preference-ordered list of protocols the wallet will speak. */
    walletProtocols: WalletProtocol[]
    routes: NegotiatorRoutes
    send: (data: string) => void
    close: () => void
    /** Surfaces the negotiated dApp identity to the host (for the approval UI). */
    onIdentity?: (
        peer: PeerIdentity | undefined,
        serverAttestedOrigin?: string,
    ) => void
    /** The dApp origin vouched for by the signalling server, when available. */
    serverAttestedOrigin?: string
}

export type Negotiator = {
    handleMessage: (raw: string) => Promise<void>
    dispose: () => void
}

type State = 'negotiating' | 'arc0027' | 'walletconnect' | 'closed'

/**
 * Builds the inbound-message handler for a Liquid Auth data channel. Decides the
 * dialect from the first classifiable frame, then routes all later frames to the
 * selected protocol. There is no timer: an idle channel stays in `negotiating`
 * (Liquid Auth requires idle channels to survive); teardown is owned by the
 * caller's channel lifecycle, surfaced here via `dispose()`.
 */
export const createNegotiator = (deps: NegotiatorDeps): Negotiator => {
    let state: State = 'negotiating'

    const route = async (raw: string, fn: ProtocolRoute | undefined) => {
        if (!fn) return
        const response = await fn(raw)
        if (response) deps.send(response)
    }

    const closeWith = (frame: string) => {
        deps.send(frame)
        state = 'closed'
        deps.close()
    }

    const handleNegotiating = async (raw: string) => {
        const kind = classifyFrame(raw)
        if (kind === 'arc0027-request') {
            // Legacy dApp that speaks ARC-0027 directly (no negotiation). Lock
            // the dialect and surface the host-only identity immediately so the
            // confirm step doesn't wait out the identity timeout.
            state = 'arc0027'
            deps.onIdentity?.(undefined, deps.serverAttestedOrigin)
            await route(raw, deps.routes.arc0027)
            return
        }
        if (kind !== 'negotiate-offer') return // unknown / heartbeat — keep waiting

        let offer: NegotiateOffer
        try {
            offer = parseOffer(raw)
        } catch (error) {
            // Structurally a negotiate offer but invalid. If we recovered the
            // offer id, reply 5002 (MalformedOfferError) so the dApp gets a
            // clean error instead of a hung channel; otherwise close silently.
            if (error instanceof NegotiationError && error.offerId) {
                closeWith(
                    buildSelectError(
                        error.offerId,
                        error.code,
                        error.message,
                        error.data,
                    ),
                )
                return
            }
            state = 'closed'
            deps.close()
            return
        }

        if (offer.handshakeVersion !== HANDSHAKE_VERSION) {
            closeWith(
                buildSelectError(
                    offer.id,
                    NEGOTIATION_ERROR_CODES.UnsupportedHandshakeVersionError,
                    `Unsupported handshake version ${offer.handshakeVersion}`,
                    { supported: [HANDSHAKE_VERSION] },
                ),
            )
            return
        }

        const selected = selectProtocol(deps.walletProtocols, offer)
        if (!selected) {
            closeWith(
                buildSelectError(
                    offer.id,
                    NEGOTIATION_ERROR_CODES.NoCommonProtocolError,
                    'No mutually supported protocol',
                ),
            )
            return
        }

        deps.onIdentity?.(offer.peer, deps.serverAttestedOrigin)
        deps.send(buildSelect(offer.id, selected))
        state = selected.id
    }

    return {
        handleMessage: async (raw: string) => {
            switch (state) {
                case 'negotiating':
                    return handleNegotiating(raw)
                case 'arc0027':
                    return route(raw, deps.routes.arc0027)
                case 'walletconnect':
                    return route(raw, deps.routes.walletconnect)
                case 'closed':
                    return
            }
        },
        dispose: () => {
            state = 'closed'
        },
    }
}
