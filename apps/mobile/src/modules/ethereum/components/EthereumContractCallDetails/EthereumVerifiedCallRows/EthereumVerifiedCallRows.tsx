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
import type { EvmVerifiedCall } from '@perawallet/wallet-core-chain-ethereum'
import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { EthereumAbiArgumentRow } from './EthereumAbiArgumentRow'
import { useEthereumVerifiedCallRowsStyles } from './styles'

type EthereumVerifiedCallRowsProps = {
    call: EvmVerifiedCall
    scope: ChainScope
}

export const EthereumVerifiedCallRows = ({
    call,
    scope,
}: EthereumVerifiedCallRowsProps) => {
    const styles = useEthereumVerifiedCallRowsStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <KeyValueRow
                testID='ethereum_verified_call_function'
                title={t('transactions.contract_call.function')}
                verticalAlignment='top'
            >
                <PWView style={styles.function}>
                    <PWText>{call.functionName}</PWText>
                    <PWText
                        testID='ethereum_verified_call_source'
                        variant='caption'
                        style={styles.caption}
                    >
                        {call.proxy
                            ? t('transactions.contract_call.known_source_proxy')
                            : t('transactions.contract_call.known_source')}
                    </PWText>
                </PWView>
            </KeyValueRow>

            {!!call.proxy && (
                <KeyValueRow
                    testID='ethereum_verified_call_implementation'
                    title={t('transactions.contract_call.implementation')}
                >
                    <AddressDisplay
                        address={call.proxy.implementation}
                        displayType='address-only'
                        scope={scope}
                    />
                </KeyValueRow>
            )}

            {call.arguments.length > 0 && (
                <PWView style={styles.arguments}>
                    <PWText style={styles.caption}>
                        {t('transactions.contract_call.arguments')}
                    </PWText>
                    {call.arguments.map((argument, index) => (
                        <EthereumAbiArgumentRow
                            key={`${index}:${argument.name ?? ''}`}
                            argument={argument}
                            index={index}
                            scope={scope}
                            depth={0}
                        />
                    ))}
                </PWView>
            )}
        </PWView>
    )
}
