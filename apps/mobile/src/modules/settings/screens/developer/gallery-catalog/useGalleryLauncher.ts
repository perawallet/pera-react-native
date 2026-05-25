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
import { useNavigation } from '@react-navigation/native'

import { useBottomSheet } from '@modules/bottom-sheet'

import type { GalleryEntry } from './types'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ParamListBase } from '@react-navigation/native'

type UseGalleryLauncherResult = {
    launch: (entry: GalleryEntry) => void
}

export const useGalleryLauncher = (): UseGalleryLauncherResult => {
    const navigation =
        useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { request, requestByType } = useBottomSheet()

    const launch = useCallback(
        (entry: GalleryEntry) => {
            const { launch: l } = entry
            switch (l.kind) {
                case 'navigate':
                    navigation.navigate(l.target.name, l.target.params)
                    break
                case 'sheet':
                    void request(l.request())
                    break
                case 'sheetByType':
                    void requestByType(l.type, l.props, l.options)
                    break
                case 'action':
                    l.run()
                    break
                case 'preview':
                    navigation.navigate('GalleryPreview', { entryId: entry.id })
                    break
            }
        },
        [navigation, request, requestByType],
    )

    return { launch }
}
