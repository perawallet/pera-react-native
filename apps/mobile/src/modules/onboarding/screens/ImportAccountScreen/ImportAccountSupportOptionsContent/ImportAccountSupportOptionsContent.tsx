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

import React from 'react'
import { PWListItem, PWView } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useTranslation } from 'react-i18next'
import { useStyles } from './styles'

export type ImportAccountSupportOptionsContentResult =
    | 'paste'
    | 'scan'
    | 'learn-more'

export type ImportAccountSupportOptionsContentProps = Record<string, never>

export const ImportAccountSupportOptionsContent = () => {
    const styles = useStyles()
    const { t } = useTranslation()
    const { resolve } =
        useBottomSheetResult<ImportAccountSupportOptionsContentResult>()

    return (
        <>
            <SheetHeader
                title={t('onboarding.import_account.support_options.title')}
            />

            <PWView style={styles.optionsContainer}>
                <PWListItem
                    icon='text-document'
                    title={t(
                        'onboarding.import_account.support_options.paste_passphrase',
                    )}
                    onPress={() => resolve('paste')}
                />
                <PWListItem
                    icon='camera'
                    title={t(
                        'onboarding.import_account.support_options.scan_qr',
                    )}
                    onPress={() => resolve('scan')}
                />
                <PWListItem
                    icon='info'
                    title={t(
                        'onboarding.import_account.support_options.learn_more',
                    )}
                    onPress={() => resolve('learn-more')}
                />
            </PWView>
        </>
    )
}
