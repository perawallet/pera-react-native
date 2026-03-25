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

import { useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useSelectedAccountAddress } from './useSelectedAccountAddress'
import { getAccountBalancesQueryKey } from './querykeys'

type UseActiveAccountBalanceInvalidatorResult = {
    invalidateActiveAccount: () => void
}

export const useActiveAccountBalanceInvalidator =
    (): UseActiveAccountBalanceInvalidatorResult => {
        const queryClient = useQueryClient()
        const { network } = useNetwork()
        const { selectedAccountAddress } = useSelectedAccountAddress()

        const invalidateActiveAccount = () => {
            if (selectedAccountAddress === null) return
            queryClient.invalidateQueries({
                queryKey: getAccountBalancesQueryKey(
                    selectedAccountAddress,
                    network,
                ),
            })
        }

        return { invalidateActiveAccount }
    }
