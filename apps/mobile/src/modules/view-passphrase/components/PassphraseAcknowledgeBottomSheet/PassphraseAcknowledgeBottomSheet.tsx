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
    PWBottomSheet,
    PWButton,
    PWCheckbox,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { usePassphraseAcknowledgeBottomSheet } from './usePassphraseAcknowledgeBottomSheet'
import { useStyles } from './styles'

export type PassphraseAcknowledgeBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onConfirm: () => void
    testID?: string
}

const ACKNOWLEDGE_ROW_KEYS = [
    'view_passphrase.acknowledge.row_screen',
    'view_passphrase.acknowledge.row_share',
    'view_passphrase.acknowledge.row_lose',
    'view_passphrase.acknowledge.row_pera',
] as const

export const PassphraseAcknowledgeBottomSheet = ({
    isVisible,
    onClose,
    onConfirm,
    testID = 'passphrase_acknowledge_bottom_sheet',
}: PassphraseAcknowledgeBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { checked, allChecked, toggle } = usePassphraseAcknowledgeBottomSheet(
        {
            rowCount: ACKNOWLEDGE_ROW_KEYS.length,
            isVisible,
        },
    )

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
            testID={testID}
        >
            <PWIcon
                name='account-rekeyed'
                variant='positive'
                size='xxl'
                style={styles.icon}
            />
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('view_passphrase.acknowledge.title')}
            </PWText>
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
                            index !== 0 ? styles.separatorBorder : undefined,
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
                    onPress={onConfirm}
                    isDisabled={!allChecked}
                    testID={`${testID}_reveal`}
                />
                <PWButton
                    variant='secondary'
                    title={t('view_passphrase.acknowledge.cta_cancel')}
                    onPress={onClose}
                    testID={`${testID}_cancel`}
                />
            </PWView>
        </PWBottomSheet>
    )
}
