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

import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { PassphraseQuizItem } from './PassphraseQuizItem'
import { useCloudBackupVerifyScreen } from './useCloudBackupVerifyScreen'
import { useStyles } from './styles'

export const CloudBackupVerifyScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { items, onSelect, onSubmit, isFilled, isEnabling } =
        useCloudBackupVerifyScreen()

    return (
        <PWScreen
            testID='cloud_backup_verify_screen'
            footer={
                <PWButton
                    variant='primary'
                    title={t('cloud_backup.verify.proceed')}
                    isDisabled={!isFilled || isEnabling}
                    isLoading={isEnabling}
                    onPress={onSubmit}
                    testID='cloud_backup_verify_proceed_button'
                />
            }
        >
            <PWView style={styles.content}>
                <PWText variant='bodyLarge'>
                    {t('cloud_backup.verify.description')}
                </PWText>

                <PWView style={styles.quizList}>
                    {items.map((item, index) => (
                        <PassphraseQuizItem
                            key={`${item.position}-${index}`}
                            position={item.position}
                            options={item.options}
                            selectedWord={item.selectedWord}
                            onSelect={word => onSelect(index, word)}
                            testID={`cloud_backup_verify_item_${index}`}
                        />
                    ))}
                </PWView>
            </PWView>
        </PWScreen>
    )
}
