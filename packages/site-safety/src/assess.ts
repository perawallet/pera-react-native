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

import { logger } from '@perawallet/wallet-core-shared'
import {
    findAllowedDomains,
    findImpersonationTargetDomains,
    findListedDomains,
} from './db/repository'
import { listLookupCandidates, toSiteHost } from './host'
import { findImpersonatedTarget } from './lookAlike'
import type {
    AssessSiteSafetyParams,
    ImpersonationTarget,
    SiteHost,
    SiteSafetyVerdict,
} from './models'
import { ensurePhishingListsSeeded } from './seed'
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

type ListLookup = {
    blocked?: SiteSafetyVerdict
    allowDomains: string[]
    listedTargets: string[]
}

const lookUpLists = async (hosts: readonly SiteHost[]): Promise<ListLookup> => {
    await ensurePhishingListsSeeded()
    const generations = selectActiveGenerations(usePhishingListStore.getState())
    const [allowDomains, listedTargets] = await Promise.all([
        findAllowedDomains({ generations }),
        findImpersonationTargetDomains({ generations }),
    ])
    for (const host of hosts) {
        const { denied, allowed } = await findListedDomains({
            generations,
            domains: listLookupCandidates(host.ascii),
        })
        if (denied.length > 0 && allowed.length === 0) {
            return {
                blocked: {
                    kind: 'blocked',
                    host: host.unicode,
                    reason: 'phishing-list',
                },
                allowDomains,
                listedTargets,
            }
        }
    }
    return { allowDomains, listedTargets }
}

const impersonationTargets = (
    listedTargets: readonly string[],
): ImpersonationTarget[] => {
    const known = new Set(WELL_KNOWN_DAPPS.map(target => target.domain))
    return [
        ...WELL_KNOWN_DAPPS,
        ...listedTargets
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

    let lookup: ListLookup = { allowDomains: [], listedTargets: [] }
    try {
        lookup = await lookUpLists(hosts)
    } catch (error) {
        // The look-alike rules need no database, so a failed read still
        // leaves them running.
        logger.warn('[site-safety] phishing list lookup failed', { error })
    }
    if (lookup.blocked) return lookup.blocked

    const targets = impersonationTargets(lookup.listedTargets)
    for (const host of hosts) {
        const imitated = findImpersonatedTarget(
            host,
            targets,
            lookup.allowDomains,
        )
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
