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

// Wire types for the WebAuthn-interception relay (content script ⇄ service
// worker), mirroring router-protocol.ts's ARC-0027 shape. Pure (no chrome.*),
// so it's safe to import from webauthn-relay.ts (ISOLATED content script)
// via the narrow content-wire.ts alias, and from webauthn-main.ts's test
// suite without any chrome fake.
import type {
    SerializedCreateOptions,
    SerializedCredential,
    SerializedGetOptions,
} from '@perawallet/wallet-core-passkeys/webauthn'

export const WEBAUTHN_RELAY_SCOPE = 'pera-webauthn-relay' as const

export type WebauthnCeremonyRequest =
    | { kind: 'create'; origin: string; options: SerializedCreateOptions }
    | { kind: 'get'; origin: string; options: SerializedGetOptions }

// `origin` above is carried for context/observability only — it is
// PAGE-DERIVED at the point webauthn-main.ts stamps it (location.origin) and
// is NEVER treated as authoritative downstream. The service worker (see
// passkey-router.ts) authenticates every ceremony off
// `chrome.runtime.MessageSender.origin` instead, exactly like router.ts does
// for ARC-0027 requests, and ignores this field for that purpose.
export type WebauthnRelayMessage = {
    scope: typeof WEBAUTHN_RELAY_SCOPE
    request: WebauthnCeremonyRequest
}

export const isWebauthnRelayMessage = (
    value: unknown,
): value is WebauthnRelayMessage => {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    if (v.scope !== WEBAUTHN_RELAY_SCOPE) return false
    const request = v.request as Record<string, unknown> | undefined
    if (typeof request !== 'object' || request === null) return false
    return request.kind === 'create' || request.kind === 'get'
}

// The three terminal shapes webauthn-main.ts ever sees: a minted credential, a
// decline (a user decision, an unauthenticated sender, a bad RP ID, or a closed
// window — all fall through to native), or an authenticator-level `Error.name`.
//
// The `{ error }` case matters BECAUSE it must NOT fall through: an
// `InvalidStateError` means `excludeCredentials` already matched a real
// Pera-minted credential, so falling through would let the OS authenticator
// mint the duplicate the RP explicitly excluded.
export type WebauthnCeremonyResponse =
    | { credential: SerializedCredential }
    | { decline: true }
    | { error: string }
