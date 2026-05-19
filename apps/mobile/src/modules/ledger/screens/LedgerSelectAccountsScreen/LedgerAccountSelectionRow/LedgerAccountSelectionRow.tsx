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

import { useCallback } from 'react'
import {
    PWView,
    PWText,
    PWTouchableOpacity,
    PWCheckbox,
    PWChip,
    PWIcon,
} from '@components/core'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import LightLedgerAccountIcon from '@assets/icons/accounts/light/ledger-account.svg'
import { useStyles } from './styles'

export type LedgerAccountSelectionRowProps = {
    address: string
    isSelected: boolean
    isImported: boolean
    onToggle: () => void
    testID?: string
}

export const LedgerAccountSelectionRow = ({
    address,
    isSelected,
    isImported,
    onToggle,
    testID,
}: LedgerAccountSelectionRowProps) => {
    const styles = useStyles({ isImported })
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()

    const handleCopyAddress = useCallback(() => {
        void copyToClipboard(address)
    }, [copyToClipboard, address])

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onToggle}
            disabled={isImported}
            testID={testID}
        >
            <LightLedgerAccountIcon
                width={40}
                height={40}
            />

            <PWView style={styles.textContainer}>
                <PWTouchableOpacity
                    style={styles.addressTouchable}
                    onPress={handleCopyAddress}
                    hitSlop={8}
                    testID={testID ? `${testID}-copy-address` : undefined}
                >
                    <PWText
                        variant='body'
                        style={styles.title}
                        numberOfLines={1}
                    >
                        {truncateAlgorandAddress(address)}
                    </PWText>
                    <PWIcon
                        name='copy'
                        size='sm'
                        variant='secondary'
                    />
                </PWTouchableOpacity>
                {isImported && (
                    <PWChip
                        title={t('ledger.select_accounts.already_imported')}
                        variant='secondary'
                        textVariant='captionSmall'
                    />
                )}
            </PWView>

            {!isImported && (
                <PWCheckbox
                    checked={isSelected}
                    onPress={onToggle}
                    containerStyle={styles.checkbox}
                    testID={testID ? `${testID}-checkbox` : undefined}
                />
            )}
        </PWTouchableOpacity>
    )
}
