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
import { Decimal } from 'decimal.js'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { logger, toError } from '@perawallet/wallet-core-shared'
import type {
    StakingProject,
    StakingProjectInfo,
    StakingProjectsApiResponse,
} from '../models'
import { fetchStakingProjectsInfo } from './endpoints'
import { getStakingProjectsQueryKey } from './queryKeys'
import { parseStakingProjectsI18nConfig } from '../utils'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

type UseStakingProjectsQueryResult = {
    data: StakingProject[]
    isLoading: boolean
    isError: boolean
    /** True when the TVL fetch is paused offline with no cached data — the surface should render an offline state. Paused background refetches with cached data do NOT count. */
    isPaused: boolean
    error: Nullable<Error>
    refetch: () => void
}

const parseTvlValue = (value?: Nullable<string>): Decimal => {
    try {
        return new Decimal(value ?? '0')
    } catch {
        return new Decimal(0)
    }
}

const mapProjects = (
    projects: StakingProjectInfo[],
    projectTVLs: Optional<StakingProjectsApiResponse>,
) => {
    return projects
        .map(project => {
            const projectTvl = projectTVLs?.[project.id]
            const tvlInMicroAlgos = parseTvlValue(projectTvl?.tvl_in_algo)

            return {
                ...project,
                tvlInAlgo: microAlgosToAlgos(tvlInMicroAlgos),
                tvlInUsd: parseTvlValue(projectTvl?.tvl_in_usd),
            }
        })
        .sort((a, b) => b.tvlInAlgo.minus(a.tvlInAlgo).toNumber())
}

/**
 * `locale` is a parameter rather than read from i18next here because this
 * package must not depend on react-i18next (same boundary as
 * useWalletConnectHandoffResolver). Callers in the app pass the reactive value
 * from `useLanguage()`, which is what makes the list re-resolve when the user
 * switches language; omitting it falls back to the non-reactive
 * `getActiveLocale()`, which is correct on first render but will not update.
 */
export const useStakingProjectsQuery = (
    locale?: string,
): UseStakingProjectsQueryResult => {
    const { network } = useNetwork()
    const remoteConfigService = useRemoteConfig()

    const remoteProjectsI18nConfig = remoteConfigService.getStringValue(
        RemoteConfigKeys.staking_projects_i18n,
    )

    // Parser only throws on invalid JSON / schema. Catch here so a malformed
    // remote config payload surfaces as the hook's error state instead of
    // crashing the entire screen via React's render boundary.
    const parsedConfig = useMemo<{
        projects: StakingProjectInfo[]
        error: Nullable<Error>
    }>(() => {
        try {
            return {
                projects: parseStakingProjectsI18nConfig(
                    remoteProjectsI18nConfig,
                    locale,
                ),
                error: null,
            }
        } catch (err) {
            const error = toError(err)
            logger.warn('Failed to parse staking projects remote config', {
                source: 'useStakingProjectsQuery',
                error,
            })
            return { projects: [], error }
        }
    }, [remoteProjectsI18nConfig, locale])

    // Skip the TVL request when we already know the config is broken — the
    // result would be discarded by mapProjects anyway.
    const query = useQuery({
        queryKey: getStakingProjectsQueryKey(network),
        queryFn: () => fetchStakingProjectsInfo(network),
        enabled: !parsedConfig.error,
    })

    const projects = useMemo(
        () => mapProjects(parsedConfig.projects, query.data),
        [parsedConfig.projects, query.data],
    )

    const queryError = query.error instanceof Error ? query.error : null
    const error = parsedConfig.error ?? queryError

    const refetch = () => {
        void query.refetch()
    }

    // Paused offline with no cached data yet — the surface should render an
    // offline state instead of a permanent loading skeleton. Paused
    // background refetches with cached data do NOT count as paused.
    const isPaused = query.fetchStatus === 'paused' && query.data === undefined

    return {
        data: projects,
        // Skip the loading state once a parser error is known synchronously —
        // otherwise the screen would render skeletons before flipping to error.
        // Also skip it while paused offline — otherwise it stays true forever.
        isLoading: query.isPending && !isPaused && !parsedConfig.error,
        isError: error !== null,
        isPaused,
        error,
        refetch,
    }
}
