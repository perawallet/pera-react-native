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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toggleAssetFavorite } from './endpoints'
import { getAssetDetailsQueryKey } from './querykeys'
import { type AssetResponse } from '../models'
import { type Network } from '@perawallet/wallet-core-shared'

type UseToggleAssetFavoriteMutationParams = {
  assetID: string
  deviceId: string
  enabled: boolean
  network: Network
}

type UseToggleAssetFavoriteMutationResult = {
  toggleAssetFavorite: (params: UseToggleAssetFavoriteMutationParams) => void
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
}

export const useToggleAssetFavoriteMutation = (): UseToggleAssetFavoriteMutationResult => {
  const queryClient = useQueryClient()

  const mutation = useMutation<
    AssetResponse,
    Error,
    UseToggleAssetFavoriteMutationParams
  >({
    mutationFn: toggleAssetFavorite,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: getAssetDetailsQueryKey(`${data.asset_id}`),
      })
    },
  })

  return {
    toggleAssetFavorite: mutation.mutate,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
  }
}
