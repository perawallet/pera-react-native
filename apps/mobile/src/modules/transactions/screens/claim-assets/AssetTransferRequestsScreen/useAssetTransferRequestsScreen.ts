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

import { useCallback, useEffect } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    useArc59AssetRequestsQuery,
    type Arc59AssetRequest,
} from '@perawallet/wallet-core-asa-inbox'
import { useClaimAssets } from '@modules/transactions/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { MessagesStackParamList } from '@modules/messages/routes/types'

type UseAssetTransferRequestsScreenResult = {
    assetRequests: Arc59AssetRequest[]
    isPending: boolean
    isUnavailableOnNetwork: boolean
    handleItemPress: (index: number) => void
}

export const useAssetTransferRequestsScreen =
    (): UseAssetTransferRequestsScreenResult => {
        const { push } = useAppNavigation()
        const route =
            useRoute<
                RouteProp<MessagesStackParamList, 'AssetTransferRequests'>
            >()
        const { accountAddress, setAccountAddress, setAssetRequests } =
            useClaimAssets()

        useEffect(() => {
            setAccountAddress(route.params.item.address)
        }, [route.params.item.address, setAccountAddress])
        const {
            data: assetRequests,
            isPending,
            isUnavailableOnNetwork,
        } = useArc59AssetRequestsQuery(accountAddress)

        const handleItemPress = useCallback(
            (index: number) => {
                if (!assetRequests) return
                setAssetRequests(assetRequests)
                push('Messages', {
                    screen: 'AssetClaimDetail',
                    params: {
                        assetIndex: index,
                    },
                })
            },
            [push, assetRequests, setAssetRequests],
        )

        return {
            assetRequests: assetRequests ?? [],
            isPending,
            isUnavailableOnNetwork,
            handleItemPress,
        }
    }
