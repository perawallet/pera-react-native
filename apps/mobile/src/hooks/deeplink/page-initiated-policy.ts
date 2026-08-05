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

import { DeeplinkType, type DevLocaleTourDeeplinkType } from './types'

/**
 * Whether web content may fire a given deeplink at the app.
 *
 * `page-allowed` is reserved for pure navigation: it opens a screen, carries no
 * address or amount, changes no wallet state, and gives a page nothing it
 * couldn't already do by navigating itself. Everything else is `origin-gated` —
 * only the trusted Discover origin may fire it.
 *
 * This is a `Record` over the whole union ON PURPOSE: adding a `DeeplinkType`
 * is a compile error until someone classifies it, so a new value-bearing type
 * can never be admitted by forgetting about this file. Default-deny, because
 * the failure mode of the opposite default is a phishing primitive
 * (PERA-4666).
 *
 * The locale tour is the one excluded key: its type has no runtime member to
 * write here (see types.ts), and naming it as a bare string would put the tag
 * back into release bundles that the resolver swap exists to keep it out of.
 * `isOriginGatedDeeplinkType` reads an absent entry as gated, so excluding it
 * is default-deny too — and a dev build can still load the Discover webview,
 * where page content must never be able to drive in-app navigation.
 */
export type DeeplinkPagePolicy = 'page-allowed' | 'origin-gated'

export const DEEPLINK_PAGE_POLICY: Record<
    Exclude<DeeplinkType, DevLocaleTourDeeplinkType>,
    DeeplinkPagePolicy
> = {
    // --- Pure navigation ------------------------------------------------
    [DeeplinkType.HOME]: 'page-allowed',
    [DeeplinkType.CARDS]: 'page-allowed',
    [DeeplinkType.STAKING]: 'page-allowed',
    [DeeplinkType.DISCOVER_PATH]: 'page-allowed',
    // Opening a browser is a capability the page already has by navigating,
    // and both are additionally scheme-gated by `isSafeBrowserUrl`.
    [DeeplinkType.DISCOVER_BROWSER]: 'page-allowed',
    [DeeplinkType.INTERNAL_BROWSER]: 'page-allowed',

    // --- Pre-fills a transfer -------------------------------------------
    [DeeplinkType.ALGO_TRANSFER]: 'origin-gated',
    [DeeplinkType.ASSET_TRANSFER]: 'origin-gated',
    // Opens Send with an attacker-chosen recipient via `openSendFunds`.
    [DeeplinkType.RECEIVER_ACCOUNT_SELECTION]: 'origin-gated',

    // --- Signs, submits, or authorises ----------------------------------
    [DeeplinkType.KEYREG]: 'origin-gated',
    [DeeplinkType.ASSET_OPT_IN]: 'origin-gated',
    [DeeplinkType.SIGN_REQUEST]: 'origin-gated',
    [DeeplinkType.WALLET_CONNECT]: 'origin-gated',
    [DeeplinkType.LIQUID_AUTH]: 'origin-gated',

    // --- Adds or imports an account -------------------------------------
    [DeeplinkType.RECOVER_ADDRESS]: 'origin-gated',
    [DeeplinkType.PERA_WEB_IMPORT]: 'origin-gated',
    [DeeplinkType.SHARED_ACCOUNT_IMPORT]: 'origin-gated',
    [DeeplinkType.ADD_WATCH_ACCOUNT]: 'origin-gated',

    // --- Writes the address book (label poisoning) ----------------------
    [DeeplinkType.ADD_CONTACT]: 'origin-gated',
    [DeeplinkType.EDIT_CONTACT]: 'origin-gated',

    // --- Switches the selected account ----------------------------------
    [DeeplinkType.ACCOUNT_DETAIL]: 'origin-gated',
    [DeeplinkType.ASSET_DETAIL]: 'origin-gated',
    [DeeplinkType.ASSET_TRANSACTIONS]: 'origin-gated',
    [DeeplinkType.SWAP]: 'origin-gated',
    [DeeplinkType.BUY]: 'origin-gated',
    [DeeplinkType.SELL]: 'origin-gated',

    // --- Address-bearing surfaces ---------------------------------------
    [DeeplinkType.ADDRESS_ACTIONS]: 'origin-gated',
    [DeeplinkType.ASSET_INBOX]: 'origin-gated',
}

// Widened, not cast: lets the lookup below accept any DeeplinkType while the
// map above stays exhaustive over everything it is required to classify.
const POLICY_BY_TYPE: Partial<Record<DeeplinkType, DeeplinkPagePolicy>> =
    DEEPLINK_PAGE_POLICY

/**
 * True when only the trusted origin may fire this deeplink. Anything not
 * explicitly marked `page-allowed` is gated.
 */
export const isOriginGatedDeeplinkType = (type: DeeplinkType): boolean =>
    POLICY_BY_TYPE[type] !== 'page-allowed'
