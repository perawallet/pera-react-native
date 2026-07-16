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

import { useRoute, type RouteProp } from '@react-navigation/native'

import { PWScreen, PWText } from '@components/core'
import { BaseErrorBoundary } from '@components/BaseErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'

import { getPreviewEntry } from '../gallery-catalog'

import type { DeveloperSettingsStackParamsList } from '@modules/settings/routes'

export const GalleryComponentPreviewScreen = () => {
    const route =
        useRoute<
            RouteProp<DeveloperSettingsStackParamsList, 'GalleryPreview'>
        >()
    const { t } = useLanguage()
    const entry = getPreviewEntry(route.params.entryId)

    if (!entry) {
        return (
            <PWScreen testID='gallery_preview_screen'>
                <PWText variant='body'>
                    Preview not found: {route.params.entryId}
                </PWText>
            </PWScreen>
        )
    }

    return (
        <PWScreen testID='gallery_preview_screen'>
            <BaseErrorBoundary t={t}>{entry.render()}</BaseErrorBoundary>
        </PWScreen>
    )
}
