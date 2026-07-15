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

import { useMemo } from 'react'
import { useBannersQuery } from './useBannersQuery'
import { useBannersStore } from '../store'
import type { Banner } from '../models'

export type UseVisibleBannersResult = {
    banners: Banner[]
    totalCount: number
    // A forced banner is server-flagged with auto_open_mode === 'force'. When
    // one is present the visible set is *only* that banner (others are
    // suppressed) and it bypasses client-side dismissal entirely.
    forcedBanner: Banner | null
    isLoading: boolean
    isError: boolean
}

export const useVisibleBanners = (): UseVisibleBannersResult => {
    const { banners, isLoading, isError } = useBannersQuery()
    const dismissedBannerIds = useBannersStore(
        state => state.dismissedBannerIds,
    )

    const { visible, forcedBanner } = useMemo(() => {
        const forced = banners.find(b => b.autoOpenMode === 'force')
        if (forced) {
            return { visible: [forced], forcedBanner: forced }
        }
        return {
            visible: banners.filter(b => !dismissedBannerIds.includes(b.id)),
            forcedBanner: null,
        }
    }, [banners, dismissedBannerIds])

    return {
        banners: visible,
        totalCount: visible.length,
        forcedBanner,
        isLoading,
        isError,
    }
}
