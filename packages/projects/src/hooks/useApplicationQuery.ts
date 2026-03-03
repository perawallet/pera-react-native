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

import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { fetchApplication } from '../api/applications'
import { projectQueryKeys } from './querykeys'
import type { PeraApplication } from '../models/types'
import { useNetwork } from '@perawallet/wallet-extension-network'

export type UseApplicationQueryParams = {
    applicationId: string
    isEnabled?: boolean
}

export type UseApplicationQueryResult = UseQueryResult<PeraApplication | null>

export const useApplicationQuery = (
    params: UseApplicationQueryParams,
): UseApplicationQueryResult => {
    const { applicationId, isEnabled = true } = params
    const { network } = useNetwork()

    return useQuery({
        queryKey: projectQueryKeys.application(applicationId),
        queryFn: async ({ signal }) =>
            fetchApplication({
                applicationId,
                network,
                signal,
            }),
        enabled: isEnabled && !!applicationId.length,
    })
}
