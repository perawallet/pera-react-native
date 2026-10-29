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

import type { ReviewedAddress } from '@perawallet/wallet-core-signing'
import {
    PWCheckbox,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { getTestProps } from '@utils/test-id-helper'
import { useRequestAddressSafety } from '../../hooks/useRequestAddressSafety'
import { useStyles } from './styles'
import { ListedAddress } from './ListedAddress'
import { LookAlikeAddress } from './LookAlikeAddress'

export type RequestAddressWarningProps = {
    /** Defaults to the addresses of the request's transactions. */
    addresses?: readonly ReviewedAddress[]
}

export const RequestAddressWarning = ({
    addresses,
}: RequestAddressWarningProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { flaggedAddresses, scope, isAcknowledged, toggleAcknowledged } =
        useRequestAddressSafety({ addresses })

    if (!scope || flaggedAddresses.length === 0) return null

    const hasListed = flaggedAddresses.some(
        ({ assessment }) => assessment.kind === 'listed',
    )
    const hasLookAlike = flaggedAddresses.some(
        ({ assessment }) => assessment.kind === 'look-alike',
    )

    return (
        <PWView
            style={styles.warning}
            testID='request_address_warning'
        >
            <PWView style={styles.header}>
                <PWRoundIcon
                    icon='info'
                    size='md'
                    variant='error'
                />
                <PWText
                    variant='bodySemibold'
                    style={styles.title}
                >
                    {t(
                        hasListed
                            ? 'signing.address_safety.listed_title'
                            : 'signing.address_safety.look_alike_title',
                    )}
                </PWText>
            </PWView>
            {hasListed && (
                <PWText
                    style={styles.body}
                    {...getTestProps('request_address_listed_body')}
                >
                    {t('signing.address_safety.listed_body')}
                </PWText>
            )}
            {/* A request can name both, and the look-alike rows need their own explanation. */}
            {hasLookAlike && (
                <PWText
                    style={styles.body}
                    {...getTestProps('request_address_look_alike_body')}
                >
                    {t('signing.address_safety.look_alike_body')}
                </PWText>
            )}
            {flaggedAddresses.map((flagged, index) =>
                flagged.assessment.kind === 'listed' ? (
                    <ListedAddress
                        key={flagged.address}
                        flagged={flagged}
                        index={index}
                    />
                ) : (
                    <LookAlikeAddress
                        key={flagged.address}
                        flagged={flagged}
                        index={index}
                        chainId={scope.chainId}
                    />
                ),
            )}
            <PWTouchableOpacity
                style={styles.acknowledge}
                onPress={toggleAcknowledged}
                {...getTestProps('request_address_acknowledge')}
            >
                <PWCheckbox
                    checked={isAcknowledged}
                    onPress={toggleAcknowledged}
                />
                <PWText style={styles.acknowledgeLabel}>
                    {t('signing.address_safety.acknowledge')}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
