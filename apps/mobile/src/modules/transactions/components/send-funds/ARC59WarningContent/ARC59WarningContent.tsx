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

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type ARC59WarningContentProps = Record<string, never>

const WARNING_ITEMS = [
    {
        title: 'send_funds.arc59_warning.item1',
        success: true,
    },
    {
        title: 'send_funds.arc59_warning.item2',
        success: true,
    },
    {
        title: 'send_funds.arc59_warning.item3',
        success: false,
    },
    {
        title: 'send_funds.arc59_warning.item4',
        success: false,
    },
    {
        title: 'send_funds.arc59_warning.item5',
        success: false,
    },
]

export const ARC59WarningContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()

    return (
        <>
            <PWIcon
                name='warning'
                variant='error'
                size='xxl'
                style={styles.icon}
            />
            <PWText variant='h3'>{t('send_funds.arc59_warning.title')}</PWText>

            <PWText style={styles.message}>
                {t('send_funds.arc59_warning.message')}
            </PWText>
            <PWView style={styles.warningItems}>
                {WARNING_ITEMS.map((item, index) => (
                    <PWView
                        key={index}
                        style={styles.warningItem}
                    >
                        <PWIcon
                            name={item.success ? 'check' : 'cross'}
                            size='md'
                            variant={item.success ? 'positive' : 'error'}
                        />
                        <PWText style={styles.message}>{t(item.title)}</PWText>
                    </PWView>
                ))}
            </PWView>

            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    title={t('send_funds.arc59_warning.confirm')}
                    onPress={() => resolve('confirm')}
                    paddingStyle='dense'
                />
                <PWButton
                    variant='secondary'
                    title={t('send_funds.arc59_warning.cancel')}
                    onPress={dismiss}
                    paddingStyle='dense'
                />
            </PWView>
        </>
    )
}
