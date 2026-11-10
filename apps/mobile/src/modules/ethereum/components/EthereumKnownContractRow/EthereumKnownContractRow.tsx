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
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWIcon, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumContractLabel } from '../../hooks/useEthereumContractLabel'
import { isKnownContractSite } from '../../utils/isKnownContractSite'
import { useStyles } from './styles'

type EthereumKnownContractRowProps = {
    knownContract: EthereumContractLabel
    address: string
    scope: ChainScope
    source?: SignRequestSource
    /** Origin the platform observed (never dApp-asserted). */
    verifiedOrigin?: string
}

export const EthereumKnownContractRow = ({
    knownContract,
    address,
    scope,
    source,
    verifiedOrigin,
}: EthereumKnownContractRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isSiteMatch = isKnownContractSite(
        knownContract.projectDomain,
        source,
        verifiedOrigin,
    )

    return (
        <KeyValueRow
            testID='ethereum_known_contract'
            title={t('ethereum.known_contract.title')}
            verticalAlignment='top'
        >
            <PWView style={styles.content}>
                <PWView style={styles.name}>
                    <PWText>{knownContract.name}</PWText>
                    <PWIcon
                        testID='ethereum_known_contract_verified'
                        name='assets/verified'
                        size='sm'
                        accessibilityLabel={t(
                            'ethereum.known_contract.verified',
                        )}
                    />
                </PWView>
                <AddressDisplay
                    address={address}
                    displayType='address-only'
                    scope={scope}
                />
                {isSiteMatch && (
                    <PWText
                        testID='ethereum_known_contract_site_match'
                        variant='caption'
                        style={styles.siteMatch}
                    >
                        {t('ethereum.known_contract.matches_site', {
                            domain: knownContract.projectDomain,
                        })}
                    </PWText>
                )}
            </PWView>
        </KeyValueRow>
    )
}
