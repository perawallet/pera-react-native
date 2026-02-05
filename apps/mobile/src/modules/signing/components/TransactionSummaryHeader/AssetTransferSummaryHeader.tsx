import {
    getAssetTransferType,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import {
    ALGO_ASSET_ID,
    useAssetFiatPricesQuery,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'
import Decimal from 'decimal.js'
import { useStyles } from './styles'
import { AddressDisplay } from '@components/AddressDisplay'
import { useTheme } from '@rneui/themed'
import { useMemo } from 'react'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useLanguage } from '@hooks/useLanguage'

export const AssetTransferSummaryHeader = ({
    transaction,
}: {
    transaction: PeraDisplayableTransaction
}) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const transferType = useMemo(
        () => getAssetTransferType(transaction),
        [transaction],
    )
    const { preferredFiatCurrency, showAlgoAsPrimaryCurrency } = useCurrency()

    const label = useMemo(() => {
        switch (transferType) {
            case 'opt-in':
                return 'transactions.summary.opt_in'
            case 'opt-out':
                return 'transactions.summary.opt_out'
            case 'clawback':
                return 'transactions.summary.clawback'
            default:
                return 'transactions.summary.transfer'
        }
    }, [transferType])

    const receiver = useMemo(() => {
        return transaction.assetTransferTransaction?.receiver ?? ''
    }, [transaction])

    const assetId = useMemo(() => {
        return transaction.assetTransferTransaction?.assetId?.toString() ?? ''
    }, [transaction])

    const microAmount = useMemo(() => {
        return transaction.assetTransferTransaction?.amount ?? 0n
    }, [transaction])

    const amount = useMemo(() => {
        return Decimal(microAmount).div(10 ** (asset?.decimals ?? 0))
    }, [transaction])

    const { data: asset, isPending } = useSingleAssetDetailsQuery(assetId)
    const { data: assetPrices, isPending: assetPricesPending } =
        useAssetFiatPricesQuery(!!assetId)

    const secondaryAssetName = useMemo(() => {
        if (showAlgoAsPrimaryCurrency) {
            return preferredFiatCurrency
        }
        return 'ALGO'
    }, [showAlgoAsPrimaryCurrency, asset])

    const value = useMemo(() => {
        if (assetPricesPending) {
            return undefined
        }

        if (showAlgoAsPrimaryCurrency) {
            const algoPrice =
                assetPrices?.get(ALGO_ASSET_ID)?.fiatPrice ?? new Decimal(0)
            const assetPrice =
                assetPrices?.get(assetId)?.fiatPrice ?? new Decimal(0)
            return assetPrice.mul(amount).div(algoPrice)
        }
        return (assetPrices?.get(assetId)?.fiatPrice ?? new Decimal(0)).mul(
            amount,
        )
    }, [assetPrices, isPending])

    return (
        <PWView style={styles.container}>
            <PWText style={styles.typeText}>
                {t(label, { asset: asset?.name ?? assetId })}
            </PWText>
            <AddressDisplay
                style={styles.address}
                displayType='simple'
                textProps={{ style: styles.addressText }}
                iconProps={{ color: theme.colors.textMain }}
                address={receiver}
            />

            <PWView style={styles.amountContainer}>
                {amount.isZero() ? null : (
                    <CurrencyDisplay
                        currency={asset?.unitName ?? ''}
                        precision={asset?.decimals ?? DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        value={amount}
                        showSymbol
                        variant='h1'
                        style={styles.amountValue}
                    />
                )}
                {value?.isZero() ? null : (
                    <CurrencyDisplay
                        currency={secondaryAssetName}
                        precision={DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        value={value}
                        showSymbol
                        variant='h4'
                        style={styles.secondaryAmountValue}
                    />
                )}
            </PWView>
        </PWView>
    )
}
