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

import { useCallback, useMemo } from 'react'
import {
    PWBadge,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AccountIcon } from '@components/AccountIcon'
import { ChainAddressList } from '@components/ChainAddressList'
import { CopyableText } from '@components/CopyableText'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIconStack } from '@modules/chain-ui/icon'
import { useStyles } from './styles'
import type { AccountStructureRow } from './useAccountInfoCard'

type AccountStructureTreeRowProps = {
    row: AccountStructureRow
    isMultichain: boolean
    isLast: boolean
    isExpanded: boolean
    onToggle: (accountId: string) => void
}

export const AccountStructureTreeRow = ({
    row,
    isMultichain,
    isLast,
    isExpanded,
    onToggle,
}: AccountStructureTreeRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const chainIds = useMemo(
        () => row.chains.map(chain => chain.chainId),
        [row.chains],
    )
    // With one chain active, an account holds at most one address here.
    const onlyChain = row.chains[0]

    const handlePress = useCallback(
        () => onToggle(row.account.id),
        [onToggle, row.account.id],
    )

    return (
        <PWView style={styles.treeRow}>
            <PWView style={styles.accountRowWithConnector}>
                <PWView style={styles.connectorContainer}>
                    <PWView
                        style={[
                            styles.connectorVertical,
                            isLast && styles.connectorVerticalLast,
                        ]}
                    />
                    <PWView style={styles.connectorHorizontal} />
                </PWView>
                {isMultichain ? (
                    <PWTouchableOpacity
                        style={styles.accountRow}
                        onPress={handlePress}
                        disabled={!row.canExpand}
                        // react-native-web 0.21 drops accessibilityState; aria-* reaches both.
                        aria-expanded={row.canExpand ? isExpanded : undefined}
                        testID={`account_structure_row_${row.account.id}`}
                    >
                        <AccountIcon
                            account={row.account}
                            size='lg'
                        />
                        <PWView style={styles.accountInfoWithChains}>
                            <PWText
                                variant='bodyLarge'
                                truncate
                            >
                                {row.name}
                            </PWText>
                            <ChainIconStack chainIds={chainIds} />
                        </PWView>
                        {row.isViewing && (
                            <PWBadge
                                variant='positive'
                                value={t('account_info.viewing')}
                            />
                        )}
                        {row.canExpand && (
                            <PWIcon
                                name='chevron-down'
                                size='sm'
                                variant='secondary'
                                style={
                                    isExpanded
                                        ? styles.chevronExpanded
                                        : undefined
                                }
                            />
                        )}
                    </PWTouchableOpacity>
                ) : (
                    <PWView style={styles.accountRow}>
                        <AccountIcon
                            account={row.account}
                            size='lg'
                        />
                        <PWView style={styles.accountInfo}>
                            <PWText
                                variant='bodyLarge'
                                truncate
                            >
                                {row.name}
                            </PWText>
                            {onlyChain && (
                                <CopyableText copyValue={onlyChain.copyValue}>
                                    <PWText
                                        variant='body'
                                        style={styles.addressText}
                                    >
                                        {onlyChain.address}
                                    </PWText>
                                </CopyableText>
                            )}
                        </PWView>
                    </PWView>
                )}
            </PWView>

            {isMultichain && isExpanded && (
                <PWView style={styles.addressPanelRow}>
                    <PWView style={styles.connectorContainer}>
                        {!isLast && <PWView style={styles.connectorSpine} />}
                    </PWView>
                    <ChainAddressList
                        chains={row.chains}
                        style={styles.addressPanel}
                        testIDPrefix='account_structure_address'
                    />
                </PWView>
            )}
        </PWView>
    )
}
