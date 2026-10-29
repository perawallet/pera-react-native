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

import { useCallback } from 'react'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { PWChip, PWRoundIcon } from '@components/core'
import { SelectableAccountCheckboxRow } from '@modules/accounts'
import { useLanguage } from '@hooks/useLanguage'

export type LedgerAccountSelectionRowProps = {
    address: string
    accountIndex: number
    chainId: ChainId
    variant?: 'derived' | 'delegated'
    isSelected: boolean
    isImported: boolean
    /** Address held as a watch account — selecting it upgrades the entry. */
    isUpgradeable?: boolean
    onToggle: () => void
    onInfoPress: (address: string, accountIndex: number) => void
    testID?: string
}

export const LedgerAccountSelectionRow = ({
    address,
    accountIndex,
    chainId,
    variant = 'derived',
    isSelected,
    isImported,
    isUpgradeable = false,
    onToggle,
    onInfoPress,
    testID,
}: LedgerAccountSelectionRowProps) => {
    const { t } = useLanguage()

    const badgeTitleOf = () => {
        if (variant === 'delegated') {
            return t('ledger.select_accounts.rekeyed_label')
        }
        return isUpgradeable
            ? t('ledger.select_accounts.watch_account_label')
            : null
    }
    const badgeTitle = badgeTitleOf()

    const handleInfoPress = useCallback(() => {
        onInfoPress(address, accountIndex)
    }, [onInfoPress, address, accountIndex])

    return (
        <SelectableAccountCheckboxRow
            title={addressCodecs.get(chainId).truncate(address)}
            leadingIcon={
                // Same glyph resolution as useAccountIcon's hardware entry —
                // theme-aware, unlike the light-theme SVG this replaced.
                <PWRoundIcon
                    icon='accounts/glyph/ledger-account'
                    variant='accountPurple'
                    size='md'
                />
            }
            badge={
                badgeTitle ? (
                    <PWChip
                        title={badgeTitle}
                        variant='secondary'
                        textVariant='captionSmall'
                    />
                ) : undefined
            }
            isSelected={isSelected}
            isImported={isImported}
            importedLabel={t('ledger.select_accounts.already_imported')}
            onToggle={onToggle}
            onInfoPress={handleInfoPress}
            testID={testID}
            checkboxTestID={testID ? `${testID}-checkbox` : undefined}
            infoTestID={testID ? `${testID}-info` : undefined}
        />
    )
}
