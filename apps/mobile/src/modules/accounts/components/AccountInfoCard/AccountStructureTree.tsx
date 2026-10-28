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
    type IconName,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { AccountStructureTreeRow } from './AccountStructureTreeRow'
import type { AccountStructureRow } from './useAccountInfoCard'

type AccountStructureTreeProps = {
    label: string
    subtitle?: string
    icon: IconName
    rows: AccountStructureRow[]
    isMultichain: boolean
    expandedRowId: Optional<string>
    onToggleRow: (accountId: string) => void
    scanLabel: string
    onScanAddresses: () => void
}

export const AccountStructureTree = ({
    label,
    subtitle,
    icon,
    rows,
    isMultichain,
    expandedRowId,
    onToggleRow,
    scanLabel,
    onScanAddresses,
}: AccountStructureTreeProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.treeContainer}>
            <PWView style={styles.walletRow}>
                <PWView style={styles.walletCircle}>
                    <PWIcon
                        name={icon}
                        size='md'
                        variant='primary'
                    />
                </PWView>
                <PWView style={styles.walletInfo}>
                    <PWText variant='bodyLarge'>{label}</PWText>
                    {subtitle && (
                        <PWText
                            variant='body'
                            style={styles.walletSubtitle}
                        >
                            {subtitle}
                        </PWText>
                    )}
                </PWView>
            </PWView>

            {rows.map((row, index) => (
                <AccountStructureTreeRow
                    key={row.account.id}
                    row={row}
                    isMultichain={isMultichain}
                    isLast={index === rows.length - 1}
                    isExpanded={expandedRowId === row.account.id}
                    onToggle={onToggleRow}
                />
            ))}

            <PWTouchableOpacity
                style={styles.scanButton}
                onPress={onScanAddresses}
            >
                <PWIcon
                    name='scan'
                    size='sm'
                    variant='helper'
                />
                <PWText
                    variant='link'
                    style={styles.scanButtonText}
                >
                    {scanLabel}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
