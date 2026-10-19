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

import { formatPrivateKey } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWHeader, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useRevealPrivateKeyContent } from './useRevealPrivateKeyContent'
import { useStyles } from './styles'

export type RevealPrivateKeyContentProps = {
    privateKey: Uint8Array
    chainId: ChainId
    testID?: string
}

export const RevealPrivateKeyContent = ({
    privateKey,
    chainId,
    testID = 'reveal_private_key_bottom_sheet',
}: RevealPrivateKeyContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { dismiss } = useBottomSheetResult<void>()
    useRevealPrivateKeyContent({ privateKey })

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWHeader
                leftIcon='cross'
                onLeftPress={dismiss}
            />
            <PWView style={styles.body}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('reveal_private_key.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('reveal_private_key.body')}
                </PWText>
                <PWView style={styles.valueBox}>
                    {/* Formatted at render only, so no hex copy outlives the sheet. */}
                    <PWText
                        style={styles.value}
                        testID={`${testID}_value`}
                    >
                        {formatPrivateKey(chainId, privateKey)}
                    </PWText>
                </PWView>
            </PWView>
        </PWView>
    )
}
