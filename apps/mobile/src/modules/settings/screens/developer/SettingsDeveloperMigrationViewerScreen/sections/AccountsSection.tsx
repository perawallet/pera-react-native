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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import {
    CollapsibleSection,
    ComparisonRow,
    EmptyHint,
    getDisplayType,
    InlineRow,
    SubBlock,
    truncateAddress,
    useExpandableState,
} from '../SettingsDeveloperMigrationViewerScreen'
import { useStyles } from '../styles'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

export const AccountsSection = ({
    accounts,
    rn,
}: {
    accounts: LegacyAccount[]
    rn: RNMigrationSnapshot
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t('settings.developer.migration_viewer.section_accounts')}
            count={accounts.length}
        >
            <ComparisonRow
                label='count'
                legacyValue={accounts.length}
                rnValue={rn.accountsByAddress.size}
                matches={accounts.length === rn.accountsByAddress.size}
            />
            {accounts.length === 0 ? (
                <EmptyHint />
            ) : (
                accounts.map((account, i) => (
                    <AccountCard
                        key={`${account.address}-${i}`}
                        account={account}
                        rn={rn}
                    />
                ))
            )}
        </CollapsibleSection>
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
                            {account.name || truncateAddress(account.address)}
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
                                <InlineRow
                                    label='address'
                                    value={account.address}
                                />
                                <ComparisonRow
                                    label='present in RN'
                                    legacyValue={true}
                                    rnValue={rnAccount !== undefined}
                                    matches={rnAccount !== undefined}
                                />
                                <ComparisonRow
                                    label='name'
                                    legacyValue={account.name}
                                    rnValue={rnAccount?.name ?? '(missing)'}
                                    matches={rnAccount?.name === account.name}
                                />
                                <ComparisonRow
                                    label='type'
                                    legacyValue={account.type}
                                    rnValue={rnAccount?.type ?? '(missing)'}
                                />
                                <ComparisonRow
                                    label='preferredOrder'
                                    legacyValue={account.preferredOrder}
                                    rnValue={
                                        rnOrderIndex >= 0
                                            ? rnOrderIndex
                                            : '(missing)'
                                    }
                                />
                                <InlineRow
                                    label='isBackedUp'
                                    value={account.isBackedUp}
                                />
                            </>
                        )
                    })()}
                    <InlineRow
                        label='secretKey'
                        value={account.secretKey}
                    />
                    <InlineRow
                        label='hdWalletId'
                        value={account.hdWalletId}
                    />

                    {account.ledger && (
                        <SubBlock title='ledger'>
                            <InlineRow
                                label='bluetoothAddress'
                                value={account.ledger.bluetoothAddress}
                            />
                            <InlineRow
                                label='bluetoothName'
                                value={account.ledger.bluetoothName}
                            />
                            <InlineRow
                                label='positionInLedger'
                                value={account.ledger.positionInLedger}
                            />
                        </SubBlock>
                    )}

                    {account.joint && (
                        <SubBlock title='joint'>
                            <InlineRow
                                label='threshold'
                                value={account.joint.threshold}
                            />
                            <InlineRow
                                label='version'
                                value={account.joint.version}
                            />
                            <InlineRow
                                label='participants'
                                value={account.joint.participants}
                            />
                        </SubBlock>
                    )}
                </PWView>
            )}
        </PWView>
    )
}
