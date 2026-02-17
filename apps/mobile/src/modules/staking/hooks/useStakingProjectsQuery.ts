/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    useNetwork,
    useRemoteConfigService,
} from '@perawallet/wallet-core-platform-integration'
import type {
    StakingProject,
    StakingProjectInfo,
    StakingProjectsApiResponse,
} from '../models'
import { fetchStakingProjectsInfo } from './endpoints'
import { getStakingProjectsQueryKey } from './queryKeys'
import { parseStakingProjectsConfig } from '../utils'

type UseStakingProjectsQueryResult = {
    projects: StakingProject[]
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

const parseTvlValue = (value?: string | null): Decimal => {
    try {
        return new Decimal(value ?? '0')
    } catch {
        return new Decimal(0)
    }
}

const mapProjects = (
    projects: StakingProjectInfo[],
    projectTVLs: StakingProjectsApiResponse | undefined,
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

export const useStakingProjectsQuery = (): UseStakingProjectsQueryResult => {
    const { network } = useNetwork()
    const remoteConfigService = useRemoteConfigService()
    const query = useQuery({
        queryKey: getStakingProjectsQueryKey(network),
        queryFn: () => fetchStakingProjectsInfo(network),
    })

    const remoteProjectsConfig = remoteConfigService.getStringValue(
        RemoteConfigKeys.staking_projects,
    )

    const parsedProjects = useMemo(() => {
        try {
            return {
                projects: parseStakingProjectsConfig(remoteProjectsConfig),
                error: null,
            }
        } catch (error) {
            return {
                projects: [] as StakingProjectInfo[],
                error:
                    error instanceof Error
                        ? error
                        : new Error('Failed to parse staking projects config'),
            }
        }
    }, [remoteProjectsConfig])

    const projects = useMemo(() => {
        if (parsedProjects.error) {
            return []
        }
        return mapProjects(parsedProjects.projects, query.data)
    }, [parsedProjects.error, parsedProjects.projects, query.data])

    const queryError = query.error instanceof Error ? query.error : null
    const error = parsedProjects.error ?? queryError

    const refetch = () => {
        void query.refetch()
    }

    return {
        projects,
        isLoading: query.isPending && !parsedProjects.error,
        isError: !!parsedProjects.error || query.isError,
        error,
        refetch,
    }
}
