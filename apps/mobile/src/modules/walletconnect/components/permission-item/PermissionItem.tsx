import PWIcon from "@components/icons/PWIcon"
import PWView from "@components/view/PWView"
import { Text } from "@rneui/themed"
import { useStyles } from "./styles"
import { ALL_PERMISSIONS, AlgorandPermission } from "@perawallet/wallet-core-walletconnect"
import { useLanguage } from "@hooks/language"

const PermissionItem = ({ permission }: { permission: AlgorandPermission }) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const getPermissionTitle = (permission: AlgorandPermission) => {
        switch (permission) {
            case AlgorandPermission.TX_PERMISSION:
                return t('walletconnect.request.permissions_sign_transaction')
            case AlgorandPermission.DATA_PERMISSION:
                return t('walletconnect.request.permissions_sign_data')
            case AlgorandPermission.ACCOUNT_PERMISSION:
                return t('walletconnect.request.permissions_request_accounts')
            default:
                return permission
        }
    }
    return (
        <PWView style={styles.permissionItemContainer}>
            <PWIcon
                name='check'
                variant='positive'
            />
            <Text>{getPermissionTitle(permission)}</Text>
        </PWView>
    )
}

export default PermissionItem
