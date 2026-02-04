import { PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { PWText, PWView } from "@components/core"
import { CurrencyDisplay } from "@components/CurrencyDisplay"
import { microAlgosToAlgos } from "@perawallet/wallet-core-blockchain"
import { ALGO_ASSET, useAssetFiatPricesQuery } from "@perawallet/wallet-core-assets"
import { DEFAULT_PRECISION } from "@perawallet/wallet-core-shared"
import Decimal from "decimal.js"
import { useStyles } from "./styles"
import { Trans } from "react-i18next"
import { AddressDisplay } from "@components/AddressDisplay"
import { useTheme } from "@rneui/themed"
import { useMemo } from "react"
import { useCurrency } from "@perawallet/wallet-core-currencies"

export const PaymentTransactionSummaryHeader = ({ transaction }: { transaction: PeraDisplayableTransaction }) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { preferredFiatCurrency, showAlgoAsPrimaryCurrency } = useCurrency()

    const { data: fiatPrices, isPending } = useAssetFiatPricesQuery(!showAlgoAsPrimaryCurrency)
    const value = useMemo(() => {
        if (isPending) {
            return undefined
        }
        return (fiatPrices?.get(ALGO_ASSET.assetId)?.fiatPrice ?? new Decimal(0)).mul(microAlgosToAlgos(transaction.paymentTransaction?.amount ?? 0n))
    }, [fiatPrices, isPending])


    return (
        <PWView style={styles.container}>
            <PWText style={styles.typeText}>
                <Trans i18nKey="transactions.summary.payment_to" components={[
                    <AddressDisplay style={styles.address} textProps={{ style: styles.addressText }} iconProps={{ color: theme.colors.textMain }} address={transaction.paymentTransaction?.receiver || ''} />
                ]} />
            </PWText>
            <PWView style={styles.amountContainer}>
                <CurrencyDisplay
                    currency='ALGO'
                    precision={ALGO_ASSET.decimals}
                    minPrecision={DEFAULT_PRECISION}
                    value={Decimal(
                        microAlgosToAlgos(
                            transaction.paymentTransaction?.amount ?? 0n,
                        ),
                    )}
                    showSymbol
                    variant='h1'
                    style={styles.amountValue}
                />
                {!!value && <CurrencyDisplay
                    currency={preferredFiatCurrency}
                    precision={DEFAULT_PRECISION}
                    minPrecision={DEFAULT_PRECISION}
                    value={value}
                    showSymbol
                    variant='h4'
                    style={styles.secondaryAmountValue}
                />}
            </PWView>
        </PWView>
    )
}