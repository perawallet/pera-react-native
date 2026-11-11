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
import { isSiteOfDapp } from '@perawallet/wallet-core-site-safety'
import {
    originOf,
    stripUrlScheme,
    type Optional,
} from '@perawallet/wallet-core-shared'

// The dApp's claimed `source.url` is whatever a phishing page says it is, so
// only an origin the platform observed, or one WalletConnect Verify vouched
// for, counts. An observed origin wins over Verify's.
const attestedOriginOf = (
    source?: SignRequestSource,
    verifiedOrigin?: string,
): Optional<string> =>
    verifiedOrigin ??
    (source?.verification?.status === 'valid'
        ? source.verification.verifiedOrigin
        : undefined)

/** Verify rated the request's site against it; no origin is proven, but nothing should read as trusted. */
export const isFlaggedByVerify = (source?: SignRequestSource): boolean =>
    source?.verification?.status === 'mismatch' ||
    source?.verification?.status === 'scam'

/** Whether the request comes from the contract's own project site. */
export const isKnownContractSite = (
    projectDomain: Optional<string>,
    source?: SignRequestSource,
    verifiedOrigin?: string,
): boolean => {
    if (!projectDomain) return false
    return isSiteOfDapp(attestedOriginOf(source, verifiedOrigin), projectDomain)
}

/**
 * The attested origin's host when it is not the project's site, else
 * undefined. A request with no attested origin is not a mismatch: nothing
 * was proven either way.
 */
export const spenderSiteMismatchOf = (
    projectDomain: Optional<string>,
    source?: SignRequestSource,
    verifiedOrigin?: string,
): Optional<string> => {
    const origin = attestedOriginOf(source, verifiedOrigin)
    if (!projectDomain || !origin) return undefined
    if (isSiteOfDapp(origin, projectDomain)) return undefined
    return stripUrlScheme(originOf(origin) ?? origin)
}
