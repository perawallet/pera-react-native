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

import { type PeraProject, type VerificationTier } from '../models/types'

/** Lowercased host of a URL, tolerant of a missing scheme; undefined if unparseable. */
const hostOf = (url: string | null | undefined): string | undefined => {
    if (!url) return undefined
    const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    const authority = withoutScheme.split(/[/?#]/)[0] ?? ''
    const host = (authority.split('@').pop() ?? '').split(':')[0]
    return host ? host.toLowerCase() : undefined
}

const hostMatches = (
    a: string | null | undefined,
    b: string | null | undefined,
): boolean => {
    const hostA = hostOf(a)
    return hostA !== undefined && hostA === hostOf(b)
}

/**
 * Decides which verification badge, if any, is safe to render for a resolved
 * project.
 *
 * The registry lookup is keyed on a URL the peer asserts freely (all
 * WalletConnect requests), so a positive `verified` tier is a Pera-owned trust
 * claim that must NOT be minted from that spoofable key. It is honoured only
 * when {@link verifiedOrigin} — the origin the platform itself observed, unset
 * for WalletConnect — is present and its host matches the matched record's URL.
 *
 * A `suspicious` tier is a warning and is always surfaced: fail-loud is safe,
 * and its absence must never be read as "clean". Returns the tier to render, or
 * `undefined` to render nothing.
 */
export const resolveDisplayableVerificationTier = (
    project: PeraProject | null | undefined,
    verifiedOrigin: string | null | undefined,
): VerificationTier | undefined => {
    const tier = project?.verificationTier

    if (!tier || tier === 'unverified') return undefined
    if (tier === 'suspicious') return 'suspicious'

    // Positive tier: honour only against a platform-observed matching origin.
    return hostMatches(verifiedOrigin, project?.url) ? tier : undefined
}
