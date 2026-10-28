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
import { useQuery } from '@tanstack/react-query'
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
        // Local only: it must answer offline, where the default mode pauses.
        networkMode: 'always',
    })

    return {
        verdict: query.data ?? CLEAR,
        isChecking: isEnabled && query.isPending,
    }
}
