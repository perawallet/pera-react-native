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
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { PWIcon } from '@components/core'
import { AddressEntryField } from '@components/AddressEntryField'
import type { SearchableListSearchProps } from '@components/SearchableList'
import { useStyles } from './styles'

// The search view lists the legacy chain's accounts (see useAddressSearchView).
const SEARCH_CHAIN_IDS: readonly ChainId[] = [LEGACY_CHAIN_ID]

export const AddressSearchInput = ({
    value,
    placeholder,
    onChangeText,
    onFocus,
}: SearchableListSearchProps) => {
    const styles = useStyles()

    return (
        <AddressEntryField
            chainIds={SEARCH_CHAIN_IDS}
            onChangeText={onChangeText}
            value={value}
            allowQRCode
            onScanned={onChangeText}
            placeholder={placeholder}
            inputContainerStyle={styles.searchField}
            containerStyle={styles.searchContainer}
            onFocus={onFocus}
            testID='address_search_input'
            leftIcon={
                <PWIcon
                    variant='secondary'
                    name='magnifying-glass'
                />
            }
        />
    )
}
