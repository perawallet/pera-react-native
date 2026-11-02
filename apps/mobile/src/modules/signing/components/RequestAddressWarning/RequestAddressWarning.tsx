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
import { useLanguage } from '@hooks/useLanguage'
import { useRequestAddressSafety } from '../../hooks/useRequestAddressSafety'
import {
    WarningAcknowledgeRow,
    WarningBanner,
    WarningBannerBody,
} from '../WarningBanner'
import { ListedAddress } from './ListedAddress'
import { LookAlikeAddress } from './LookAlikeAddress'

export type RequestAddressWarningProps = {
    /** Defaults to the addresses of the request's transactions. */
    addresses?: readonly ReviewedAddress[]
}

export const RequestAddressWarning = ({
    addresses,
}: RequestAddressWarningProps) => {
    const { t } = useLanguage()
    const {
        flaggedAddresses,
        scope,
        hasListedAddress,
        isAcknowledged,
        toggleAcknowledged,
    } = useRequestAddressSafety({ addresses })

    if (!scope || flaggedAddresses.length === 0) return null

    const hasLookAlike = flaggedAddresses.some(
        ({ assessment }) => assessment.kind === 'look-alike',
    )

    return (
        <WarningBanner
            title={t(
                hasListedAddress
                    ? 'signing.address_safety.listed_title'
                    : 'signing.address_safety.look_alike_title',
            )}
            testID='request_address_warning'
        >
            {hasListedAddress && (
                <WarningBannerBody testID='request_address_listed_body'>
                    {t('signing.address_safety.listed_body')}
                </WarningBannerBody>
            )}
            {/* A request can name both, and the look-alike rows need their own explanation. */}
            {hasLookAlike && (
                <WarningBannerBody testID='request_address_look_alike_body'>
                    {t('signing.address_safety.look_alike_body')}
                </WarningBannerBody>
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
            {!hasListedAddress && (
                <WarningAcknowledgeRow
                    label={t('signing.address_safety.acknowledge')}
                    isChecked={isAcknowledged}
                    onToggle={toggleAcknowledged}
                    testID='request_address_acknowledge'
                />
            )}
        </WarningBanner>
    )
}
