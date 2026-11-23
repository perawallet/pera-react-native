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

import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import {
    originOf,
    stripUrlScheme,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { attestedOriginOf } from './knownContractSite'

const authorityOf = (url: string): Optional<string> => {
    try {
        return new URL(url).host
    } catch {
        return undefined
    }
}

/**
 * The requesting site when a sign-in message names another domain, else
 * undefined. Without an attested origin the dApp's own claimed URL is used:
 * a message for another domain is suspect even against that.
 */
export const signInSiteMismatchOf = (
    domain: string,
    source?: SignRequestSource,
    verifiedOrigin?: string,
): Optional<string> => {
    const origin = attestedOriginOf(source, verifiedOrigin) ?? source?.url
    const site = origin ? authorityOf(origin) : undefined
    if (!origin || !site) return undefined
    // EIP-4361's domain is an RFC 3986 authority, so it parses as one.
    if (authorityOf(`https://${domain}`) === site) return undefined
    return stripUrlScheme(originOf(origin) ?? origin)
}
