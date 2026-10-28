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

import { useLayoutEffect, useMemo, useRef } from 'react'
import {
    useAccountChainOptionsResolver,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isUniqueCollectible,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import {
    needsChainSelection,
    useSendFunds,
    useSendScope,
} from '@modules/transactions/hooks'
import type { SendFundsStackParamList } from './types'

type SendFundsRouteName = keyof SendFundsStackParamList

export type UseSendFundsRoutesResult = {
    /** Fixed at first render, as the navigator reads it, even once a network is picked. */
    initialRouteName: SendFundsRouteName
}

const firstRouteOf = ({
    canSelectAsset,
    isPureCollectible,
    isChainChoicePending,
}: {
    canSelectAsset: boolean
    isPureCollectible: boolean
    isChainChoicePending: boolean
}): SendFundsRouteName => {
    if (!canSelectAsset) {
        return isPureCollectible ? 'SelectDestination' : 'InputAmount'
    }
    return isChainChoicePending ? 'ChainSelection' : 'AssetSelection'
}

export const useSendFundsRoutes = (): UseSendFundsRoutesResult => {
    const scope = useSendScope()
    const account = useSelectedAccount()
    const { canSelectAsset, selectedAssetId, chainId, setChainId } =
        useSendFunds()
    const optionsOf = useAccountChainOptionsResolver('send')

    const { data: assets } = useAssetsQuery(
        scope,
        selectedAssetId ? [selectedAssetId] : [],
    )
    const selectedAsset = selectedAssetId
        ? assets.get(selectedAssetId)
        : undefined

    const options = useMemo(
        () => (account ? optionsOf(account) : []),
        [account, optionsOf],
    )
    const isChainChoice = needsChainSelection(options)
    // Capability gating can leave an account's only sendable chain different
    // from its first one, which is what the send scope falls back to.
    const soleChainId =
        canSelectAsset && chainId === undefined && !isChainChoice
            ? options[0]?.chainId
            : undefined

    useLayoutEffect(() => {
        if (soleChainId !== undefined) setChainId(soleChainId)
    }, [soleChainId, setChainId])

    const firstRoute = useRef<SendFundsRouteName>(undefined)
    firstRoute.current ??= firstRouteOf({
        canSelectAsset,
        isPureCollectible: selectedAsset
            ? isUniqueCollectible(selectedAsset)
            : false,
        isChainChoicePending: chainId === undefined && isChainChoice,
    })

    return { initialRouteName: firstRoute.current }
}
