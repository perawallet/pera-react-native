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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ChainNotice } from '@components/ChainNotice'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumApprovalChangePresentation } from '../useEthereumSimulationSection'
import { useStyles } from './styles'
import { useEthereumApprovalChangeRow } from './useEthereumApprovalChangeRow'

type EthereumApprovalChangeRowProps = {
    change: EthereumApprovalChangePresentation
    scope: ChainScope
}

export const EthereumApprovalChangeRow = ({
    change,
    scope,
}: EthereumApprovalChangeRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { title, notice, spenderName } = useEthereumApprovalChangeRow(
        change,
        scope,
    )
    const { grant } = change

    return (
        <PWView
            style={styles.container}
            testID='ethereum_simulation_approval'
        >
            <PWText variant='bodySemibold'>{title}</PWText>
            <KeyValueRow
                testID='ethereum_simulation_approval_spender'
                title={t(
                    change.isCollectionWide
                        ? 'signing.collection_approval.operator_label'
                        : 'signing.spend_approval.spender_label',
                )}
                verticalAlignment={spenderName ? 'top' : undefined}
            >
                <PWView style={styles.spender}>
                    {!!spenderName && (
                        <PWView style={styles.spenderName}>
                            <PWText>{spenderName}</PWText>
                            <PWIcon
                                name='check'
                                size='sm'
                                variant='positive'
                                accessibilityLabel={t(
                                    'ethereum.known_contract.badge',
                                )}
                            />
                        </PWView>
                    )}
                    <AddressDisplay
                        address={change.spender}
                        displayType='address-only'
                        scope={scope}
                    />
                </PWView>
            </KeyValueRow>
            {grant.kind === 'unlimited' && !change.isCollectionWide && (
                <KeyValueRow
                    testID='ethereum_simulation_approval_amount'
                    title={t('transactions.common.amount')}
                >
                    <PWText>{t('signing.spend_approval.unlimited')}</PWText>
                </KeyValueRow>
            )}
            {grant.kind === 'amount' && (
                <KeyValueRow
                    testID='ethereum_simulation_approval_amount'
                    title={t('transactions.common.amount')}
                >
                    <PWView style={styles.spender}>
                        <AssetAmount
                            chainId={scope.chainId}
                            asset={change.asset}
                            value={grant.amount}
                            showSymbol
                            ignorePrivacyMode
                        />
                        {grant.isBaseUnits && (
                            <PWText variant='caption'>
                                {t('ethereum.contract_action.base_units')}
                            </PWText>
                        )}
                    </PWView>
                </KeyValueRow>
            )}
            {change.isCollectionWide && (
                <KeyValueRow
                    testID='ethereum_simulation_approval_collection'
                    title={t('signing.collection_approval.collection_label')}
                    verticalAlignment='top'
                >
                    <AddressDisplay
                        address={change.contract}
                        displayType='address-only'
                        scope={scope}
                    />
                </KeyValueRow>
            )}
            {!change.isCollectionWide && (
                <KeyValueRow
                    testID='ethereum_simulation_approval_asset'
                    title={t('transactions.common.asset')}
                    verticalAlignment='top'
                >
                    <PWView style={styles.spender}>
                        {grant.kind === 'token' ? (
                            <PWText>
                                {t('transactions.list_item.nft_subtitle', {
                                    collection: change.contract,
                                    tokenId: grant.tokenId,
                                })}
                            </PWText>
                        ) : (
                            !!change.asset && (
                                <PWText>{change.asset.unitName}</PWText>
                            )
                        )}
                        <AddressDisplay
                            address={change.contract}
                            displayType='address-only'
                            scope={scope}
                        />
                    </PWView>
                </KeyValueRow>
            )}
            {!!notice &&
                (notice.isWarning ? (
                    <ChainNotice
                        kind='warning'
                        titleKey={notice.titleKey}
                        testID='ethereum_simulation_approval_warning'
                    />
                ) : (
                    <PWText
                        variant='caption'
                        style={styles.note}
                        testID='ethereum_simulation_approval_note'
                    >
                        {t(notice.titleKey, notice.params)}
                    </PWText>
                ))}
        </PWView>
    )
}
