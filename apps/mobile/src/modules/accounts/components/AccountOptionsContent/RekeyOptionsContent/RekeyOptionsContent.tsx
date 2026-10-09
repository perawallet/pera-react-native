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
import {
    useRekeyOptionsContent,
    type RekeyTargetType,
} from './useRekeyOptionsContent'

export type { RekeyTargetType } from './useRekeyOptionsContent'

export const RekeyOptionsContent = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<RekeyTargetType>()
    const { rows } = useRekeyOptionsContent()

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={<SheetHeader title={t('account_options.rekey_account')} />}
        >
            <PWView style={styles.optionsContainer}>
                {rows.map(row => (
                    <PanelButton
                        key={row.testID}
                        testID={row.testID}
                        title={t(row.titleKey)}
                        description={t(row.descriptionKey)}
                        titleWeight='h3'
                        leftIcon={row.icon}
                        onPress={() => resolve(row.target)}
                    />
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
