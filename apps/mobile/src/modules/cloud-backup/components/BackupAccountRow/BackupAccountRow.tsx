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
    accountKindGlyph,
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    backupItemKindId,
    type BackupItemKind,
    type CachedRecordChain,
} from '@perawallet/wallet-core-backup'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import {
    PWIcon,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AccountIcon, accountGlyphFor } from '@components/AccountIcon'
import { ChainAddressList } from '@components/ChainAddressList'
import { ChainIconStack } from '@modules/chain-ui/icon'
import { AccountSummaryLine } from './AccountSummaryLine'
import { useBackupAccountRow } from './useBackupAccountRow'
import { useStyles } from './styles'

export type BackupAccountRowProps = {
    address: string
    /** Absent for an address held only in the backup: nothing on this device
     *  has this account locally. */
    account?: WalletAccount
    /** Picks the glyph for an address held only in the backup; ignored once
     *  `account` is present. */
    accountType?: BackupItemKind | null
    /** The chains an address held only in the backup restores; ignored once
     *  `account` is present. */
    backupChains?: CachedRecordChain[]
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
    backupChains,
    isBackedUp,
    trailing,
    action,
    testID,
}: BackupAccountRowProps) => {
    const styles = useStyles()
    const { isMultichain, chainIds, chains, canExpand, isExpanded, onToggle } =
        useBackupAccountRow({
            address,
            account,
            backupChains,
            fallbackChainId: LEGACY_CHAIN_ID,
        })

    const backupKindId =
        !account && accountType != null
            ? backupItemKindId(accountType, LEGACY_CHAIN_ID)
            : undefined
    const backupGlyphId = backupKindId
        ? accountKindGlyph(backupKindId, LEGACY_CHAIN_ID)
        : undefined
    const backupGlyph = backupGlyphId ? accountGlyphFor(backupGlyphId) : null

    const details = (
        <>
            <PWView style={styles.titleRow}>
                <PWText
                    variant='bodyLarge'
                    numberOfLines={1}
                    ellipsizeMode='middle'
                    style={styles.title}
                >
                    {account
                        ? getAccountDisplayName(account, LEGACY_CHAIN_ID)
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
                {canExpand && (
                    <PWIcon
                        name='chevron-down'
                        size='sm'
                        variant='secondary'
                        style={isExpanded ? styles.chevronExpanded : undefined}
                    />
                )}
            </PWView>
            {isMultichain && chainIds.length > 0 && (
                <ChainIconStack chainIds={chainIds} />
            )}
            {account != null && (
                <AccountSummaryLine
                    account={account}
                    address={address}
                />
            )}
        </>
    )

    return (
        <PWView testID={testID}>
            <PWView style={styles.row}>
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
                    {/* Only the text toggles: a touchable groups its children
                        for screen readers, which would swallow `action`. A row
                        that can't expand stays plain text rather than a
                        disabled button announced as dimmed. */}
                    {canExpand ? (
                        <PWTouchableOpacity
                            style={styles.toggle}
                            onPress={onToggle}
                            accessibilityRole='button'
                            // react-native-web 0.21 drops accessibilityState; aria-* reaches both.
                            aria-expanded={isExpanded}
                            testID='backup_account_row_toggle'
                        >
                            {details}
                        </PWTouchableOpacity>
                    ) : (
                        <PWView style={styles.toggle}>{details}</PWView>
                    )}
                    {action}
                </PWView>
                {trailing}
            </PWView>
            {isExpanded && (
                <ChainAddressList
                    chains={chains}
                    style={styles.addressPanel}
                    testIDPrefix='backup_account_address'
                />
            )}
        </PWView>
    )
}
