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

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import {
    MigrationDataSection,
    useExpandableState,
} from '../components/MigrationDataSection'
import { LegacyVsRnRow } from '../components/LegacyVsRnRow'
import { EmptyDataHint } from '../components/EmptyDataHint'
import { MigrationDataRow } from '../components/MigrationDataRow'
import { MigrationDataSubBlock } from '../components/MigrationDataSubBlock'
import { useStyles } from '../styles'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

const getDisplayType = (account: LegacyAccount): string => {
    if (account.type === 'watch') return 'watch'
    if (account.joint !== null) return 'multisig'
    if (account.ledger !== null) return 'hardware'
    if (account.hdWalletId !== null) return 'hdWallet'
    return 'algo25'
}

export const AccountsSection = ({
    accounts,
    rn,
}: {
    accounts: LegacyAccount[]
    rn: RNMigrationSnapshot
}) => {
    return (
        <MigrationDataSection
            title='Accounts'
            count={accounts.length}
        >
            <LegacyVsRnRow
                label='count'
                legacyValue={accounts.length}
                rnValue={rn.accountsByAddress.size}
                matches={accounts.length === rn.accountsByAddress.size}
            />
            {accounts.length === 0 ? (
                <EmptyDataHint />
            ) : (
                accounts.map((account, i) => (
                    <AccountCard
                        key={`${account.address}-${i}`}
                        account={account}
                        rn={rn}
                    />
                ))
            )}
        </MigrationDataSection>
    )
}

const AccountCard = ({
    account,
    rn,
}: {
    account: LegacyAccount
    rn: RNMigrationSnapshot
}) => {
    const styles = useStyles()
    const [expanded, setExpanded] = useExpandableState(false)
    return (
        <PWView style={styles.accountCard}>
            <PWTouchableOpacity onPress={() => setExpanded(prev => !prev)}>
                <PWView style={styles.accountCardHeader}>
                    <PWView style={styles.accountCardHeaderLeft}>
                        <PWView style={styles.accountTypeBadgeGroup}>
                            <PWView style={styles.legacyTypeBadge}>
                                <PWText
                                    variant='caption'
                                    style={styles.accountTypeBadgeText}
                                >
                                    {account.type}
                                </PWText>
                            </PWView>
                            <PWText
                                variant='caption'
                                style={styles.badgeArrow}
                            >
                                →
                            </PWText>
                            <PWView style={styles.accountTypeBadge}>
                                <PWText
                                    variant='caption'
                                    style={styles.accountTypeBadgeText}
                                >
                                    {getDisplayType(account)}
                                </PWText>
                            </PWView>
                        </PWView>
                        <PWText
                            variant='body'
                            style={styles.accountCardAddress}
                            numberOfLines={1}
                            ellipsizeMode='middle'
                        >
                            {account.name ||
                                truncateAlgorandAddress(account.address)}
                        </PWText>
                    </PWView>
                    <PWIcon
                        name={expanded ? 'chevron-down' : 'chevron-right'}
                        size='sm'
                    />
                </PWView>
            </PWTouchableOpacity>
            {expanded && (
                <PWView style={styles.accountCardBody}>
                    {(() => {
                        const rnAccount = rn.accountsByAddress.get(
                            account.address,
                        )
                        const rnOrderIndex = rn.manualAccountOrder.indexOf(
                            account.address,
                        )
                        return (
                            <>
                                <MigrationDataRow
                                    label='address'
                                    value={account.address}
                                />
                                <LegacyVsRnRow
                                    label='present in RN'
                                    legacyValue={true}
                                    rnValue={rnAccount !== undefined}
                                    matches={rnAccount !== undefined}
                                />
                                <LegacyVsRnRow
                                    label='name'
                                    legacyValue={account.name}
                                    rnValue={rnAccount?.name ?? '(missing)'}
                                    matches={rnAccount?.name === account.name}
                                />
                                <LegacyVsRnRow
                                    label='type'
                                    legacyValue={account.type}
                                    rnValue={rnAccount?.type ?? '(missing)'}
                                />
                                <LegacyVsRnRow
                                    label='preferredOrder'
                                    legacyValue={account.preferredOrder}
                                    rnValue={
                                        rnOrderIndex >= 0
                                            ? rnOrderIndex
                                            : '(missing)'
                                    }
                                />
                                <MigrationDataRow
                                    label='isBackedUp'
                                    value={account.isBackedUp}
                                />
                            </>
                        )
                    })()}
                    <MigrationDataRow
                        label='secretKey'
                        value={account.secretKey}
                    />
                    <MigrationDataRow
                        label='hdWalletId'
                        value={account.hdWalletId}
                    />

                    {account.ledger && (
                        <MigrationDataSubBlock title='ledger'>
                            <MigrationDataRow
                                label='bluetoothAddress'
                                value={account.ledger.bluetoothAddress}
                            />
                            <MigrationDataRow
                                label='bluetoothName'
                                value={account.ledger.bluetoothName}
                            />
                            <MigrationDataRow
                                label='positionInLedger'
                                value={account.ledger.positionInLedger}
                            />
                        </MigrationDataSubBlock>
                    )}

                    {account.joint && (
                        <MigrationDataSubBlock title='joint'>
                            <MigrationDataRow
                                label='threshold'
                                value={account.joint.threshold}
                            />
                            <MigrationDataRow
                                label='version'
                                value={account.joint.version}
                            />
                            <MigrationDataRow
                                label='participants'
                                value={account.joint.participants}
                            />
                        </MigrationDataSubBlock>
                    )}
                </PWView>
            )}
        </PWView>
    )
}
