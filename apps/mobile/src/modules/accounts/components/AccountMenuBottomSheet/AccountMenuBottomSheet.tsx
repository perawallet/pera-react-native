import { PWBottomSheet } from '@components/core'
import { AccountMenu } from '@modules/accounts/components/AccountMenu'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'

export type AccountMenuBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onSelected: (account: WalletAccount) => void
    showInbox?: boolean
}

export const AccountMenuBottomSheet = ({
    isVisible,
    onClose,
    onSelected,
    showInbox,
}: AccountMenuBottomSheetProps) => {
    const styles = useStyles()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <AccountMenu onSelected={onSelected} showInbox={showInbox} />
        </PWBottomSheet>
    )
}
