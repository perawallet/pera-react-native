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

import { useMemo } from 'react'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type {
    ReviewedAddress,
    ReviewedAddressRole,
} from '@perawallet/wallet-core-signing'
import {
    PWCheckbox,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ProjectVerificationIcon } from '@modules/projects'
import {
    ComparedAddress,
    diffAddresses,
    KNOWN_LABEL_KEYS,
} from '@modules/transactions'
import {
    useRequestAddressSafety,
    type FlaggedRequestAddress,
} from '../../hooks/useRequestAddressSafety'
import { useStyles } from './styles'

export type RequestAddressWarningProps = {
    /** Defaults to the addresses of the request's transactions. */
    addresses?: readonly ReviewedAddress[]
}

const ROLE_LABEL_KEYS = {
    recipient: 'signing.address_safety.role.recipient',
    'token-recipient': 'signing.address_safety.role.token_recipient',
    'close-recipient': 'signing.address_safety.role.close_recipient',
    'new-authorizer': 'signing.address_safety.role.new_authorizer',
    'referenced-account': 'signing.address_safety.role.referenced_account',
    target: 'signing.address_safety.role.target',
    spender: 'signing.address_safety.role.spender',
    operator: 'signing.address_safety.role.operator',
} as const satisfies Record<ReviewedAddressRole, string>

type ListedAddressProps = {
    flagged: FlaggedRequestAddress
    index: number
}

const ListedAddress = ({ flagged, index }: ListedAddressProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.address}>
            <PWView style={styles.addressHeader}>
                <ProjectVerificationIcon
                    tier='suspicious'
                    size='sm'
                    testID={`request_address_listed_badge_${index}`}
                />
                <PWText
                    variant='caption'
                    style={styles.label}
                >
                    {t(ROLE_LABEL_KEYS[flagged.role])}
                </PWText>
            </PWView>
            <PWText
                style={styles.fullAddress}
                testID={`request_address_listed_${index}`}
            >
                {flagged.address}
            </PWText>
        </PWView>
    )
}

type LookAlikeAddressProps = {
    flagged: FlaggedRequestAddress
    index: number
    chainId: ChainId
}

const LookAlikeAddress = ({
    flagged,
    index,
    chainId,
}: LookAlikeAddressProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const comparison = useMemo(() => {
        if (flagged.assessment.kind !== 'look-alike') return undefined
        const codec = addressCodecs.get(chainId)
        const { knownAddress } = flagged.assessment
        return {
            diff: diffAddresses(
                codec.normalize(flagged.address),
                codec.normalize(knownAddress.address),
            ),
            knownLabel: t(KNOWN_LABEL_KEYS[knownAddress.source], {
                name: knownAddress.name ?? codec.truncate(knownAddress.address),
            }),
        }
    }, [flagged, chainId, t])

    if (!comparison) return null

    return (
        <PWView style={styles.address}>
            <ComparedAddress
                label={t(ROLE_LABEL_KEYS[flagged.role])}
                segments={comparison.diff.a}
                testID={`request_address_look_alike_${index}`}
            />
            <ComparedAddress
                label={comparison.knownLabel}
                segments={comparison.diff.b}
                testID={`request_address_look_alike_known_${index}`}
            />
        </PWView>
    )
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
                    testID='request_address_listed_body'
                >
                    {t('signing.address_safety.listed_body')}
                </PWText>
            )}
            {/* A request can name both, and the look-alike rows need their own explanation. */}
            {hasLookAlike && (
                <PWText
                    style={styles.body}
                    testID='request_address_look_alike_body'
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
                testID='request_address_acknowledge'
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
