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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'

import { stakingProjectsApiResponseSchema } from '../models/schema'
import type { StakingProjectsApiResponse } from '../models'

const STAKING_PROJECTS_INFORMATION_ENDPOINT =
    '/v1/staking/projects-information/'

export const fetchStakingProjectsInfo = async (network: Network) => {
    const response = await queryClient<StakingProjectsApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: STAKING_PROJECTS_INFORMATION_ENDPOINT,
    })

    return stakingProjectsApiResponseSchema.parse(response.data)
}
