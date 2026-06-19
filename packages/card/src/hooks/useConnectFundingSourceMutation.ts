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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    connectFundingSource,
    type ConnectFundingSourceResult,
} from '../api/onboarding'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

export type ConnectFundingSourceVariables = { address: string }

export type UseConnectFundingSourceMutationResult = CardMutationResult<
    ConnectFundingSourceVariables,
    ConnectFundingSourceResult
>

export const useConnectFundingSourceMutation =
    (): UseConnectFundingSourceMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            ConnectFundingSourceResult,
            Error,
            ConnectFundingSourceVariables
        >({
            mutationFn: ({ address }) =>
                connectFundingSource({ address, network }),
            // Persist the connected account address (not the fabricated id) — the
            // checklist's Connect Funds row reads it from the store to render its
            // done state. No query invalidation: the funding source isn't backed
            // by a card query yet, so the store update alone re-renders the row.
            onSuccess: (_result, { address }) => {
                useCardStore
                    .getState()
                    .setConnectedFundingSourceAddress(address)
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
