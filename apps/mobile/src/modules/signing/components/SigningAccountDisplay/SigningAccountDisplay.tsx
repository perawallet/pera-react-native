import { encodeAlgorandAddress, PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { useFindAccountByAddress } from "@perawallet/wallet-core-accounts"
import { AddressDisplay } from "@components/AddressDisplay"
import { useStyles } from "./styles"
import { PWView, PWText } from "@components/core"
import { useLanguage } from "@hooks/useLanguage"

export const SigningAccountDisplay = ({ transaction }: { transaction: PeraDisplayableTransaction }) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const authAddress = transaction.authAddr?.publicKey ? encodeAlgorandAddress(transaction.authAddr.publicKey) : transaction.sender
    const signingAccount = useFindAccountByAddress(authAddress)

    if (!signingAccount) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <PWText style={styles.title}>{t('signing.transactions.signing_with')}</PWText>
            <AddressDisplay style={styles.fromAddress} address={signingAccount.address} showCopy={false} />
        </PWView>
    )
}