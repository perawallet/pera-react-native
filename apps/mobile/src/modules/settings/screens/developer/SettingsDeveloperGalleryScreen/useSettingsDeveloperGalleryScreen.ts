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

import { useCallback, useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'

import { getCategories } from '../gallery-catalog'

import type { GalleryCategory, GalleryCategoryId } from '../gallery-catalog'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ParamListBase } from '@react-navigation/native'

type UseSettingsDeveloperGalleryScreenResult = {
    categories: GalleryCategory[]
    openCategory: (id: GalleryCategoryId) => void
}

const NOOP_TOOLS = {
    onSeedContacts: () => undefined,
}

export const useSettingsDeveloperGalleryScreen =
    (): UseSettingsDeveloperGalleryScreenResult => {
        const navigation =
            useNavigation<NativeStackNavigationProp<ParamListBase>>()

        const categories = useMemo(() => getCategories(NOOP_TOOLS), [])

        const openCategory = useCallback(
            (id: GalleryCategoryId) =>
                navigation.navigate('GalleryCategory', { categoryId: id }),
            [navigation],
        )

        return { categories, openCategory }
    }
