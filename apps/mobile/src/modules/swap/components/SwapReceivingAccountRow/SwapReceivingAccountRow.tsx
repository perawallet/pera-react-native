/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { SelectableAccountRow } from '@components/SelectableAccountRow'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type SwapReceivingAccountRowProps = {
    account: WalletAccount
    scope: ChainScope
    onPress: () => void
}

export const SwapReceivingAccountRow = ({
    account,
    scope,
    onPress,
}: SwapReceivingAccountRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <PWText
                variant='caption'
                style={styles.label}
            >
                {t('swap.receiving_account.label')}
            </PWText>
            <SelectableAccountRow
                account={account}
                chainId={scope.chainId}
                onSelect={onPress}
                testID='swap_receiving_account'
            />
        </PWView>
    )
}
