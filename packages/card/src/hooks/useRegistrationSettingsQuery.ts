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

import { useQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchRegistrationSettings } from '../api/onboarding'
import type { RegistrationSettings } from '../models'
import { cardQueryKeys } from './querykeys'

export type UseRegistrationSettingsQueryResult = {
    settings: Nullable<RegistrationSettings>
    isLoading: boolean
    isError: boolean
}

export const useRegistrationSettingsQuery =
    (): UseRegistrationSettingsQueryResult => {
        const { network } = useNetwork()

        const query = useQuery({
            queryKey: cardQueryKeys.registrationSettings(network),
            queryFn: ({ signal }) =>
                fetchRegistrationSettings({ network, signal }),
            staleTime: config.reactQueryLongLivedStaleTime,
        })

        return {
            settings: query.data ?? null,
            isLoading: query.isLoading,
            isError: query.isError,
        }
    }
