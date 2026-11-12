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

import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWIcon, PWText, PWTouchableIcon, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import {
    ReviewTarget,
    TechnicalBlock,
    TechnicalSection,
} from '@modules/signing'
import type { EthereumTransactionPresentation } from '@modules/ethereum/hooks/useEthereumTransactionPresentation'
import { EthereumAbiArgumentRow } from './EthereumAbiArgumentRow'
import { EthereumRawCallRows } from './EthereumRawCallRows'
import { useEthereumTechnicalSections } from './useEthereumTechnicalSections'
import { useStyles } from './styles'

const GWEI_DECIMALS = 9

export type EthereumTechnicalSectionsProps = {
    presentation: EthereumTransactionPresentation
    /** The request the transaction is under review in; a history record has none. */
    source?: SignRequestSource
    verifiedOrigin?: string
}

/**
 * The contract a call goes to, the function it runs and the raw call, then
 * the transaction's nonce, gas limit and per-gas fees.
 */
export const EthereumTechnicalSections = ({
    presentation,
    source,
    verifiedOrigin,
}: EthereumTechnicalSectionsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const section = useEthereumTechnicalSections(
        presentation,
        source,
        verifiedOrigin,
    )
    const { view, scope } = presentation
    const gwei = {
        decimals: GWEI_DECIMALS,
        unitName: t('ethereum.pricing.gwei'),
    }
    // The gas labels are long and their values short, so the label wraps rather than truncates.
    const untruncated = { truncate: false }

    return (
        <>
            {section.isContractCall && (
                <TechnicalSection
                    title={t('signing.technical.interacting_with')}
                    testID='ethereum_interacting_with'
                >
                    {section.hasTarget && (
                        <TechnicalBlock
                            label={t('signing.technical.contract')}
                            help={t('signing.technical.contract_help')}
                        >
                            <PWView style={styles.contractRow}>
                                <PWView style={styles.identity}>
                                    {section.contractName ? (
                                        <PWView
                                            style={styles.nameRow}
                                            testID='ethereum_known_contract'
                                        >
                                            <PWText
                                                variant='h4'
                                                style={styles.value}
                                            >
                                                {section.contractName}
                                            </PWText>
                                            <PWIcon
                                                name='check'
                                                size='sm'
                                                variant='positive'
                                                accessibilityLabel={t(
                                                    'ethereum.known_contract.badge',
                                                )}
                                                testID='ethereum_known_contract_verified'
                                            />
                                        </PWView>
                                    ) : (
                                        <ReviewTarget
                                            label={section.shortAddress}
                                            status='unverified'
                                            testID='ethereum_interacting_with_contract'
                                        />
                                    )}
                                    {!!section.contractName && (
                                        <PWText
                                            style={styles.value}
                                            testID='ethereum_contract_call_to'
                                        >
                                            {section.shortAddress}
                                        </PWText>
                                    )}
                                </PWView>
                                <PWTouchableIcon
                                    name='copy'
                                    size='sm'
                                    variant='primary'
                                    onPress={section.handleCopyAddress}
                                    containerStyle={styles.copy}
                                    testID='ethereum_interacting_with_copy'
                                />
                            </PWView>
                            {!!section.matchedDomain && (
                                <PWView
                                    style={styles.match}
                                    testID='ethereum_known_contract_site_match'
                                >
                                    <PWIcon
                                        name='check'
                                        size='xs'
                                        variant='positive'
                                    />
                                    <PWText
                                        variant='captionMedium'
                                        style={styles.matchText}
                                    >
                                        {t('signing.technical.known_match', {
                                            domain: section.matchedDomain,
                                        })}
                                    </PWText>
                                </PWView>
                            )}
                        </TechnicalBlock>
                    )}
                    {section.hasFunction && (
                        <TechnicalBlock
                            label={t('transactions.contract_call.function')}
                        >
                            {section.isLoading ? (
                                <PWText
                                    style={styles.muted}
                                    testID='ethereum_verified_call_loading'
                                >
                                    {t('signing.balance_impact.analyzing')}
                                </PWText>
                            ) : (
                                <>
                                    {!!section.functionName && (
                                        <PWText
                                            variant='h4'
                                            weight={500}
                                            style={styles.value}
                                            testID={
                                                section.isDecoded
                                                    ? 'ethereum_verified_call_function'
                                                    : 'ethereum_interacting_with_function'
                                            }
                                        >
                                            {section.functionName}
                                        </PWText>
                                    )}
                                    {!section.isDecoded && (
                                        <PWText
                                            variant='captionMedium'
                                            weight={400}
                                            style={styles.muted}
                                        >
                                            {t('signing.technical.not_decoded')}
                                        </PWText>
                                    )}
                                </>
                            )}
                            {!!section.implementation && (
                                <KeyValueRow
                                    testID='ethereum_verified_call_implementation'
                                    title={t(
                                        'transactions.contract_call.implementation',
                                    )}
                                >
                                    <AddressDisplay
                                        address={section.implementation}
                                        displayType='address-only'
                                        scope={scope}
                                    />
                                </KeyValueRow>
                            )}
                            {section.arguments.length > 0 && (
                                <PWView style={styles.parameters}>
                                    {section.arguments.map(
                                        (argument, index) => (
                                            <EthereumAbiArgumentRow
                                                key={`${index}:${argument.name ?? ''}`}
                                                argument={argument}
                                                index={index}
                                                scope={scope}
                                                depth={0}
                                            />
                                        ),
                                    )}
                                </PWView>
                            )}
                        </TechnicalBlock>
                    )}
                    <TechnicalBlock>
                        <EthereumRawCallRows presentation={presentation} />
                    </TechnicalBlock>
                </TechnicalSection>
            )}
            {'fee' in view && (
                <TechnicalSection
                    title={t('signing.technical.transaction')}
                    testID='ethereum_detail_advanced'
                >
                    <TechnicalBlock>
                        <KeyValueRow
                            testID='ethereum_nonce'
                            title={t('ethereum.pricing.nonce')}
                        >
                            <PWText>{String(view.nonce)}</PWText>
                        </KeyValueRow>
                        <KeyValueRow
                            testID='ethereum_gas_limit'
                            title={t('ethereum.pricing.gas_limit')}
                            titleProps={untruncated}
                        >
                            <PWText>{view.gas.toString()}</PWText>
                        </KeyValueRow>
                        <KeyValueRow
                            testID='ethereum_max_fee_per_gas'
                            title={t('ethereum.pricing.max_fee_per_gas')}
                            titleProps={untruncated}
                        >
                            <PWText>
                                {formatAssetAmount(view.fee.maxFeePerGas, gwei)}
                            </PWText>
                        </KeyValueRow>
                        <KeyValueRow
                            testID='ethereum_max_priority_fee_per_gas'
                            title={t(
                                'ethereum.pricing.max_priority_fee_per_gas',
                            )}
                            titleProps={untruncated}
                        >
                            <PWText>
                                {formatAssetAmount(
                                    view.fee.maxPriorityFeePerGas,
                                    gwei,
                                )}
                            </PWText>
                        </KeyValueRow>
                    </TechnicalBlock>
                </TechnicalSection>
            )}
        </>
    )
}
