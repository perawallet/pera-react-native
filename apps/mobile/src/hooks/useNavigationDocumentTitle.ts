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
import type { I18nKey } from '@perawallet/wallet-core-chain-contract'
import { translateIfKey } from '@i18n/translateIfKey'
import { useLanguage } from './useLanguage'

type UseNavigationDocumentTitleParams = {
    /**
     * For a root tree: the title an untitled screen gets. Without it the
     * screen keeps the current title, so a nested tree doesn't overwrite its
     * parent's.
     */
    fallback?: I18nKey
}

/**
 * For a NavigationContainer's `documentTitle`: screen titles are i18n keys,
 * which react-navigation would otherwise write to the web window's title as
 * they are.
 */
export const useNavigationDocumentTitle = ({
    fallback,
}: UseNavigationDocumentTitleParams = {}): DocumentTitleOptions => {
    const { t } = useLanguage()
    return useMemo(
        () => ({
            formatter: options => {
                const title = options?.title ?? fallback
                return title ? translateIfKey(t, title) : document.title
            },
        }),
        [t, fallback],
    )
}
