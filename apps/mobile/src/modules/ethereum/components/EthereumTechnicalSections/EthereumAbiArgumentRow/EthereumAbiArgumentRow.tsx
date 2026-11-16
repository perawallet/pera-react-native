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
import type {
    EvmAbiArgument,
    EvmAbiValue,
} from '@perawallet/wallet-core-chain-ethereum'
import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { ExpandableText } from '@components/ExpandableText'
import { useLanguage } from '@hooks/useLanguage'
import { abiValueText } from '@modules/ethereum/utils/abiValueText'
import { useEthereumAbiArgumentRowStyles } from './styles'

// Enough for a full address or a uint256's digits before "read more".
const VALUE_PREVIEW_LENGTH = 80
const ARRAY_SUFFIX = /\[\d*\]$/

type EthereumAbiArgumentRowProps = {
    argument: EvmAbiArgument
    index: number
    scope: ChainScope
    depth: number
}

export const EthereumAbiArgumentRow = ({
    argument,
    index,
    scope,
    depth,
}: EthereumAbiArgumentRowProps) => {
    const styles = useEthereumAbiArgumentRowStyles()
    const { t } = useLanguage()
    const label =
        argument.name ??
        t('transactions.contract_call.argument_index', { index: index + 1 })

    const nestedOf = (children: EvmAbiArgument[]) =>
        children.map((child, childIndex) => (
            <EthereumAbiArgumentRow
                key={`${childIndex}:${child.name ?? ''}`}
                argument={child}
                index={childIndex}
                scope={scope}
                depth={depth + 1}
            />
        ))

    const valueOf = (value: EvmAbiValue) => {
        switch (value.kind) {
            case 'address': {
                return (
                    <AddressDisplay
                        address={value.value}
                        displayType='full'
                        // An address the user doesn't know is compared in full, never truncated.
                        unnamedAddressFormat='full'
                        scope={scope}
                    />
                )
            }
            case 'array': {
                if (value.items.length === 0) return <PWText>[]</PWText>
                const elementType = argument.type.replace(ARRAY_SUFFIX, '')
                return nestedOf(
                    value.items.map((item, itemIndex) => ({
                        name: `${label}[${itemIndex}]`,
                        type: elementType,
                        value: item,
                    })),
                )
            }
            case 'tuple': {
                return nestedOf(value.fields)
            }
            default: {
                return (
                    <ExpandableText
                        text={abiValueText(value)}
                        limit={VALUE_PREVIEW_LENGTH}
                    />
                )
            }
        }
    }

    return (
        <PWView
            testID='ethereum_verified_call_argument'
            style={depth > 0 ? styles.nested : styles.container}
        >
            <PWView style={styles.header}>
                <PWText>{label}</PWText>
                <PWText
                    variant='caption'
                    style={styles.type}
                >
                    {argument.type}
                </PWText>
            </PWView>
            {valueOf(argument.value)}
        </PWView>
    )
}
