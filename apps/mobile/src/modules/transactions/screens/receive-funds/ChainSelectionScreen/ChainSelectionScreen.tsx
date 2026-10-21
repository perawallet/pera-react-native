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

import { PWButton, PWIcon, PWScrollView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ChainRow } from '@modules/chain-ui'
import { useStyles } from './styles'
import { useChainSelectionScreen } from './useChainSelectionScreen'

export const ChainSelectionScreen = () => {
    const { rows, enablingChainId, handleSelectChain, handleAddChain } =
        useChainSelectionScreen()
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWScrollView contentContainerStyle={styles.container}>
            {rows.map(({ chainId, displayName, address, isEnabled }) => (
                <ChainRow
                    key={chainId}
                    chainId={chainId}
                    title={displayName}
                    subtitle={address}
                    right={
                        isEnabled ? (
                            <PWIcon
                                variant='secondary'
                                name='chevron-right'
                            />
                        ) : (
                            <PWButton
                                variant='helper'
                                icon='plus'
                                paddingStyle='dense'
                                title={t(
                                    'receive_funds.chain_selection.add_action',
                                )}
                                isLoading={enablingChainId === chainId}
                                isDisabled={
                                    enablingChainId !== undefined &&
                                    enablingChainId !== chainId
                                }
                                onPress={() => handleAddChain(chainId)}
                                testID={`receive_chain_add_${chainId}`}
                            />
                        )
                    }
                    onPress={
                        isEnabled ? () => handleSelectChain(chainId) : undefined
                    }
                    testID={`receive_chain_row_${chainId}`}
                />
            ))}
        </PWScrollView>
    )
}
