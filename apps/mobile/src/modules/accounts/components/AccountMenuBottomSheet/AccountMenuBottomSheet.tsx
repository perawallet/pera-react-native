import { PWBottomSheet, PWIcon, PWToolbar } from '@components/core'
import { AccountMenu } from '@modules/accounts/components/AccountMenu'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'

export type AccountMenuBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onSelected: (account: WalletAccount) => void
}

export const AccountMenuBottomSheet = ({
    isVisible,
    onClose,
    onSelected,
}: AccountMenuBottomSheetProps) => {
    const styles = useStyles()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <PWToolbar
                right={
                    <PWIcon
                        name='cross'
                        onPress={onClose}
                    />
                }
            />
            <AccountMenu onSelected={onSelected} />
        </PWBottomSheet>
    )
}
