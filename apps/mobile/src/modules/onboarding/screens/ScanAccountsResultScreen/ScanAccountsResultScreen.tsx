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

import { PWResultView, PWScrollView, PWView } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { useStyles } from './styles'
import { useScanAccountsResultScreen } from './useScanAccountsResultScreen'

export const ScanAccountsResultScreen = () => {
    const styles = useStyles()
    const {
        variant,
        title,
        body,
        changedAccounts,
        primaryAction,
        secondaryAction,
    } = useScanAccountsResultScreen()

    return (
        <PWView style={styles.root}>
            <PWResultView
                variant={variant}
                title={title}
                body={body}
                primaryAction={primaryAction}
                secondaryAction={secondaryAction}
                testID='scan_accounts_result'
            >
                {changedAccounts.length > 0 && (
                    <PWScrollView
                        style={styles.accounts}
                        contentContainerStyle={styles.accountsContent}
                    >
                        {changedAccounts.map(account => (
                            <AccountDisplay
                                key={account.id}
                                account={account}
                                showChevron={false}
                                style={styles.account}
                            />
                        ))}
                    </PWScrollView>
                )}
            </PWResultView>
        </PWView>
    )
}
