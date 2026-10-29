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

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalKeySeed } from '@perawallet/wallet-core-accounts'
import { PWSheetLayout, PWView } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { SheetOptionCard } from '../SheetOptionCard'
import {
    useImportOptionsContent,
    type UseImportOptionsContentParams,
} from './useImportOptionsContent'
import { useStyles } from './styles'

export type ImportOptionsContentResult = LocalKeySeed

export type ImportOptionsContentProps = UseImportOptionsContentParams

export const ImportOptionsContent = (props: ImportOptionsContentProps) => {
    const styles = useStyles()
    const { t } = useTranslation()
    const { resolve } = useBottomSheetResult<ImportOptionsContentResult>()
    const { options } = useImportOptionsContent(props)

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('onboarding.import_options.title')}
                    showClose
                />
            }
        >
            <PWView style={styles.optionsContainer}>
                {options.map(option => (
                    <SheetOptionCard
                        key={option.testID}
                        testID={option.testID}
                        title={t(option.titleKey)}
                        description={t(option.descriptionKey)}
                        chip={
                            option.chipKey && {
                                label: t(option.chipKey),
                                variant: option.chipVariant,
                            }
                        }
                        onPress={() => resolve(option.seed)}
                    />
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
