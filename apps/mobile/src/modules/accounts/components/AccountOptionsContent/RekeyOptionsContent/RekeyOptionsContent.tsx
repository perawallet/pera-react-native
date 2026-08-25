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

import { PWSheetLayout, PWView } from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

/**
 * Shared accounts never reach this sheet — they have a single destination
 * type, so their menu row goes straight to the intro screen.
 */
export type RekeyTargetType = 'ledger' | 'standard'

export const RekeyOptionsContent = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<RekeyTargetType>()

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={
                <SheetHeader title={t('account_options.rekey_options_title')} />
            }
        >
            <PWView style={styles.optionsContainer}>
                <PanelButton
                    testID='rekey_option_ledger'
                    title={t('account_options.rekey_option_ledger_title')}
                    description={t(
                        'account_options.rekey_option_ledger_description',
                    )}
                    titleWeight='h3'
                    leftIcon='ledger'
                    onPress={() => resolve('ledger')}
                />
                <PanelButton
                    testID='rekey_option_standard'
                    title={t('account_options.rekey_option_standard_title')}
                    description={t(
                        'account_options.rekey_option_standard_description',
                    )}
                    titleWeight='h3'
                    leftIcon='wallet'
                    onPress={() => resolve('standard')}
                />
            </PWView>
        </PWSheetLayout>
    )
}
