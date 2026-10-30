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

import { useCallback, useMemo } from 'react'
import {
    CHAIN_FAMILIES,
    LEGACY_CHAIN_ID,
    type ChainDescriptor,
    type ChainFamily,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { type Contact, useContacts } from '@perawallet/wallet-core-contacts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import {
    selectChainNetworkId,
    useNetworkStore,
    useSelectedScope,
    useSwitchedOffChainIds,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { useBottomSheet } from '@modules/bottom-sheet'
import { ContactNetworkContent } from '@modules/contacts/components/ContactNetworkContent'
import { ContactQRContent } from '@modules/contacts/components/ContactQRContent'
import { useWebView } from '@modules/webview'
import { shareText } from '@utils/shareText'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useClipboard } from '@hooks/useClipboard'

export type ViewContactAddressRow = {
    family: ChainFamily
    address: string
    /** False when no network of the family has an explorer, such as a custom one. */
    hasExplorer: boolean
}

export type UseViewContactScreenResult = {
    selectedContact: Maybe<Contact>
    /** One per family the contact holds an address on, in family order. */
    addressRows: ViewContactAddressRow[]
    nfdName: Optional<string>
    openQR: (family: ChainFamily) => void
    copyAddress: (address: string) => void
    openExplorer: (family: ChainFamily, address: string) => Promise<void>
    goToEdit: () => void
    handleShare: () => Promise<void>
}

// App code may not compare `.family` (pera/no-chain-identity-in-shared-packages), so group by it.
const chainsOfFamily = (family: ChainFamily): ChainDescriptor[] => {
    const byFamily = new Map<ChainFamily, ChainDescriptor[]>()
    for (const descriptor of getProvider().chains.list()) {
        byFamily.set(descriptor.family, [
            ...(byFamily.get(descriptor.family) ?? []),
            descriptor,
        ])
    }
    return byFamily.get(family) ?? []
}

export const useViewContactScreen = (): UseViewContactScreenResult => {
    // NFDs name Algorand addresses only.
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { selectedContact } = useContacts()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const { copyToClipboard } = useClipboard()
    const { pushWebView } = useWebView()
    const mode = useWalletDeployment()
    const selectedNetworkByChain = useNetworkStore(
        state => state.selectedNetworkByChain,
    )
    const customNetworksByChain = useNetworkStore(
        state => state.customNetworksByChain,
    )
    const switchedOff = useSwitchedOffChainIds()
    const networkSelection = useMemo(
        () => ({ mode, selectedNetworkByChain, customNetworksByChain }),
        [mode, selectedNetworkByChain, customNetworksByChain],
    )

    const algorandAddress = selectedContact?.addresses.algorand ?? ''
    const { data: nfdNames } = useNfdForAddressQuery(scope, algorandAddress, {
        enabled: !!algorandAddress,
    })
    const nfdName = nfdNames?.at(0)?.name

    // An address is shared by every chain of its family, but each chain has its
    // own explorer on the network the user has selected for it. A switched-off
    // chain is left out, as every other chain picker does.
    const explorerLinks = useCallback(
        (family: ChainFamily, address: string): Map<ChainId, string> =>
            new Map(
                chainsOfFamily(family).flatMap(({ id, explorer }) => {
                    if (switchedOff.includes(id)) return []
                    const url = explorer.accountUrl(
                        selectChainNetworkId(networkSelection, id),
                        address,
                    )
                    return url ? [[id, url] as const] : []
                }),
            ),
        [networkSelection, switchedOff],
    )

    const addressRows = useMemo(
        (): ViewContactAddressRow[] =>
            CHAIN_FAMILIES.flatMap(family => {
                const address = selectedContact?.addresses[family]
                return address
                    ? [
                          {
                              family,
                              address,
                              hasExplorer:
                                  explorerLinks(family, address).size > 0,
                          },
                      ]
                    : []
            }),
        [selectedContact, explorerLinks],
    )

    const openQR = useCallback(
        (family: ChainFamily) => {
            if (!selectedContact) return
            void requestBottomSheet<void>({
                contents: (
                    <ContactQRContent
                        contact={selectedContact}
                        initialFamily={family}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
        },
        [requestBottomSheet, selectedContact],
    )

    const copyAddress = useCallback(
        (address: string) => void copyToClipboard(address),
        [copyToClipboard],
    )

    const openExplorer = useCallback(
        async (family: ChainFamily, address: string) => {
            const links = explorerLinks(family, address)
            const chainIds = [...links.keys()]
            const chainId =
                chainIds.length > 1
                    ? await requestBottomSheet<ChainId>({
                          contents: (
                              <ContactNetworkContent chainIds={chainIds} />
                          ),
                          // The body scrolls once a family has more networks than fit.
                          options: {
                              size: 'auto',
                              enablePanDownToClose: true,
                              autoCreateContainer: false,
                          },
                      })
                    : chainIds[0]
            const url = chainId ? links.get(chainId) : undefined
            // oxlint-disable-next-line pera/no-unvalidated-open-url -- chain descriptor explorer links
            if (url) pushWebView({ url })
        },
        [explorerLinks, requestBottomSheet, pushWebView],
    )

    const goToEdit = useCallback(() => {
        navigation.navigate('EditContact')
    }, [navigation])

    const handleShare = useCallback(async () => {
        if (!selectedContact) return
        try {
            await shareText({
                title: selectedContact.name,
                message: addressRows.map(({ address }) => address).join('\n'),
            })
        } catch {
            // User cancelled — ignore.
        }
    }, [selectedContact, addressRows])

    return {
        selectedContact,
        addressRows,
        nfdName,
        openQR,
        copyAddress,
        openExplorer,
        goToEdit,
        handleShare,
    }
}
