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

// Wire types for the content-script ⇄ service-worker dapp relay. The SW
// answers via chrome.runtime.onMessage's sendResponse, so there is no
// separate "response" message shape on this scope — DAPP_RESPONSE_SCOPE is
// reserved for a future push-style notification (e.g. account changed) and
// unused by the request/response round trip itself.
import type { Arc0027RequestEnvelope } from './types'

export const DAPP_RELAY_SCOPE = 'pera-dapp-relay' as const
export const DAPP_RESPONSE_SCOPE = 'pera-dapp-response' as const

export type DappRelayMessage = {
    scope: typeof DAPP_RELAY_SCOPE
    request: Arc0027RequestEnvelope
}

export const isDappRelayMessage = (
    value: unknown,
): value is DappRelayMessage => {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    return (
        v.scope === DAPP_RELAY_SCOPE &&
        typeof v.request === 'object' &&
        v.request !== null
    )
}

export type DiscoverInfo = {
    providerId: string
    name: string
    iconUrl: string
    networks: { genesisHash: string; genesisId: string }[]
}
