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

import {
    PWButton,
    PWCheckbox,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { usePassphraseAcknowledgeContent } from './usePassphraseAcknowledgeContent'
import { useStyles } from './styles'

export type PassphraseAcknowledgeContentProps = {
    testID?: string
}

export type PassphraseAcknowledgeContentResult = 'confirm'

const ACKNOWLEDGE_ROW_KEYS = [
    'view_passphrase.acknowledge.row_screen',
    'view_passphrase.acknowledge.row_share',
    'view_passphrase.acknowledge.row_lose',
    'view_passphrase.acknowledge.row_pera',
] as const

export const PassphraseAcknowledgeContent = ({
    testID = 'passphrase_acknowledge_bottom_sheet',
}: PassphraseAcknowledgeContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve, dismiss } =
        useBottomSheetResult<PassphraseAcknowledgeContentResult>()
    const { checked, allChecked, toggle } = usePassphraseAcknowledgeContent({
        rowCount: ACKNOWLEDGE_ROW_KEYS.length,
    })

    return (
        <PWView style={styles.container}>
            <SheetHeader title={t('view_passphrase.acknowledge.title')} />

            <BottomSheetScrollView
                style={styles.scroll}
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
                testID={testID}
            >
                <PWIcon
                    name='account-rekeyed'
                    variant='positive'
                    size='xxl'
                    style={styles.icon}
                />
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('view_passphrase.acknowledge.description')}
                </PWText>
                <PWView style={styles.rows}>
                    {ACKNOWLEDGE_ROW_KEYS.map((key, index) => (
                        <PWTouchableOpacity
                            key={key}
                            style={[
                                styles.row,
                                index !== 0
                                    ? styles.separatorBorder
                                    : undefined,
                            ]}
                            onPress={() => toggle(index)}
                            testID={`${testID}_row_${index}`}
                        >
                            <PWText
                                variant='body'
                                style={styles.rowText}
                            >
                                {t(key)}
                            </PWText>
                            <PWCheckbox
                                checked={checked[index]}
                                onPress={() => toggle(index)}
                            />
                        </PWTouchableOpacity>
                    ))}
                </PWView>
                <PWView style={styles.actions}>
                    <PWButton
                        variant='primary'
                        title={t('view_passphrase.acknowledge.cta_reveal')}
                        onPress={() => resolve('confirm')}
                        isDisabled={!allChecked}
                        testID={`${testID}_reveal`}
                    />
                    <PWButton
                        variant='secondary'
                        title={t('view_passphrase.acknowledge.cta_cancel')}
                        onPress={dismiss}
                        testID={`${testID}_cancel`}
                    />
                </PWView>
            </BottomSheetScrollView>
        </PWView>
    )
}
