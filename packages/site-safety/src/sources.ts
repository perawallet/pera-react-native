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

import { z } from 'zod'
import { normalizeListedAddresses } from './addresses'
import { toSiteHost } from './host'
import type { PhishingListEntries, PhishingListSource } from './models'

// A path or wildcard entry needs more than the origin a dApp reaches us with.
const UNMATCHABLE = /[/*\s]/

/** Valid, deduplicated hosts in ASCII form; anything this matcher can't use is dropped. */
export const normalizeListedHosts = (entries: readonly string[]): string[] => {
    const hosts = new Set<string>()
    for (const entry of entries) {
        if (UNMATCHABLE.test(entry.trim())) continue
        const host = toSiteHost(entry)
        if (host) hosts.add(host.ascii)
    }
    return [...hosts]
}

const metaMaskConfigSchema = z.object({
    blacklist: z.array(z.string()),
    whitelist: z.array(z.string()),
    fuzzylist: z.array(z.string()),
})

const polkadotListSchema = z.object({
    deny: z.array(z.string()),
})

export const parseMetaMaskPhishingConfig = (
    raw: unknown,
): PhishingListEntries | undefined => {
    const parsed = metaMaskConfigSchema.safeParse(raw)
    if (!parsed.success) return undefined
    return {
        deny: normalizeListedHosts(parsed.data.blacklist),
        allow: normalizeListedHosts(parsed.data.whitelist),
        impersonationTargets: normalizeListedHosts(parsed.data.fuzzylist),
        addresses: [],
    }
}

// Polkadot's `allow` names hosting platforms (vercel.app, github.io) as matching
// hints; read as an allowlist it would exempt every site hosted on them.
export const parsePolkadotPhishingList = (
    raw: unknown,
): PhishingListEntries | undefined => {
    const parsed = polkadotListSchema.safeParse(raw)
    if (!parsed.success) return undefined
    return {
        deny: normalizeListedHosts(parsed.data.deny),
        allow: [],
        impersonationTargets: [],
        addresses: [],
    }
}

const mewDarklistSchema = z.array(z.object({ address: z.string() }))

export const parseMewDarklist = (
    raw: unknown,
): PhishingListEntries | undefined => {
    const parsed = mewDarklistSchema.safeParse(raw)
    if (!parsed.success) return undefined
    return {
        deny: [],
        allow: [],
        impersonationTargets: [],
        addresses: normalizeListedAddresses(
            parsed.data.map(entry => entry.address),
        ),
    }
}

/** False for a download too short to be the whole list. */
export const isCompleteList = (
    source: PhishingListSource,
    entries: PhishingListEntries,
): boolean =>
    entries.deny.length >= source.minimumDenyEntries &&
    entries.addresses.length >= source.minimumAddressEntries

/**
 * Free, community-maintained lists, fetched from fixed URLs so nothing about the
 * sites a user visits is sent. Attribution: DATA_SOURCES.md in this package.
 */
export const PHISHING_LIST_SOURCES: readonly PhishingListSource[] = [
    {
        id: 'metamask',
        url: 'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json',
        licence: 'DBAD-1.2 (MetaMask/eth-phishing-detect)',
        minimumDenyEntries: 50_000,
        minimumAddressEntries: 0,
        parse: parseMetaMaskPhishingConfig,
    },
    {
        id: 'polkadot',
        url: 'https://raw.githubusercontent.com/polkadot-js/phishing/master/all.json',
        licence: 'Apache-2.0 (polkadot-js/phishing)',
        minimumDenyEntries: 20_000,
        minimumAddressEntries: 0,
        parse: parsePolkadotPhishingList,
    },
    {
        id: 'mew-darklist',
        url: 'https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/addresses/addresses-darklist.json',
        licence: 'MIT (MyEtherWallet/ethereum-lists)',
        minimumDenyEntries: 0,
        minimumAddressEntries: 500,
        parse: parseMewDarklist,
    },
]
