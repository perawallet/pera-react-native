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

import { useMemo } from 'react'
import { useRoute } from '@react-navigation/native'

import { getCategory } from '../gallery-catalog'
import { useGalleryLauncher } from '../gallery-catalog/useGalleryLauncher'
import { useGalleryToolHandlers } from '../gallery-catalog/useGalleryToolHandlers'

import type { GallerySection, GalleryEntry } from '../gallery-catalog'
import type { RouteProp } from '@react-navigation/native'
import type { DeveloperSettingsStackParamsList } from '@modules/settings/routes'

type UseGalleryCategoryScreenResult = {
    title: string
    sections: GallerySection[]
    onItemPress: (entry: GalleryEntry) => void
}

export const useGalleryCategoryScreen = (): UseGalleryCategoryScreenResult => {
    const route =
        useRoute<
            RouteProp<DeveloperSettingsStackParamsList, 'GalleryCategory'>
        >()
    const { launch } = useGalleryLauncher()
    const tools = useGalleryToolHandlers()

    const category = useMemo(
        () => getCategory(route.params.categoryId, tools),
        [route.params.categoryId, tools],
    )

    const sections = useMemo(
        () => (category?.sections ?? []).filter(s => s.items.length > 0),
        [category],
    )

    return {
        title: category?.title ?? 'Gallery',
        sections,
        onItemPress: launch,
    }
}
