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

import type { ReactNode } from 'react'
import {
    getAccountDisplayName,
    type AccountType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { BackupAccountType } from '@perawallet/wallet-core-backup'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { PWIcon, PWRoundIcon, PWText, PWView } from '@components/core'
import {
    AccountIcon,
    accountGlyphForType,
} from '@modules/accounts/components/AccountIcon'
import { AccountSummaryLine } from './AccountSummaryLine'
import { useStyles } from './styles'

export type BackupAccountRowProps = {
    address: string
    /** Absent for an address held only in the backup: nothing on this device
     *  has this account locally. */
    account?: WalletAccount
    /** Picks the glyph for an address held only in the backup; ignored once
     *  `account` is present. */
    accountType?: BackupAccountType | null
    isBackedUp: boolean
    trailing?: ReactNode
    /** Renders under the text column, so a wide control can't squeeze the name. */
    action?: ReactNode
    testID?: string
}

export const BackupAccountRow = ({
    address,
    account,
    accountType,
    isBackedUp,
    trailing,
    action,
    testID,
}: BackupAccountRowProps) => {
    const styles = useStyles()

    const backupGlyph =
        !account &&
        accountType != null &&
        accountType !== BackupAccountType.hdSeed
            ? accountGlyphForType(accountType as AccountType)
            : null

    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            {account ? (
                <AccountIcon
                    account={account}
                    size='xl'
                />
            ) : backupGlyph ? (
                <PWRoundIcon
                    icon={backupGlyph.name}
                    variant={backupGlyph.variant}
                    size='md'
                />
            ) : (
                <PWRoundIcon
                    icon='accounts/glyph/unknown-account'
                    variant='accountNeutral'
                    size='md'
                />
            )}
            <PWView style={styles.body}>
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='bodyLarge'
                        numberOfLines={1}
                        ellipsizeMode='middle'
                        style={styles.title}
                    >
                        {account
                            ? getAccountDisplayName(account)
                            : truncateAlgorandAddress(address)}
                    </PWText>
                    <PWIcon
                        name={isBackedUp ? 'cloud-check' : 'cloud-off'}
                        variant={isBackedUp ? 'positive' : 'error'}
                        size='sm'
                        testID={
                            isBackedUp
                                ? 'backup_account_row_backed_up'
                                : 'backup_account_row_not_backed_up'
                        }
                    />
                </PWView>
                {account != null && <AccountSummaryLine address={address} />}
                {action}
            </PWView>
            {trailing}
        </PWView>
    )
}
