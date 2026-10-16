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

import { PWDivider, PWIcon, PWText, PWTouchableOpacity } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type { SendTrailingSectionProps } from '@modules/transactions'
import { useStyles } from './styles'

export const AlgorandSendNoteSection = ({
    note,
    onEditNote,
}: SendTrailingSectionProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <>
            <PWDivider />
            <KeyValueRow title={t('send_funds.confirmation.note')}>
                {!!note && <PWText>{note}</PWText>}
                {!!note && (
                    <PWTouchableOpacity
                        onPress={onEditNote}
                        style={styles.linkContainer}
                    >
                        <PWIcon
                            name='edit-pen'
                            variant='link'
                            size='sm'
                        />
                        <PWText style={styles.link}>
                            {t('send_funds.confirmation.edit')}
                        </PWText>
                    </PWTouchableOpacity>
                )}
                {!note && (
                    <PWTouchableOpacity onPress={onEditNote}>
                        <PWText style={styles.link}>
                            {t('send_funds.add_note.button')}
                        </PWText>
                    </PWTouchableOpacity>
                )}
            </KeyValueRow>
        </>
    )
}
