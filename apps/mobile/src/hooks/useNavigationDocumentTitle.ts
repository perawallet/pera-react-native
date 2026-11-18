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
import type { DocumentTitleOptions } from '@react-navigation/native'
import { useLanguage } from './useLanguage'

/**
 * For a NavigationContainer's `documentTitle`: screen titles are i18n keys,
 * which react-navigation would otherwise write to the web window's title as
 * they are. A screen without a title keeps the one another tree set.
 */
export const useNavigationDocumentTitle = (): DocumentTitleOptions => {
    const { t } = useLanguage()
    return useMemo(
        () => ({
            formatter: options =>
                options?.title ? t(options.title) : document.title,
        }),
        [t],
    )
}
