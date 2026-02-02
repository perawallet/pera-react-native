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

import { PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { AddressDisplay } from '@components/AddressDisplay'

export type AppCallDetailsPanelProps = {
    transaction: PeraDisplayableTransaction
}

export const AppCallDetailsPanel = ({
    transaction,
}: AppCallDetailsPanelProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const appCall = transaction.applicationTransaction
    if (!appCall) {
        return null
    }

    const hasAdvancedDetails =
        !!appCall.applicationArgs?.length ||
        !!appCall.accounts?.length ||
        !!appCall.foreignApps?.length ||
        !!appCall.foreignAssets?.length ||
        !!appCall.boxReferences?.length

    if (!hasAdvancedDetails) {
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
                            <PWText style={styles.detailText}>
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
                            <AddressDisplay style={styles.detailText} key={'account-' + account.toString()} address={account.toString()} />
                        ))}
                    </KeyValueRow>
                )}

                {appCall.foreignApps && appCall.foreignApps.length > 0 && (
                    <KeyValueRow
                        verticalAlignment='top'
                        title={t('transactions.app_call.foreign_apps')}
                    >
                        {appCall.foreignApps.map(appId => (
                            <PWText
                                key={'foreign-app-' + appId.toString()}
                                style={styles.detailText}
                            >
                                {appId.toString()}
                            </PWText>
                        ))}
                    </KeyValueRow>
                )}

                {appCall.foreignAssets && appCall.foreignAssets.length > 0 && (
                    <KeyValueRow
                        verticalAlignment='top'
                        title={t('transactions.app_call.foreign_assets')}
                    >
                        {appCall.foreignAssets.map(assetId => (
                            <PWText
                                key={'foreign-asset-' + assetId.toString()}
                                style={styles.detailText}
                            >
                                {assetId.toString()}
                            </PWText>
                        ))}
                    </KeyValueRow>
                )}

                {appCall.boxReferences && appCall.boxReferences.length > 0 && (
                    <KeyValueRow title={t('transactions.app_call.boxes')}>
                        <PWText style={styles.detailText}>
                            {appCall.boxReferences.length}
                        </PWText>
                    </KeyValueRow>
                )}
            </PWView>
        </TitledExpandablePanel>
    )
}
