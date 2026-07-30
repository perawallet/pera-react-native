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

export const WC_CONTROL_SCOPE = 'pera-wc-control' as const

export type WcDeliveryOutcome =
    | { ok: true; result: unknown }
    | { ok: false; message: string }

export type WcControlMessage = { scope: typeof WC_CONTROL_SCOPE } & (
    | {
          kind: 'pair'
          uri: string
          /**
           * Lets the caller correlate this pairing attempt with the
           * `pair-outcome` broadcast the host sends back once it knows the
           * connector's fate (see {@link WcPairOutcomeMessage}). Optional:
           * a caller with no interest in the outcome (or a test) can pair
           * without one, and the host simply never tracks or reports back
           * on it.
           */
          correlationId?: string
          /**
           * Browser-verified origin of the tab that requested this pairing,
           * stamped by the service worker from `sender.origin`. Absent for
           * user-initiated pairings (paste / QR), where the wallet itself is
           * the requester. NOT the dApp-asserted peerMeta origin.
           */
          requesterOrigin?: string
      }
    | { kind: 'disconnect'; clientId: string }
    | { kind: 'reconnect-all' }
    | {
          kind: 'deliver'
          clientId: string
          wcRequestId: number
          outcome: WcDeliveryOutcome
      }
    | {
          kind: 'approve-session'
          clientId: string
          approvedAddresses: string[]
          chainId: number
      }
    | { kind: 'reject-session'; clientId: string }
)

const isOutcome = (value: unknown): value is WcDeliveryOutcome => {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as { ok?: unknown; message?: unknown }
    if (candidate.ok === true) return true
    return candidate.ok === false && typeof candidate.message === 'string'
}

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string')

export const isWcControlMessage = (
    value: unknown,
): value is WcControlMessage => {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Record<string, unknown>
    if (candidate.scope !== WC_CONTROL_SCOPE) return false
    switch (candidate.kind) {
        case 'pair': {
            return (
                typeof candidate.uri === 'string' &&
                (candidate.correlationId === undefined ||
                    typeof candidate.correlationId === 'string') &&
                (candidate.requesterOrigin === undefined ||
                    typeof candidate.requesterOrigin === 'string')
            )
        }
        case 'disconnect': {
            return typeof candidate.clientId === 'string'
        }
        case 'reconnect-all': {
            return true
        }
        case 'deliver': {
            return (
                typeof candidate.clientId === 'string' &&
                typeof candidate.wcRequestId === 'number' &&
                isOutcome(candidate.outcome)
            )
        }
        case 'approve-session': {
            return (
                typeof candidate.clientId === 'string' &&
                typeof candidate.chainId === 'number' &&
                isStringArray(candidate.approvedAddresses)
            )
        }
        case 'reject-session': {
            return typeof candidate.clientId === 'string'
        }
        default: {
            return false
        }
    }
}

/**
 * Offscreen → service worker traffic: a gate-surviving dApp request
 * (session pairing or a signable request) that needs an approval surface.
 * Distinct scope from {@link WC_CONTROL_SCOPE}, which flows the other way
 * (SW/popup → offscreen) and carries connector lifecycle commands rather
 * than approval requests.
 */
export const WC_REQUEST_SCOPE = 'pera-wc-request' as const

