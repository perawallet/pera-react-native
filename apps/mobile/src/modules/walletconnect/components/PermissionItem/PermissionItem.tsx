/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import PWIcon from '@components/PWIcon'
import PWView from '@components/PWView'
import { Text } from '@rneui/themed'
import { useStyles } from './styles'
import { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'
import { useLanguage } from '@hooks/language'

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
