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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWSheetLayout, PWText, PWView } from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

const STEP_KEYS = [
    i18nKey('ledger.how_does_it_work.step_1'),
    i18nKey('ledger.how_does_it_work.step_2'),
    i18nKey('ledger.how_does_it_work.step_3'),
    i18nKey('ledger.how_does_it_work.step_4'),
] as const

export type LedgerHowItWorksContentProps = {
    /** The device app the steps tell the user to install and open. */
    appName: string
}

export const LedgerHowItWorksContent = ({
    appName,
}: LedgerHowItWorksContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('ledger.how_does_it_work.title')} />}
        >
            <PWView style={styles.list}>
                {STEP_KEYS.map(key => (
                    <PWView
                        key={key}
                        style={styles.item}
                    >
                        <PWView style={styles.bullet}>
                            <PWIcon
                                name='check'
                                size='xs'
                                variant='positive'
                            />
                        </PWView>
                        <PWText
                            variant='body'
                            style={styles.itemText}
                        >
                            {t(key, { appName })}
                        </PWText>
                    </PWView>
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
