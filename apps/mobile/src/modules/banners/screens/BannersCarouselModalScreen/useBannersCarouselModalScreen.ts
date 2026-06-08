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

import { useCallback, useEffect, useMemo } from 'react'
import { BackHandler } from 'react-native'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import {
    useVisibleBanners,
    useBannersStore,
    type Banner,
} from '@perawallet/wallet-core-banners'
import type { RootStackParamList } from '@routes/types'
import { useBannerLinkRouter } from '../../hooks'

export type UseBannersCarouselModalScreenResult = {
    banners: Banner[]
    initialIndex: number
    isDismissable: boolean
    isClosable: boolean
    onClose: () => void
    onPressCTA: (banner: Banner) => void
    onDismiss: (banner: Banner) => void
}

type ModalRouteProp = RouteProp<RootStackParamList, 'BannersCarouselModal'>

export const useBannersCarouselModalScreen =
    (): UseBannersCarouselModalScreenResult => {
        const navigation = useNavigation()
        const route = useRoute<ModalRouteProp>()
        const focusedBannerId = route.params?.bannerId
        const { banners, forcedBanner } = useVisibleBanners()
        const dismissBanner = useBannersStore(state => state.dismissBanner)
        const { route: routeUrl } = useBannerLinkRouter()

        const isForced = forcedBanner !== null
        const isDismissable = !isForced
        const isClosable = !isForced

        const bannersToShow = useMemo(() => {
            if (!isForced) return banners
            const forced = banners.find(b => b.id === forcedBanner!.id)
            return forced ? [forced] : banners
        }, [banners, isForced, forcedBanner])

        const initialIndex = useMemo(() => {
            if (focusedBannerId === undefined || isForced) return 0
            const idx = banners.findIndex(b => b.id === focusedBannerId)
            return idx >= 0 ? idx : 0
        }, [banners, focusedBannerId, isForced])

        const onClose = useCallback(() => {
            if (!isClosable) return
            if (navigation.canGoBack()) navigation.goBack()
        }, [navigation, isClosable])

        const onPressCTA = useCallback(
            (banner: Banner) => {
                routeUrl({
                    url: banner.buttonUrl,
                    isExternal: banner.isButtonUrlExternal,
                })
            },
            [routeUrl],
        )

        const onDismiss = useCallback(
            (banner: Banner) => {
                if (!isDismissable) return
                dismissBanner(banner.id)
            },
            [dismissBanner, isDismissable],
        )

        // Auto-close once the carousel is empty (only when closing is allowed).
        useEffect(() => {
            if (!isClosable) return
            if (banners.length === 0) onClose()
        }, [banners.length, onClose, isClosable])

        // When a banner is forced, disable iOS swipe-down-to-dismiss and
        // intercept the Android hardware back button. Combined with the
        // already-hidden close X, this leaves the user no escape until they
        // tap the CTA — matching the intent for severe-security prompts.
        useEffect(() => {
            navigation.setOptions({ gestureEnabled: isClosable })
        }, [navigation, isClosable])

        useEffect(() => {
            if (isClosable) return
            const sub = BackHandler.addEventListener(
                'hardwareBackPress',
                () => true,
            )
            return () => sub.remove()
        }, [isClosable])

        return {
            banners: bannersToShow,
            initialIndex,
            isDismissable,
            isClosable,
            onClose,
            onPressCTA,
            onDismiss,
        }
    }
