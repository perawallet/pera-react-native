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
import { ContactAvatar } from '@components/ContactAvatar'
import { useStyles } from './styles'
import { useTransactionDetailAddress } from './useTransactionDetailAddress'

export type TransactionDetailAddressProps = {
    address: string
    scope: ChainScope
    /** Prefixes the account or contact line's test id. */
    testID?: string
}

/** The address with its copy action, then the wallet account or contact it belongs to. */
export const TransactionDetailAddress = ({
    address,
    scope,
    testID,
}: TransactionDetailAddressProps) => {
    const styles = useStyles()
    const { ownAccount, ownAccountName, contact } = useTransactionDetailAddress(
        address,
        scope,
    )

    return (
        <PWView style={styles.container}>
            <AddressDisplay
                address={address}
                scope={scope}
                displayType='inline'
                addressFormat='short'
                textProps={{ variant: 'bodyLarge', weight: 400 }}
                hugContent
            />
            {!!ownAccount && (
                <PWView
                    style={styles.owner}
                    testID={testID && `${testID}_account`}
                >
                    <AccountIcon
                        account={ownAccount}
                        size='sm'
                    />
                    <PWText
                        variant='footnoteMedium'
                        style={styles.ownerName}
                        truncate
                    >
                        {ownAccountName}
                    </PWText>
                </PWView>
            )}
            {!!contact && (
                <PWView
                    style={styles.owner}
                    testID={testID && `${testID}_contact`}
                >
                    <ContactAvatar
                        contact={contact}
                        size='sm'
                    />
                    <PWText
                        variant='footnoteMedium'
                        style={styles.ownerName}
                        truncate
                    >
                        {contact.name}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}
