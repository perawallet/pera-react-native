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

import { useLanguage } from '@hooks/useLanguage'
import type { CardPickerSheetCopy } from '../CardPickerSheet'

export const useOptionPickerCopy = (): CardPickerSheetCopy => {
    const { t } = useLanguage()
    return {
        searchPlaceholder: t('peraCard.option_picker.search_placeholder'),
        emptyTitle: t('peraCard.option_picker.empty_title'),
        emptyBody: t('peraCard.option_picker.empty_body'),
        errorTitle: t('peraCard.option_picker.error_title'),
        errorBody: t('peraCard.option_picker.error_body'),
        retry: t('peraCard.option_picker.retry'),
    }
}
