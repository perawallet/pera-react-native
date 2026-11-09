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

import {
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    findContactByAddress,
    useContacts,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useAccountName } from '@hooks/useAccountName'

export type UseTransactionDetailAddressResult = {
    ownAccount: Nullable<WalletAccount>
    ownAccountName: Optional<string>
    /** Unset for one of the wallet's own accounts, which names it instead. */
    contact: Optional<Contact>
}

export const useTransactionDetailAddress = (
    address: string,
    scope: ChainScope,
): UseTransactionDetailAddressResult => {
    const ownAccount = useFindAccountByAddress(address, scope)
    const { contacts } = useContacts()
    const { getAccountName } = useAccountName()
    const contact = ownAccount
        ? undefined
        : findContactByAddress(
              contacts,
              address,
              getChainDescriptor(scope.chainId).family,
          )

    return {
        ownAccount,
        ownAccountName: ownAccount
            ? getAccountName(ownAccount, scope.chainId)
            : undefined,
        contact,
    }
}
