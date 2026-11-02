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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { AccountIcon } from '@components/AccountIcon'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useStyles } from './styles'
import { useTransactionDetailAddressRow } from './useTransactionDetailAddressRow'

type TransactionDetailAddressRowProps = {
    title: string
    address: string
    scope: ChainScope
    testID?: string
}

export const TransactionDetailAddressRow = ({
    title,
    address,
    scope,
    testID,
}: TransactionDetailAddressRowProps) => {
    const styles = useStyles()
    const { ownAccount, ownAccountName } = useTransactionDetailAddressRow(
        address,
        scope,
    )

    return (
        <KeyValueRow
            testID={testID}
            title={title}
            verticalAlignment='top'
        >
            <AddressDisplay
                address={address}
                scope={scope}
                displayType='simple'
                addressFormat='short'
            />
            {!!ownAccount && (
                <PWView
                    style={styles.ownAccount}
                    testID={testID && `${testID}_account`}
                >
                    <AccountIcon
                        account={ownAccount}
                        size='sm'
                    />
                    <PWText
                        variant='footnoteMedium'
                        style={styles.ownAccountName}
                        truncate
                    >
                        {ownAccountName}
                    </PWText>
                </PWView>
            )}
        </KeyValueRow>
    )
}
