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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { requestCountryAvailability } from '../api/waitlist'
import { toCardMutationResult, type CardMutationResult } from './types'

export type RequestCountryAvailabilityVariables = {
    countryCode: string
    deviceId: string
}

export type UseRequestCountryAvailabilityMutationResult =
    CardMutationResult<RequestCountryAvailabilityVariables>

/**
 * Adds the device to the waitlist for an unsupported jurisdiction. The caller
 * supplies the device id (the card package doesn't depend on the device
 * package); the network is resolved here.
 */
export const useRequestCountryAvailabilityMutation =
    (): UseRequestCountryAvailabilityMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            void,
            Error,
            RequestCountryAvailabilityVariables
        >({
            mutationFn: ({ countryCode, deviceId }) =>
                requestCountryAvailability({ countryCode, deviceId, network }),
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
