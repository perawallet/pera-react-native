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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWButton, PWSheetLayout, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import { ChainRow } from '@modules/chain-ui'
import { useChooseNetworksContent } from './useChooseNetworksContent'
import { useStyles } from './styles'

export type ChooseNetworkRow = {
    chainId: ChainId
    displayName: string
    /** Truncated for display; unset when the account holds none in the chain's family yet. */
    address?: string
}

export type ChooseNetworksContentProps = {
    rows: readonly ChooseNetworkRow[]
    selectedChainIds: readonly ChainId[]
    /** Shown as required and never deselected. */
    requiredChainIds: readonly ChainId[]
    /** Called with the chains selected after each toggle. */
    onChange: (chainIds: ChainId[]) => void
}

export const ChooseNetworksContent = ({
    rows,
    selectedChainIds,
    requiredChainIds,
    onChange,
}: ChooseNetworksContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isSelected, isRequired, canToggle, handleToggle } =
        useChooseNetworksContent({
            selectedChainIds,
            requiredChainIds,
            onChange,
        })

    const renderAction = (chainId: ChainId) => {
        if (isRequired(chainId)) {
            return (
                <PWText style={styles.required}>
                    {t('chain_selection.required')}
                </PWText>
            )
        }
        const isOn = isSelected(chainId)
        return (
            <PWButton
                variant={isOn ? 'secondary' : 'helper'}
                paddingStyle='dense'
                title={t(
                    isOn
                        ? 'chain_selection.disable_action'
                        : 'chain_selection.enable_action',
                )}
                isDisabled={!canToggle(chainId)}
                onPress={() => handleToggle(chainId)}
                testID={`choose_networks_toggle_${chainId}`}
            />
        )
    }

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('chain_selection.title')}
                    testID='choose_networks_header'
                />
            }
        >
            <PWView style={styles.list}>
                {rows.map(({ chainId, displayName, address }) => (
                    <ChainRow
                        key={chainId}
                        chainId={chainId}
                        title={displayName}
                        subtitle={address}
                        right={renderAction(chainId)}
                        testID={`choose_networks_row_${chainId}`}
                    />
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
