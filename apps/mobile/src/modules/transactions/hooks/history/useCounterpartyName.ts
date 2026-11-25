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

import { useMemo } from 'react'
import {
    findAccountByAddressOn,
    getAccountDisplayName,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    getChainDescriptor,
    useChainCapability,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    findContactByAddress,
    useContacts,
} from '@perawallet/wallet-core-contacts'
import { useResolvedAddress } from '@hooks/useResolvedAddress'

/**
 * Resolved as `AddressDisplay` does: the wallet's own account, then a contact,
 * then the chain's name service. The name-service lookup only runs on a chain
 * that has one and only when nothing local matched, so another chain's address
 * is never sent to it; the fallback is the address truncated with that chain's
 * codec. An empty address skips every lookup.
 */
export const useCounterpartyName = (
    address: string,
    chainId: ChainId,
): string => {
    const accounts = useAllAccounts()
    const { contacts } = useContacts()
    const localName = useMemo(() => {
        if (!address) return undefined
        const account = findAccountByAddressOn(accounts, chainId, address)
        if (account) return getAccountDisplayName(account, chainId)
        return findContactByAddress(
            contacts,
            address,
            getChainDescriptor(chainId).family,
        )?.name
    }, [address, accounts, contacts, chainId])

    const hasNameService = useChainCapability(chainId, 'nameService')
    const { displayName } = useResolvedAddress(
        address,
        useSelectedScope(chainId),
        { enabled: !!address && hasNameService && localName === undefined },
    )
    return localName ?? displayName
}
