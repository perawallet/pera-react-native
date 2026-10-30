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

import { useMemo } from 'react'
import { useQuery, type Query } from '@tanstack/react-query'
import type { Optional } from '@perawallet/wallet-core-shared'
import { assessSiteSafety } from '../assess'
import { toSiteHost } from '../host'
import type { AssessSiteSafetyParams, SiteSafetyVerdict } from '../models'
import { selectActiveGenerations, usePhishingListStore } from '../store/store'
import { siteSafetyQueryKeys } from './querykeys'

export type UseSiteSafetyQueryParams = AssessSiteSafetyParams & {
    isEnabled?: boolean
}

export type UseSiteSafetyQueryResult = {
    verdict: SiteSafetyVerdict
    isChecking: boolean
}

const CLEAR: SiteSafetyVerdict = { kind: 'clear' }

const toAsciiHosts = (urls: readonly string[]): string[] =>
    [
        ...new Set(
            urls.flatMap(url => {
                const host = toSiteHost(url)
                return host ? [host.ascii] : []
            }),
        ),
    ].sort()

type VerdictKey = ReturnType<typeof siteSafetyQueryKeys.verdict>

// A new copy of the lists re-checks the same site in milliseconds; keeping the
// last verdict meanwhile stops the gate swapping an open review for a spinner.
// A different site never inherits one: it waits for its own check.
const keepVerdictForSameSite =
    (hosts: readonly string[], isFlaggedByWalletConnectVerify: boolean) =>
    (
        previous: Optional<SiteSafetyVerdict>,
        previousQuery: Optional<
            Query<SiteSafetyVerdict, Error, SiteSafetyVerdict, VerdictKey>
        >,
    ): Optional<SiteSafetyVerdict> => {
        const key = previousQuery?.queryKey[2]
        const isSameSite =
            key !== undefined &&
            key.isFlaggedByWalletConnectVerify ===
                isFlaggedByWalletConnectVerify &&
            key.hosts.join('\n') === hosts.join('\n')
        return isSameSite ? previous : undefined
    }

export const useSiteSafetyQuery = ({
    urls,
    isFlaggedByWalletConnectVerify = false,
    isEnabled = true,
}: UseSiteSafetyQueryParams): UseSiteSafetyQueryResult => {
    const sources = usePhishingListStore(state => state.sources)
    const generations = useMemo(
        () => selectActiveGenerations({ sources }),
        [sources],
    )
    // Keyed on the joined text: callers pass a fresh array every render.
    const urlsKey = urls.join('\n')
    const hosts = useMemo(() => toAsciiHosts(urlsKey.split('\n')), [urlsKey])

    const query = useQuery({
        queryKey: siteSafetyQueryKeys.verdict(
            hosts,
            isFlaggedByWalletConnectVerify,
            generations,
        ),
        queryFn: () =>
            assessSiteSafety({ urls: hosts, isFlaggedByWalletConnectVerify }),
        enabled: isEnabled,
        placeholderData: keepVerdictForSameSite(
            hosts,
            isFlaggedByWalletConnectVerify,
        ),
        // Local only: it must answer offline, where the default mode pauses.
        networkMode: 'always',
    })

    return {
        verdict: query.data ?? CLEAR,
        isChecking: isEnabled && query.isPending,
    }
}
