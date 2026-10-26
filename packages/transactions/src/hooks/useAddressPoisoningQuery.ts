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

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    assessAddressPoisoning,
    type AddressPoisoningInput,
    type AddressPoisoningRisk,
} from '../address-poisoning'
import { transactionQueryKeys } from './querykeys'

export type UseAddressPoisoningQueryResult = {
    assessRecipient: (
        input: AddressPoisoningInput,
    ) => Promise<Nullable<AddressPoisoningRisk>>
}

export const useAddressPoisoningQuery = (): UseAddressPoisoningQueryResult => {
    const queryClient = useQueryClient()

    const assessRecipient = useCallback(
        (input: AddressPoisoningInput) =>
            queryClient.fetchQuery({
                queryKey: transactionQueryKeys.addressPoisoning(
                    input.recipient,
                    input.scope,
                ),
                queryFn: () => assessAddressPoisoning(input),
                // The contacts and history it reads can change between picks.
                staleTime: 0,
                gcTime: 0,
                retry: false,
            }),
        [queryClient],
    )

    return { assessRecipient }
}
