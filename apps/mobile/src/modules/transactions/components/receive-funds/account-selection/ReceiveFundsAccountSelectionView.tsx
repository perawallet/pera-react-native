import PWHeader from '@components/header/PWHeader'
import PWView from '@components/view/PWView'
import { useLanguage } from '@hooks/language'
import { useAllAccounts, WalletAccount } from '@perawallet/wallet-core-accounts'
import { Text } from '@rneui/themed'
import { useStyles } from './styles'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
import AccountWithBalance from '@modules/accounts/components/account-with-balance/AccountWithBalance'

type ReceiveFundsAccountSelectionViewProps = {
    onSelected: (account: WalletAccount) => void
    onClose: () => void
}

const ReceiveFundsAccountSelectionView = ({
    onSelected,
    onClose,
}: ReceiveFundsAccountSelectionViewProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const accounts = useAllAccounts()

    const handleTap = (acct: WalletAccount) => {
        onSelected(acct)
    }

    return (
        <PWView style={styles.container}>
            <PWHeader
                leftIcon='cross'
                onLeftPress={onClose}
            >
                <Text>{t('receive_funds.account_selection.title')}</Text>
            </PWHeader>
            {accounts.map(acct => (
                <PWTouchableOpacity
                    key={acct.address}
                    style={styles.accountItem}
                    onPress={() => handleTap(acct)}
                >
                    <AccountWithBalance account={acct} />
                </PWTouchableOpacity>
            ))}
        </PWView>
    )
}

export default ReceiveFundsAccountSelectionView
