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

import { PWRadioButton, PWSheetLayout } from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useFavoritesCategorySheet } from './useFavoritesCategorySheet'

/** Picks the favorites category (Figma "Categories"). */
export const FavoritesCategorySheet = () => {
    const { t } = useLanguage()
    const sheet = useFavoritesCategorySheet()
    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('discover.favorites.filter.categories_title')}
                    showClose
                    onClose={sheet.close}
                />
            }
            testID='discover_favorites_categories'
        >
            {sheet.options.map(option => (
                <PWRadioButton
                    key={option.value ?? 'all'}
                    title={option.label}
                    isSelected={sheet.selected === option.value}
                    onPress={() => sheet.select(option.value)}
                    testID={`discover_favorites_category_${option.value ?? 'all'}`}
                />
            ))}
        </PWSheetLayout>
    )
}
