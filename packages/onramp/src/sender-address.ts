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

import { caip2OfRouterAsset } from './api/router-asset'
import type { RampToken } from './models'

const BASE58 = '[1-9A-HJ-NP-Za-km-z]'

// Keyed on the CAIP-2 namespace, the router's own name for an address format:
// a deposit coin's chain is outside the wallet, so it has no chain module to ask.
const ADDRESS_PATTERNS: Readonly<Record<string, RegExp>> = {
    eip155: /^0x[0-9a-fA-F]{40}$/,
    solana: new RegExp(`^${BASE58}{32,44}$`),
    // Legacy base58 addresses, or bech32 with a single-case human-readable part.
    bip122: new RegExp(
        `^(${BASE58}{25,35}|[a-z]{1,4}1[02-9ac-hj-np-z]{8,87}|[A-Z]{1,4}1[02-9AC-HJ-NP-Z]{8,87})$`,
    ),
    tron: new RegExp(`^T${BASE58}{33}$`),
}

const NO_WHITESPACE = /^\S+$/

/**
 * Whether `address` could be an account on the source's chain. A format check
 * only: it can't tell a typo from a real account. Empty is plausible, since the
 * sender address is optional.
 */
export const isPlausibleRampSenderAddress = (
    sourceToken: RampToken,
    address: string,
): boolean => {
    const trimmed = address.trim()
    if (trimmed === '' || sourceToken.kind === 'fiat') return true
    const namespace = caip2OfRouterAsset(sourceToken.id).split(':')[0]
    const pattern = ADDRESS_PATTERNS[namespace] ?? NO_WHITESPACE
    return pattern.test(trimmed)
}
