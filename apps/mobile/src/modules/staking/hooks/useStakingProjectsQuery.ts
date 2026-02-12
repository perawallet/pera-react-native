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
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { STAKING_PROJECTS } from '../constants'
import type { StakingProject, StakingProjectsApiResponse } from '../models'
import { fetchStakingProjectsInfo } from './endpoints'
import { getStakingProjectsQueryKey } from './queryKeys'

type UseStakingProjectsQueryResult = {
    projects: StakingProject[]
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

const parseTvlValue = (value?: string) => {
    const parsedValue = Number(value ?? '0')
    return Number.isFinite(parsedValue) ? parsedValue : 0
}

const mapProjects = (projectTVLs: StakingProjectsApiResponse | undefined) => {
    return STAKING_PROJECTS.map(project => {
        const projectTvl = projectTVLs?.[project.id]
        const tvlInMicroAlgos = parseTvlValue(projectTvl?.tvl_in_algo)

        return {
            ...project,
            tvlInAlgo: microAlgosToAlgos(tvlInMicroAlgos).toNumber(),
            tvlInUsd: parseTvlValue(projectTvl?.tvl_in_usd),
        }
    }).sort((a, b) => b.tvlInAlgo - a.tvlInAlgo)
}

export const useStakingProjectsQuery = (): UseStakingProjectsQueryResult => {
    const { network } = useNetwork()
    const query = useQuery({
        queryKey: getStakingProjectsQueryKey(network),
        queryFn: () => fetchStakingProjectsInfo(network),
    })

    const projects = useMemo(() => mapProjects(query.data), [query.data])
    const error = query.error instanceof Error ? query.error : null

    const refetch = () => {
        void query.refetch()
    }

    return {
        projects,
        isLoading: query.isPending,
        isError: query.isError,
        error,
        refetch,
    }
}
