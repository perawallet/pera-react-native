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

import { PWSheetLayout, PWText, PWView } from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import { useChooseCredentialsFileSheet } from './useChooseCredentialsFileSheet'
import { useStyles } from './styles'

type ChooseCredentialsFileSheetProps = {
    fileNames: string[]
}

export const ChooseCredentialsFileSheet = ({
    fileNames,
}: ChooseCredentialsFileSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { choices, handleSelect } = useChooseCredentialsFileSheet(fileNames)

    return (
        <PWSheetLayout
            testID='cloud_backup_choose_credentials_file_sheet'
            header={
                <SheetHeader
                    title={t('cloud_backup.restore.choose_file_title')}
                    showClose
                />
            }
        >
            <PWView style={styles.body}>
                <PWText
                    variant='bodyLarge'
                    style={styles.description}
                >
                    {t('cloud_backup.restore.choose_file_description')}
                </PWText>
                <PWView style={styles.options}>
                    {choices.map(({ fileName, addressPrefix }) => (
                        <PanelButton
                            key={fileName}
                            leftIcon='key'
                            title={
                                addressPrefix
                                    ? t(
                                          'cloud_backup.restore.choose_file_row',
                                          {
                                              prefix: addressPrefix,
                                          },
                                      )
                                    : t(
                                          'cloud_backup.restore.choose_file_unknown',
                                      )
                            }
                            titleWeight='h3'
                            accessibilityRole='button'
                            testID={`cloud_backup_choose_credentials_file_${fileName}`}
                            onPress={() => handleSelect(fileName)}
                        />
                    ))}
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
