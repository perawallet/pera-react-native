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

import { useCallback } from 'react'
import {
    useSpotBannersQuery,
    useDismissSpotBannerMutation,
    type SpotBanner,
} from '@perawallet/wallet-core-banners'
import { useBannerLinkRouter } from '../../hooks'

export type UseMessagesSpotBannersResult = {
    isVisible: boolean
    spotBanners: SpotBanner[]
    onPress: (banner: SpotBanner) => void
    onDismiss: (banner: SpotBanner) => void
}

export const useMessagesSpotBanners = (): UseMessagesSpotBannersResult => {
    const { spotBanners } = useSpotBannersQuery()
    const { mutate: dismiss } = useDismissSpotBannerMutation()
    const { route } = useBannerLinkRouter()

    const onPress = useCallback(
        (banner: SpotBanner) =>
            route({ url: banner.url, isExternal: banner.isUrlExternal }),
        [route],
    )

    const onDismiss = useCallback(
        (banner: SpotBanner) => dismiss(banner.id),
        [dismiss],
    )

    return {
        isVisible: spotBanners.length > 0,
        spotBanners,
        onPress,
        onDismiss,
    }
}
