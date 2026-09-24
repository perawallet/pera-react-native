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
 * Whether a push or in-app notification may fire a given deeplink.
 *
 * A notification's URL comes from the notifications backend (or whoever holds
 * the FCM sender credentials), and its provenance is itself a trust cue, so
 * only navigation-shaped types are admitted. Anything that pre-fills a
 * transfer, signs, pairs, or writes wallet state is refused.
 *
 * Exhaustive `Record` for the same reason as `DEEPLINK_PAGE_POLICY`: a new
 * `DeeplinkType` fails to compile until it is classified here. The locale tour
 * is excluded and therefore denied (see page-initiated-policy.ts).
 */
export const DEEPLINK_NOTIFICATION_POLICY: Record<
    Exclude<DeeplinkType, DevLocaleTourDeeplinkType>,
    boolean
> = {
    [DeeplinkType.HOME]: true,
    [DeeplinkType.ACCOUNT_DETAIL]: true,
    [DeeplinkType.ASSET_DETAIL]: true,
    [DeeplinkType.ASSET_TRANSACTIONS]: true,
    [DeeplinkType.ASSET_INBOX]: true,
    // Fetched by id from the backend and reviewed in the sheet; the link
    // carries no transaction content of its own.
    [DeeplinkType.SIGN_REQUEST]: true,
    [DeeplinkType.CARDS]: true,
    [DeeplinkType.STAKING]: true,
    [DeeplinkType.DISCOVER_PATH]: true,
    // Scheme-gated by `isSafeBrowserUrl`; kept for campaign pushes.
    [DeeplinkType.DISCOVER_BROWSER]: true,
    [DeeplinkType.INTERNAL_BROWSER]: true,

    [DeeplinkType.ALGO_TRANSFER]: false,
    [DeeplinkType.ASSET_TRANSFER]: false,
    [DeeplinkType.RECEIVER_ACCOUNT_SELECTION]: false,
    [DeeplinkType.KEYREG]: false,
    [DeeplinkType.ASSET_OPT_IN]: false,
    [DeeplinkType.WALLET_CONNECT]: false,
    [DeeplinkType.LIQUID_AUTH]: false,
    [DeeplinkType.RECOVER_ADDRESS]: false,
    [DeeplinkType.PERA_WEB_IMPORT]: false,
    [DeeplinkType.SHARED_ACCOUNT_IMPORT]: false,
    [DeeplinkType.ADD_WATCH_ACCOUNT]: false,
    [DeeplinkType.ADD_CONTACT]: false,
    [DeeplinkType.EDIT_CONTACT]: false,
    [DeeplinkType.ADDRESS_ACTIONS]: false,
    [DeeplinkType.SWAP]: false,
    [DeeplinkType.BUY]: false,
    [DeeplinkType.SELL]: false,
}

const POLICY_BY_TYPE: Partial<Record<DeeplinkType, boolean>> =
    DEEPLINK_NOTIFICATION_POLICY

export const isNotificationAllowedDeeplinkType = (
    type: DeeplinkType,
): boolean => POLICY_BY_TYPE[type] === true
