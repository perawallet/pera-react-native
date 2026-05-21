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

import React from 'react'
import { PWView, PWFlatList, PWLoadingOverlay } from '@components/core'

import { useStyles } from './styles'
import { useImportRekeyedAddressesScreen } from './useImportRekeyedAddressesScreen'
import { ImportRekeyedAddressesItem } from './ImportRekeyedAddressesItem'
import { ImportRekeyedAddressesHeader } from './ImportRekeyedAddressesHeader'
import { ImportRekeyedAddressesFooter } from './ImportRekeyedAddressesFooter'

export const ImportRekeyedAddressesScreen = () => {
    const styles = useStyles()
    const {
        accounts,
        selectedAddresses,
        canContinue,
        isImporting,
        alreadyImportedAddresses,
        toggleSelection,
        handleContinue,
        handleSkip,
        t,
    } = useImportRekeyedAddressesScreen()

    return (
        <PWView
            style={styles.container}
            testID='import_rekeyed_addresses_screen'
        >
            <PWFlatList
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={() => (
                    <ImportRekeyedAddressesHeader
                        accountsCount={accounts.length}
                    />
                )}
                data={accounts}
                extraData={selectedAddresses}
                keyExtractor={item => item.address}
                renderItem={({ item, index }) => (
                    <ImportRekeyedAddressesItem
                        account={item}
                        itemIndex={index}
                        isImported={alreadyImportedAddresses.has(item.address)}
                        isSelected={selectedAddresses.has(item.address)}
                        onToggle={toggleSelection}
                    />
                )}
            />
            <ImportRekeyedAddressesFooter
                onContinue={handleContinue}
                onSkip={handleSkip}
                canContinue={canContinue}
            />
            <PWLoadingOverlay
                isVisible={isImporting}
                title={t(
                    'onboarding.import_rekeyed_addresses.importing_accounts',
                )}
            />
        </PWView>
    )
}
