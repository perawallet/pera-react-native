import { PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { PWText, PWView } from "@components/core"
import { CurrencyDisplay } from "@components/CurrencyDisplay"
import { DEFAULT_PRECISION } from "@perawallet/wallet-core-shared"
import { useStyles } from "./styles"
import { AddressDisplay } from "@components/AddressDisplay"
import { useTheme } from "@rneui/themed"
import { useLanguage } from "@hooks/useLanguage"

export const GenericSummaryHeader = ({ transaction }: { transaction: PeraDisplayableTransaction }) => {
    const styles = useStyles()
    const { t } = useLanguage()
    
    return (
        <PWView style={styles.container}>
            <PWText style={styles.typeText}>
                {t(`transactions.type.${transaction.txType}`)}
            </PWText>

        </PWView>
    )
}