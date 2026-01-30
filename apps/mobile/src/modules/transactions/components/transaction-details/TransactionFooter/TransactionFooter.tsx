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
