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

import {
    PWButton,
    PWCheckbox,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useAddToFolderSheet } from './useAddToFolderSheet'
import { useStyles } from './styles'

export type AddToFolderSheetProps = {
    /** The favorite to file; read live from the store inside the sheet. */
    url: string
}

/** Files a favorite into folders; each checkbox saves at once. */
export const AddToFolderSheet = ({ url }: AddToFolderSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const sheet = useAddToFolderSheet({ url })

    return (
        <PWSheetLayout
            testID='discover_add_to_folder'
            header={
                <SheetHeader
                    title={t('discover.add_to_folder.title')}
                    subtitle={sheet.dappName}
                />
            }
        >
            <PWView style={styles.content}>
                <PWTouchableOpacity
                    style={styles.row}
                    onPress={() => {
                        void sheet.openNewFolder()
                    }}
                    testID='discover_add_to_folder_new'
                >
                    <PWView style={styles.icon}>
                        <PWIcon
                            name='folder-plus'
                            variant='link'
                        />
                    </PWView>
                    <PWText
                        variant='h4'
                        style={styles.newFolder}
                    >
                        {t('discover.add_to_folder.new_folder')}
                    </PWText>
                </PWTouchableOpacity>
                {sheet.folders.map(folder => (
                    <PWTouchableOpacity
                        key={folder.id}
                        style={styles.row}
                        onPress={() => sheet.toggle(folder.id)}
                        testID={`discover_add_to_folder_${folder.id}`}
                    >
                        <PWView style={styles.icon}>
                            <PWIcon
                                name='folder'
                                variant='secondary'
                            />
                        </PWView>
                        <PWText
                            variant='h4'
                            numberOfLines={1}
                            style={styles.name}
                        >
                            {folder.name}
                        </PWText>
                        <PWCheckbox
                            checked={folder.checked}
                            onPress={() => sheet.toggle(folder.id)}
                            testID={`discover_add_to_folder_${folder.id}_checkbox`}
                        />
                    </PWTouchableOpacity>
                ))}
                <PWButton
                    variant='primary'
                    title={t('discover.add_to_folder.done')}
                    onPress={sheet.done}
                    style={styles.done}
                    testID='discover_add_to_folder_done'
                />
            </PWView>
        </PWSheetLayout>
    )
}
