import { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useMemo } from 'react'
import { config } from '@perawallet/wallet-core-config'
import { v4 as uuid } from 'uuid'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { Networks } from '@perawallet/wallet-core-shared'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'

export const useTransactionFooter = (
    transaction: PeraDisplayableTransaction,
) => {
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

    const { data: asset } = useSingleAssetDetailsQuery(
        transaction.assetTransferTransaction?.assetId?.toString() ?? '',
    )

    const assetUrl = useMemo(() => {
        let url: string | undefined = undefined
        if (transaction.assetConfigTransaction?.params?.url) {
            url = transaction.assetConfigTransaction.params.url
        } else if (asset?.url) {
            url = asset.url
        }

        if (url && !url.startsWith('http')) {
            url = `https://${url}`
        }

        return url
    }, [asset])

    const showAssetUrl = () => {
        if (!assetUrl) {
            return
        }
        pushWebView({
            url: assetUrl,
            id: uuid(),
        })
    }

    return {
        showInExplorer,
        assetUrl,
        showAssetUrl,
    }
}
