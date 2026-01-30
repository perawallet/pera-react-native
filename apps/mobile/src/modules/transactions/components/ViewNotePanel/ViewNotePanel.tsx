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
    type PWBottomSheetProps,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export type ViewNotePanelProps = {
    note: string
    onClose: () => void
} & PWBottomSheetProps

export const ViewNotePanel = ({
    note,
    isVisible,
    onClose,
    ...rest
}: ViewNotePanelProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            {...rest}
        >
            <PWView style={styles.container}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            variant='secondary'
                            onPress={onClose}
                        />
                    }
                    center={
                        <PWText variant='h4'>
                            {t('transactions.common.note')}
                        </PWText>
                    }
                />
                <PWText style={styles.noteText}>{note}</PWText>
            </PWView>
        </PWBottomSheet>
    )
}
