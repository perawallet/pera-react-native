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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { fetchAssetMetadata } from '@perawallet/wallet-core-assets'
import { addAccountToken, insertAssetHolding } from '../db'
import { invalidateAccountQueriesForAddresses } from './querykeys'

type AddTokenVariables = {
    accountAddress: string
    scope: ChainScope
    assetId: string
}

export type UseAddTokenMutationResult = {
    addToken: (variables: AddTokenVariables) => Promise<void>
}

/** Adds a token on a chain without opt-in: a local record, no transaction. */
export const useAddTokenMutation = (): UseAddTokenMutationResult => {
    const queryClient = useQueryClient()
    const { mutateAsync } = useMutation({
        throwOnError: false,
        mutationFn: async ({
            accountAddress,
            scope,
            assetId,
        }: AddTokenVariables) => {
            // Metadata first, and a read that throws when the token can't be
            // read: a holding row without it renders as a skeleton.
            await fetchAssetMetadata(assetId, scope)
            await addAccountToken({ accountAddress, scope, assetId })
            await insertAssetHolding({ accountAddress, assetId, scope })
        },
        onSuccess: (_data, { accountAddress }) => {
            invalidateAccountQueriesForAddresses(queryClient, [accountAddress])
        },
    })
    return { addToken: mutateAsync }
}
