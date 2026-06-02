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

export const NEGOTIATE_NAMESPACE = 'liquidauth'

/** Frozen forever. The negotiation envelope must be parseable by every peer. */
export const HANDSHAKE_VERSION = 1 as const

export type ProtocolId = 'arc0027' | 'walletconnect'

export const NEGOTIATION_ERROR_CODES = {
    NoCommonProtocolError: 5000,
    UnsupportedHandshakeVersionError: 5001,
    MalformedOfferError: 5002,
} as const

export type NegotiationErrorCode =
    (typeof NEGOTIATION_ERROR_CODES)[keyof typeof NEGOTIATION_ERROR_CODES]

/** Self-asserted dApp metadata carried in the offer. Untrusted on its own. */
export type PeerIdentity = {
    name?: string
    url?: string
    origin?: string
    icon?: string
    description?: string
}

/** A protocol the dApp can speak, with the versions it supports. */
export type ProtocolOffer = { id: ProtocolId; versions: string[] }

/** Parsed `liquidauth:negotiate:offer` frame. */
export type NegotiateOffer = {
    id: string
    handshakeVersion: number
    liquidAuthVersion?: string
    protocols: ProtocolOffer[]
    peer?: PeerIdentity
}

/** The single protocol+version the wallet selects. */
export type SelectedProtocol = { id: ProtocolId; version: string }

/** A protocol the wallet is willing to speak (preference order is the array order). */
export type WalletProtocol = { id: ProtocolId; versions: string[] }

/** A bound protocol dispatcher: takes a raw frame, returns a response or null. */
export type ProtocolRoute = (raw: string) => Promise<string | null>

/** Routing table the negotiator dispatches to once a protocol is locked. */
export type NegotiatorRoutes = {
    arc0027: ProtocolRoute
    walletconnect?: ProtocolRoute
}
