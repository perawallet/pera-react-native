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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useVisibleBanners, type Banner } from '@perawallet/wallet-core-banners'
import { trackEvent, BannersEvent, AnalyticsMetadataKey } from '@analytics'
import type { RootStackParamList } from '@routes/types'

export type UseHomeBannersStripResult = {
    isVisible: boolean
    banners: Banner[]
    current: Banner | null
    additionalCount: number
    onPress: () => void
}

export const useHomeBannersStrip = (): UseHomeBannersStripResult => {
    const { banners } = useVisibleBanners()
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>()

    const onPress = useCallback(() => {
        trackEvent(BannersEvent.Spot, {
            [AnalyticsMetadataKey.BannerName]: String(banners[0]?.id ?? ''),
        })
        navigation.navigate('BannersCarouselModal')
    }, [navigation, banners])

    // No auto-open effect here any more. This used to navigate to the carousel
    // modal the moment banners loaded, with no knowledge of the terms gate or
    // the PIN prompt, which is how a migrating user met three unrelated
    // interruptions in whatever order their triggers happened to fire.
    // The prompt container owns that decision now; this hook is
    // only the strip, and only opens the modal when the user taps it.

    // The strip surfaces the first visible banner only — extras are signalled
    // by the "+N" badge and revealed when the user opens the modal carousel.
    // Auto-rotation was removed because it competed with the periodic
    // attention-pulse animation and made the strip feel busy.
    return {
        isVisible: banners.length > 0,
        banners,
        current: banners[0] ?? null,
        additionalCount: Math.max(banners.length - 1, 0),
        onPress,
    }
}
