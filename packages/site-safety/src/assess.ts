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

import { logger, type Optional } from '@perawallet/wallet-core-shared'
import {
    findAllowedDomains,
    findImpersonationTargetDomains,
    findListedDomains,
} from './db/repository'
import { listLookupCandidates, registrableDomainOf, toSiteHost } from './host'
import { findImpersonatedTarget } from './lookAlike'
import type {
    ActiveGenerations,
    AssessSiteSafetyParams,
    ImpersonationTarget,
    SiteHost,
    SiteSafetyVerdict,
} from './models'
import { whenPhishingListsSeeded } from './seed'
import { selectActiveGenerations, usePhishingListStore } from './store/store'
import { WELL_KNOWN_DAPPS } from './wellKnownDapps'

const uniqueHosts = (urls: AssessSiteSafetyParams['urls']): SiteHost[] => {
    const hosts = new Map<string, SiteHost>()
    for (const url of urls) {
        const host = toSiteHost(url)
        if (host && !hosts.has(host.ascii)) hosts.set(host.ascii, host)
    }
    return [...hosts.values()]
}

type ListContext = {
    allowDomains: string[]
    targets: ImpersonationTarget[]
}

const generationsKeyOf = (generations: ActiveGenerations): string =>
    Object.entries(generations)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([source, generation]) => `${source}:${generation}`)
        .join(',')

// The allow list and look-alike targets change only with a new copy of the
// lists, so they are read once per copy rather than on every check.
let cachedListContext: Optional<{ key: string; context: Promise<ListContext> }>

const listContextFor = (
    key: string,
    generations: ActiveGenerations,
): Promise<ListContext> => {
    if (cachedListContext?.key !== key) {
        const context = Promise.all([
            findAllowedDomains({ generations }),
            findImpersonationTargetDomains({ generations }),
        ]).then(([allowDomains, listedTargets]) => ({
            allowDomains,
            targets: impersonationTargets(listedTargets),
        }))
        cachedListContext = { key, context }
        context.catch(() => {
            if (cachedListContext?.context === context) {
                cachedListContext = undefined
            }
        })
    }
    return cachedListContext.context
}

const findListedHost = async (
    hosts: readonly SiteHost[],
    generations: ActiveGenerations,
): Promise<Optional<SiteHost>> => {
    for (const host of hosts) {
        const { denied, allowed } = await findListedDomains({
            generations,
            domains: listLookupCandidates(host.ascii),
        })
        if (denied.length > 0 && allowed.length === 0) return host
    }
    return undefined
}

// Accounts are re-read on every eth_accounts poll; within one copy of the
// lists a site's verdict cannot change, so it is reused until the copy does.
const MAX_CACHED_VERDICTS = 500
const cachedVerdicts = new Map<string, SiteSafetyVerdict>()
let cachedVerdictsKey: Optional<string>

const rememberVerdict = (
    generationsKey: string,
    hostsKey: string,
    verdict: SiteSafetyVerdict,
): SiteSafetyVerdict => {
    if (cachedVerdictsKey !== generationsKey) {
        cachedVerdicts.clear()
        cachedVerdictsKey = generationsKey
    }
    if (cachedVerdicts.size >= MAX_CACHED_VERDICTS) cachedVerdicts.clear()
    cachedVerdicts.set(hostsKey, verdict)
    return verdict
}

const lookAlikeVerdictOf = (
    hosts: readonly SiteHost[],
    { allowDomains, targets }: ListContext,
): SiteSafetyVerdict => {
    for (const host of hosts) {
        const imitated = findImpersonatedTarget(host, targets, allowDomains)
        if (imitated) {
            return {
                kind: 'look-alike',
                host: host.unicode,
                imitates: imitated,
            }
        }
    }
    return { kind: 'clear' }
}

// A list target can name a subdomain (`launchpad.ethereum.org`); only its
// registrable domain is matched and named, so the subdomain's parent site is
// exempt rather than read as an imitation of itself.
const impersonationTargets = (
    listedTargets: readonly string[],
): ImpersonationTarget[] => {
    const known = new Set(
        WELL_KNOWN_DAPPS.flatMap(target => [
            target.domain,
            ...(target.otherDomains ?? []),
        ]),
    )
    const listed = new Set(listedTargets.map(registrableDomainOf))
    return [
        ...WELL_KNOWN_DAPPS,
        ...[...listed]
            .filter(domain => !known.has(domain))
            .map(domain => ({ name: domain, domain })),
    ]
}

/**
 * Checks every URL a surface knows for a dApp against the on-device lists and
 * the well-known dApps; the worst result wins. Nothing leaves the device.
 */
export const assessSiteSafety = async ({
    urls,
    isFlaggedByWalletConnectVerify = false,
}: AssessSiteSafetyParams): Promise<SiteSafetyVerdict> => {
    const hosts = uniqueHosts(urls)

    if (isFlaggedByWalletConnectVerify) {
        return {
            kind: 'blocked',
            host: hosts[0]?.unicode ?? '',
            reason: 'walletconnect-verify',
        }
    }
    if (hosts.length === 0) return { kind: 'clear' }

    const hostsKey = hosts.map(host => host.ascii).join('\n')
    try {
        await whenPhishingListsSeeded()
        const generations = selectActiveGenerations(
            usePhishingListStore.getState(),
        )
        const generationsKey = generationsKeyOf(generations)
        if (cachedVerdictsKey === generationsKey) {
            const cached = cachedVerdicts.get(hostsKey)
            if (cached) return cached
        }
        const listed = await findListedHost(hosts, generations)
        const verdict: SiteSafetyVerdict = listed
            ? { kind: 'blocked', host: listed.unicode, reason: 'phishing-list' }
            : lookAlikeVerdictOf(
                  hosts,
                  await listContextFor(generationsKey, generations),
              )
        return rememberVerdict(generationsKey, hostsKey, verdict)
    } catch (error) {
        // The look-alike rules need no database, so a failed read still
        // leaves them running. Not cached: the next check retries the lists.
        logger.warn('[site-safety] phishing list lookup failed', { error })
        return lookAlikeVerdictOf(hosts, {
            allowDomains: [],
            targets: impersonationTargets([]),
        })
    }
}
