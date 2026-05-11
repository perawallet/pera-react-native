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
    PWView,
    PWText,
    PWTouchableOpacity,
    PWCheckbox,
    PWChip,
    PWIcon,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import LightLedgerAccountIcon from '@assets/icons/accounts/light/ledger-account.svg'
import { useStyles } from './styles'

export type LedgerAccountSelectionRowProps = {
    address: string
    isSelected: boolean
    isImported: boolean
    onToggle: () => void
    onInfoPress: () => void
    testID?: string
}

export const LedgerAccountSelectionRow = ({
    address,
    isSelected,
    isImported,
    onToggle,
    onInfoPress,
    testID,
}: LedgerAccountSelectionRowProps) => {
    const styles = useStyles({ isSelected, isImported })
    const { t } = useLanguage()

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onToggle}
            disabled={isImported}
            testID={testID}
        >
            {isImported ? (
                <PWChip
                    title={t('ledger.select_accounts.already_imported')}
                    variant='secondary'
                />
            ) : (
                <PWCheckbox
                    checked={isSelected}
                    onPress={onToggle}
                    containerStyle={styles.checkbox}
                    testID={testID ? `${testID}-checkbox` : undefined}
                />
            )}

            <LightLedgerAccountIcon
                width={40}
                height={40}
            />

            <PWView style={styles.textContainer}>
                <PWText
                    variant='body'
                    style={styles.title}
                >
                    {truncateAlgorandAddress(address, 13)}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.subtitle}
                >
                    {t('ledger.select_accounts.account_subtitle')}
                </PWText>
            </PWView>

            <PWTouchableOpacity
                onPress={onInfoPress}
                style={styles.infoButton}
                testID={testID ? `${testID}-info-button` : undefined}
            >
                <PWIcon
                    name='info'
                    size='sm'
                    variant='secondary'
                />
            </PWTouchableOpacity>
        </PWTouchableOpacity>
    )
}
