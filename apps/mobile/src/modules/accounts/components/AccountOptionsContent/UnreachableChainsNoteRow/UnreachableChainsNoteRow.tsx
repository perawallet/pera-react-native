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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useInfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { AccountTypeInfoContent } from '../../AccountInfoCard/AccountTypeInfoContent'
import { useStyles } from './styles'

export type UnreachableChainsNoteRowProps = {
    note: string
    account: WalletAccount
}

export const UnreachableChainsNoteRow = ({
    note,
    account,
}: UnreachableChainsNoteRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { openInfo } = useInfoButton({
        children: <AccountTypeInfoContent account={account} />,
    })

    return (
        <PWView
            style={styles.unreachableNote}
            testID='account_networks_unreachable_note'
        >
            <PWText
                variant='caption'
                style={styles.unreachableNoteText}
            >
                {note}
            </PWText>
            <PWTouchableOpacity
                onPress={openInfo}
                testID='account_networks_unreachable_learn_more'
            >
                <PWText variant='link'>
                    {t('account_type_info.learn_more')}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
