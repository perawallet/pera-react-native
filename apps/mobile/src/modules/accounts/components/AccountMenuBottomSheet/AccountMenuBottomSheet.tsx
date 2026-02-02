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
