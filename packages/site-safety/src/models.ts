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

export type PhishingListSourceId = 'metamask' | 'polkadot'

export type PhishingListEntryKind = 'deny' | 'allow' | 'impersonation-target'

/** Hosts in ASCII (punycode) form, lowercased. */
export type PhishingListEntries = {
    deny: string[]
    allow: string[]
    impersonationTargets: string[]
}

export type PhishingListSource = {
    id: PhishingListSourceId
    url: string
    licence: string
    /** A download with fewer deny entries is treated as truncated. */
    minimumDenyEntries: number
    parse(raw: unknown): PhishingListEntries | undefined
}

/** Each value is newline-joined, so Hermes parses one string instead of 100k+ literals. */
export type PhishingListSnapshot = {
    generatedAt: string
    sources: Record<
        PhishingListSourceId,
        { deny: string; allow: string; impersonationTargets: string }
    >
}

export type ActiveGenerations = Partial<Record<PhishingListSourceId, number>>

export type ImpersonationTarget = {
    name: string
    /** The domain a warning names; it and its subdomains are never flagged. */
    domain: string
    /** Other domains the same project runs, exempt the same way. */
    otherDomains?: readonly string[]
}

export type SiteHost = {
    ascii: string
    unicode: string
}

/**
 * `clear` means no list or look-alike warning, never that the site is safe.
 * `host` is the Unicode form, for display.
 */
export type SiteSafetyVerdict =
    | { kind: 'clear' }
    | { kind: 'look-alike'; host: string; imitates: ImpersonationTarget }
    | {
          kind: 'blocked'
          host: string
          reason: 'phishing-list' | 'walletconnect-verify'
      }

export type PhishingListRefreshOutcome =
    | 'updated'
    | 'unchanged'
    | 'failed'
    | 'malformed'

export type AssessSiteSafetyParams = {
    urls: readonly (string | null | undefined)[]
    isFlaggedByWalletConnectVerify?: boolean
}
