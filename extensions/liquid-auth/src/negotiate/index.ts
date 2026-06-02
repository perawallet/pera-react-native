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

export {
    HANDSHAKE_VERSION,
    NEGOTIATE_NAMESPACE,
    NEGOTIATION_ERROR_CODES,
    type ProtocolId,
    type NegotiationErrorCode,
    type PeerIdentity,
    type ProtocolOffer,
    type NegotiateOffer,
    type SelectedProtocol,
    type WalletProtocol,
    type ProtocolRoute,
    type NegotiatorRoutes,
} from './types'
export { NegotiationError } from './errors'
export { parseOffer, buildSelect, buildSelectError } from './frames'
export { classifyFrame, type FrameKind } from './classifyFrame'
export { selectProtocol } from './selectProtocol'
export {
    resolveDisplayIdentity,
    type DisplayIdentity,
} from './resolveDisplayIdentity'
export {
    createNegotiator,
    type Negotiator,
    type NegotiatorDeps,
} from './negotiator'