export type WcApprovalRequestMessage = {
    scope: typeof WC_REQUEST_SCOPE
    request:
        | {
              kind: 'wc-connect'
              clientId: string
              chainId: number
              // dApp-asserted `peerMeta.url` origin — the WalletConnect
              // handshake's own claim, which a page can forge.
              origin: string
              // Also dApp-asserted, carried so the approval surface can render
              // the peer's name/icon and the requested permissions the way
              // mobile's ConnectionView does. Display only.
              peerName?: string
              peerIcons?: string[]
              permissions?: string[]
              // Browser-verified origin of the tab that requested this
              // pairing (see `WcControlMessage`'s `pair.requesterOrigin`).
              // Absent for user-initiated pairings. Never conflate with
              // `origin` above — different trust levels.
              requesterOrigin?: string
          }
        | {
              kind: 'wc-sign'
              clientId: string
              wcRequestId: number
              method: 'algo_signTxn' | 'algo_signData'
              payload: unknown
              origin: string
          }
        /**
         * A handshake the host already REFUSED on the user's behalf, surfaced
         * only so the user learns why. Unlike the two kinds above there is no
         * decision to make and nothing is pending on the socket — the peer was
         * answered (`rejectSession`) before this was ever sent.
         *
         * It exists because the dApp's own SDK reacts to that rejection by
         * tearing its connect modal down, so without this the user's click just
         * silently does nothing. A page-initiated pair has no outcome channel
         * back to the page (by design — see the connect-modal spec's error
         * handling), which leaves the approval surface as the only place to say
         * so.
         */
        | {
              kind: 'wc-error'
              clientId: string
              reason: 'network-mismatch'
              // dApp-asserted `peerMeta.url` origin — forgeable, shown only as
              // context for which app was refused.
              origin: string
              // The chain the dApp asked for, and the wallet's active network,
              // so the surface can name both sides of the mismatch.
              requestedChainId?: number
              activeNetwork: string
          }
}

export const isWcApprovalRequestMessage = (
    value: unknown,
): value is WcApprovalRequestMessage => {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Record<string, unknown>
    if (candidate.scope !== WC_REQUEST_SCOPE) return false
    const request = candidate.request as { kind?: unknown } | undefined
    return (
        request?.kind === 'wc-connect' ||
        request?.kind === 'wc-sign' ||
        request?.kind === 'wc-error'
    )
}

/**
 * Offscreen → UI traffic: reports how a `pair` control message (see
 * {@link WcControlMessage}'s `pair` variant) ultimately resolved. Distinct
 * scope from {@link WC_CONTROL_SCOPE} (the opposite direction — UI/SW →
 * offscreen — carrying connector lifecycle commands, not outcomes) for the
 * same reason {@link WC_REQUEST_SCOPE} is distinct from it: mixing
 * directions into one message union would force `wcHost.ts`'s
 * `handleControlMessage` switch to grow a case for a message kind it never
 * receives, just to keep its exhaustiveness check happy.
 *
 * `outcome` mirrors the tri-state union `waitForSessionOutcome` already
 * returns natively (`session` | `error` | `timeout`) so a web caller can
 * map it onto the exact same `WalletConnectPairingResult` branches the
 * shared deeplink/webview call sites already handle — no new branching
 * needed at those call sites. The host only ever sends `session` or
 * `error`: `timeout` is a purely client-side fallback (the caller's own
 * bounded wait — see `useWalletConnectPairing.web.ts`), since offscreen
 * has no reason to guess how long a caller is willing to wait.
 */
export const WC_PAIR_OUTCOME_SCOPE = 'pera-wc-pair-outcome' as const

export type WcPairOutcome =
    | { type: 'session' }
    | { type: 'error'; reason: string }
    | { type: 'timeout' }

export type WcPairOutcomeMessage = {
    scope: typeof WC_PAIR_OUTCOME_SCOPE
    correlationId: string
    outcome: WcPairOutcome
}

const isWcPairOutcome = (value: unknown): value is WcPairOutcome => {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as { type?: unknown; reason?: unknown }
    switch (candidate.type) {
        case 'session':
        case 'timeout': {
            return true
        }
        case 'error': {
            return typeof candidate.reason === 'string'
        }
        default: {
            return false
        }
    }
}

export const isWcPairOutcomeMessage = (
    value: unknown,
): value is WcPairOutcomeMessage => {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Record<string, unknown>
    if (candidate.scope !== WC_PAIR_OUTCOME_SCOPE) return false
    return (
        typeof candidate.correlationId === 'string' &&
        isWcPairOutcome(candidate.outcome)
    )
}
