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

import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailAddress } from '@modules/signing'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { CopyableText } from '@components/CopyableText'
import { hasAdvancedAppCallDetails } from './utils'

export type AppCallDetailsPanelProps = {
    transaction: AlgorandTransactionView
}

export const AppCallDetailsPanel = ({
    transaction,
}: AppCallDetailsPanelProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)

    const appCall = transaction.applicationTransaction
    if (!appCall) {
        return null
    }

    if (!hasAdvancedAppCallDetails(transaction)) {
        return null
    }

    return (
        <TitledExpandablePanel title={t('transactions.app_call.details')}>
            <PWView style={styles.expandablePanel}>
                {appCall.applicationArgs &&
                    appCall.applicationArgs.length > 0 && (
                        <KeyValueRow
                            title={t('transactions.app_call.args_count')}
                        >
                            <PWText
                                variant='bodyCompact'
                                style={styles.detailText}
                            >
                                {appCall.applicationArgs.length}
                            </PWText>
                        </KeyValueRow>
                    )}

                {appCall.accounts && appCall.accounts.length > 0 && (
                    <KeyValueRow
                        verticalAlignment='top'
                        title={t('transactions.app_call.accounts')}
                    >
                        {appCall.accounts.map(account => (
                            <TransactionDetailAddress
                                key={'account-' + account.toString()}
                                address={account.toString()}
                                scope={scope}
                            />
                        ))}
                    </KeyValueRow>
                )}

                {appCall.foreignApps && appCall.foreignApps.length > 0 && (
                    <KeyValueRow
                        verticalAlignment='top'
                        title={t('transactions.app_call.foreign_apps')}
                    >
                        {appCall.foreignApps.map(appId => (
                            <CopyableText
                                key={'foreign-app-' + appId.toString()}
                                copyValue={appId.toString()}
                            >
                                <PWText
                                    variant='bodyCompact'
                                    style={styles.detailText}
                                >
                                    {appId.toString()}
                                </PWText>
                            </CopyableText>
                        ))}
                    </KeyValueRow>
                )}

                {appCall.foreignAssets && appCall.foreignAssets.length > 0 && (
                    <KeyValueRow
                        verticalAlignment='top'
                        title={t('transactions.app_call.foreign_assets')}
                    >
                        {appCall.foreignAssets.map(assetId => (
                            <CopyableText
                                key={'foreign-asset-' + assetId.toString()}
                                copyValue={assetId.toString()}
                            >
                                <PWText
                                    variant='bodyCompact'
                                    style={styles.detailText}
                                >
                                    {assetId.toString()}
                                </PWText>
                            </CopyableText>
                        ))}
                    </KeyValueRow>
                )}

                {appCall.boxReferences && appCall.boxReferences.length > 0 && (
                    <KeyValueRow title={t('transactions.app_call.boxes')}>
                        <PWText
                            variant='bodyCompact'
                            style={styles.detailText}
                        >
                            {appCall.boxReferences.length}
                        </PWText>
                    </KeyValueRow>
                )}
            </PWView>
        </TitledExpandablePanel>
    )
}
