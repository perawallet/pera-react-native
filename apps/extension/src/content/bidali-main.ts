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

// MAIN-world bridge for the Bidali gift-card webview. Native injects the
// equivalent surface via react-native-webview injectedJavaScript
// (buildBidaliProviderJS in useBidaliTransport.ts — the authoritative
// reference this file mirrors); on web a content script is the only way to
// install page-visible globals. Inert without the extension-stamped bridge
// token: this script also matches regular *.bidali.com tabs (all_frames, no
// iframe) where no bridge host exists on the other side. Reuses the exact
// handshake dance discover-main.ts runs with bidali-relay.ts (see
// webview-relay.ts's header for why sharing those Discover-named constants
// across the two disjoint-origin pairs is safe).
import type { DiscoverChannelHandshake } from '@perawallet/wallet-extension-platform-chrome'
import {
    DISCOVER_BRIDGE_TOKEN_PARAM,
    DISCOVER_HANDSHAKE_EVENT,
    DISCOVER_RELAY_READY_EVENT,
} from '@perawallet/wallet-extension-platform-chrome'

// Mirrors SUPPORTED_CURRENCIES in useBidaliTransport.ts.
const PAYMENT_CURRENCIES = ['algorand', 'usdcalgorand']

const BALANCES_PARAM = 'peraBidaliBalances'

const parseBalances = (raw: string | null): Record<string, string> => {
    if (!raw) return {}
    try {
        const parsed: unknown = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, string>
        }
        return {}
    } catch {
        return {}
    }
}

const searchParams = new URLSearchParams(window.location.search)
const token = searchParams.get(DISCOVER_BRIDGE_TOKEN_PARAM)

if (token) {
    const rand = (): string => crypto.randomUUID().replace(/-/g, '')
    const channel: DiscoverChannelHandshake = {
        requestEventName: `__pera_bidali_req_${rand()}__`,
        responseEventName: `__pera_bidali_res_${rand()}__`,
    }

    const dispatchHandshake = (): void => {
        window.dispatchEvent(
            new CustomEvent(DISCOVER_HANDSHAKE_EVENT, { detail: channel }),
        )
    }
    // Re-dispatch if bidali-relay.ts loads after us (same recovery
    // discover-main.ts/discover-relay.ts uses).
    window.addEventListener(DISCOVER_RELAY_READY_EVENT, dispatchHandshake)
    dispatchHandshake()

    const relay = (message: Record<string, unknown>): void => {
        window.dispatchEvent(
            new CustomEvent(channel.requestEventName, { detail: message }),
        )
    }

    // Mirrors native's sendRPC helper (buildBidaliProviderJS in
    // useBidaliTransport.ts) exactly, including the 'bidali-'-prefixed id:
    // Bidali's own page script (and the native handleMessage counterpart)
    // expects this envelope shape regardless of host.
    const sendRPC = (method: string, params: unknown): void => {
        relay({
            jsonrpc: '2.0',
            method,
            params,
            id: `bidali-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        })
    }

    window.bidaliProvider = {
        key: searchParams.get('key') ?? '',
        name: 'perawallet',
        paymentCurrencies: PAYMENT_CURRENCIES,
        balances: parseBalances(searchParams.get(BALANCES_PARAM)),

        onPaymentRequest: (req: unknown) => {
            if (req == null || typeof req !== 'object') return
            const request = req as Record<string, unknown>
            sendRPC('bidaliPaymentRequest', {
                address: request.address,
                amount: request.amount,
                protocol: request.protocol || request.currencyProtocol,
                extraId: request.extraId,
                chargeId: request.chargeId,
                description: request.description,
            })
        },

        openUrl: (urlOrObj: unknown) => {
            const url =
                typeof urlOrObj === 'object' && urlOrObj !== null
                    ? (urlOrObj as Record<string, unknown>).url
                    : urlOrObj
            if (typeof url !== 'string') return
            sendRPC('openUrl', { url })
        },
    }

    // Host → page direction: bidali-events.web.ts (Task 2) posts this exact,
    // deliberately id-less fire-and-forget notification onto the same
    // window — never attempt request/response correlation on it.
    // NOTE the source check below only excludes OTHER frames — it does not
    // authenticate the relay: page scripts share this realm and can forge the
    // message. That is safe today only because paymentSent/paymentCancelled
    // are callbacks the page itself assigns (forging them grants the page
    // nothing it can't already call directly). Do not extend this listener
    // with anything that carries security weight.
    window.addEventListener('message', event => {
        if (event.source !== window) return
        const data = event.data as
            | { jsonrpc?: unknown; method?: unknown; params?: unknown }
            | null
            | undefined
        if (
            !data ||
            data.jsonrpc !== '2.0' ||
            data.method !== 'bidaliEvent' ||
            typeof data.params !== 'object' ||
            data.params === null
        ) {
            return
        }
        const bidaliEvent = (data.params as Record<string, unknown>).event
        if (bidaliEvent === 'paymentSent') {
            window.bidaliProvider?.paymentSent?.()
        } else if (bidaliEvent === 'paymentCancelled') {
            window.bidaliProvider?.paymentCancelled?.()
        }
    })
}

export {}
