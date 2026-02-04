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

import { PWButton, PWView } from '@components/core'
import { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { useMemo } from 'react'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { v4 as uuid } from 'uuid'
import { Networks } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'

export const TransactionFooter = ({
    transaction,
}: {
    transaction: PeraDisplayableTransaction
}) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { network } = useNetwork()
    const { pushWebView } = useWebView()

    const explorerUrl = useMemo(() => {
        if (network === Networks.mainnet) {
            return config.mainnetExplorerUrl
        }
        return config.testnetExplorerUrl
    }, [network])

    const showInExplorer = () => {
        pushWebView({
            url: `${explorerUrl}/tx/${transaction.id}`,
            id: uuid(),
        })
    }

    if (!transaction.id) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <PWButton
                variant='secondary'
                title={t('transactions.common.view_in_explorer')}
                icon='globe'
                onPress={showInExplorer}
                paddingStyle='dense'
            />
        </PWView>
    )
}
