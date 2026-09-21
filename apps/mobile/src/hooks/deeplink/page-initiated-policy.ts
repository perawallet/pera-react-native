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
 * the failure mode of the opposite default is a phishing primitive.
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

/**
 * Whether server-chosen content — a push payload or a CMS banner CTA — may
 * fire a given deeplink at the app.
 *
 * Both are a weaker trust class than a web page, not a stronger one: the user
 * navigated nowhere, and the URL is whatever the backend put in the FCM
 * payload or the CMS record, so a compromised backend picks both the
 * destination and the moment. `push-allowed` is therefore reserved for the
 * destinations Pera actually notifies about — screens showing something the
 * user already owns. Anything that prefills a transfer, starts a signature,
 * pairs a session or adds an account is refused; the user started none of it.
 *
 * Deliberately a second table rather than a reuse of DEEPLINK_PAGE_POLICY:
 * account- and asset-detail are gated against a page (it picks the address)
 * but are the canonical push destination (`perawallet://account-detail?…` is
 * what a received-funds notification carries), and `setSelectedAccountAddress`
 * ignores an address the wallet doesn't hold, so the switch can only land on
 * the user's own account.
 *
 * Exhaustive by construction and default-deny for the same reasons as the page
 * table above, including the excluded locale-tour key.
 */
type DeeplinkPushPolicy = 'push-allowed' | 'push-refused'

const DEEPLINK_PUSH_POLICY: Record<
    Exclude<DeeplinkType, DevLocaleTourDeeplinkType>,
    DeeplinkPushPolicy
> = {
    // --- Shows what the notification is about ---------------------------
    [DeeplinkType.HOME]: 'push-allowed',
    [DeeplinkType.ACCOUNT_DETAIL]: 'push-allowed',
    [DeeplinkType.ASSET_DETAIL]: 'push-allowed',
    [DeeplinkType.ASSET_TRANSACTIONS]: 'push-allowed',
    // Unlike the two above, its address never reaches
    // `setSelectedAccountAddress` — it is fed straight to the claim-assets
    // flow, so a sender can point that screen at an address the user does not
    // hold. It stays allowed because claiming needs a key the user then
    // doesn't have, and it is the one destination an incoming-asset push has.
    [DeeplinkType.ASSET_INBOX]: 'push-allowed',

    // --- Opens a section, carries no address or amount -------------------
    [DeeplinkType.CARDS]: 'push-allowed',
    [DeeplinkType.STAKING]: 'push-allowed',
    [DeeplinkType.BUY]: 'push-allowed',
    // Confined to Pera's own Discover origin by `isSafeRelativePath`.
    [DeeplinkType.DISCOVER_PATH]: 'push-allowed',
    // A campaign push linking out is the ordinary case, and both are
    // scheme-gated to https by `isSafeBrowserUrl` before anything loads.
    [DeeplinkType.DISCOVER_BROWSER]: 'push-allowed',
    [DeeplinkType.INTERNAL_BROWSER]: 'push-allowed',

    // --- Pre-fills a transfer or a trade ---------------------------------
    [DeeplinkType.ALGO_TRANSFER]: 'push-refused',
    [DeeplinkType.ASSET_TRANSFER]: 'push-refused',
    [DeeplinkType.RECEIVER_ACCOUNT_SELECTION]: 'push-refused',
    [DeeplinkType.SWAP]: 'push-refused',
    // Pops the third-party Bidali purchase sheet over whatever is on screen.
    [DeeplinkType.SELL]: 'push-refused',

    // --- Signs, submits, or authorises ------------------------------------
    [DeeplinkType.KEYREG]: 'push-refused',
    [DeeplinkType.ASSET_OPT_IN]: 'push-refused',
    [DeeplinkType.SIGN_REQUEST]: 'push-refused',
    [DeeplinkType.WALLET_CONNECT]: 'push-refused',
    [DeeplinkType.LIQUID_AUTH]: 'push-refused',

    // --- Adds or imports an account ---------------------------------------
    [DeeplinkType.RECOVER_ADDRESS]: 'push-refused',
    [DeeplinkType.PERA_WEB_IMPORT]: 'push-refused',
    // Routed by notification type, never by URL (see useNotificationPress).
    [DeeplinkType.SHARED_ACCOUNT_IMPORT]: 'push-refused',
    [DeeplinkType.ADD_WATCH_ACCOUNT]: 'push-refused',

    // --- Writes the address book (label poisoning) ------------------------
    [DeeplinkType.ADD_CONTACT]: 'push-refused',
    [DeeplinkType.EDIT_CONTACT]: 'push-refused',

    // --- Address-bearing sheet with a server-chosen label -----------------
    [DeeplinkType.ADDRESS_ACTIONS]: 'push-refused',
}

const PUSH_POLICY_BY_TYPE: Partial<Record<DeeplinkType, DeeplinkPushPolicy>> =
    DEEPLINK_PUSH_POLICY

/**
 * True when server-chosen content — a push notification or a banner CTA — may
 * fire this deeplink. Anything not explicitly marked `push-allowed` is refused.
 */
export const isPushAllowedDeeplinkType = (type: DeeplinkType): boolean =>
    PUSH_POLICY_BY_TYPE[type] === 'push-allowed'
