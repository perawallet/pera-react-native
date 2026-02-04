import { PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { PWText, PWView } from "@components/core"
import { useStyles } from "./styles"
import { useLanguage } from "@hooks/useLanguage"

export const AppCallSummaryHeader = ({ transaction }: { transaction: PeraDisplayableTransaction }) => {
    const styles = useStyles()
    const { t } = useLanguage()
    return (
        <PWView style={styles.container}>
            <PWText style={styles.typeText}>
                {t(`transactions.type.${transaction.txType}`)}
            </PWText>
            <PWText>
                {t('transactions.summary.app_id', { id: transaction.applicationTransaction?.applicationId ?? 'unknown' })}
            </PWText>

        </PWView>
    )
}