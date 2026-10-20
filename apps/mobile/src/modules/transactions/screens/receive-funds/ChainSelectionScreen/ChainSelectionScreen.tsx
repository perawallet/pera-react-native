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
    PWLoadingIndicator,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { getTestProps } from '@utils/test-id-helper'
import { ChainIcon } from '@modules/chain-ui'
import { useStyles } from './styles'
import { useChainSelectionScreen } from './useChainSelectionScreen'

export const ChainSelectionScreen = () => {
    const { rows, enablingChainId, handleSelectChain } =
        useChainSelectionScreen()
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWScrollView contentContainerStyle={styles.container}>
            {rows.map(({ chainId, displayName, isEnabled }) => (
                <PWTouchableOpacity
                    key={chainId}
                    style={styles.row}
                    onPress={() => handleSelectChain(chainId)}
                    disabled={enablingChainId !== undefined}
                    {...getTestProps(`receive_chain_row_${chainId}`)}
                >
                    <ChainIcon chainId={chainId} />
                    <PWView style={styles.labels}>
                        <PWText style={styles.title}>{displayName}</PWText>
                        {isEnabled ? null : (
                            <PWText
                                variant='caption'
                                style={styles.subtitle}
                            >
                                {t(
                                    'receive_funds.chain_selection.eligible_subtitle',
                                )}
                            </PWText>
                        )}
                    </PWView>
                    {enablingChainId === chainId ? (
                        <PWLoadingIndicator />
                    ) : null}
                </PWTouchableOpacity>
            ))}
        </PWScrollView>
    )
}
