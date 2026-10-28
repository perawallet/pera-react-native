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
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { RecipientAssessment } from '@perawallet/wallet-core-transactions'
import {
    PWCheckbox,
    PWLoadingIndicator,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { InfoCallout } from '@components/InfoCallout'
import { useLanguage } from '@hooks/useLanguage'
import { getTestProps } from '@utils/test-id-helper'
import {
    ComparedAddress,
    KNOWN_LABEL_KEYS,
} from '../../../components/address-safety/ComparedAddress'
import { diffAddresses } from '../../../utils/diffAddresses'
import { useStyles } from './styles'

export type RecipientSafetyNoticeProps = {
    assessment: Optional<RecipientAssessment>
    isChecking: boolean
    recipient: string
    scope: ChainScope
    isAcknowledged: boolean
    onToggleAcknowledged: () => void
}

export const RecipientSafetyNotice = ({
    assessment,
    isChecking,
    recipient,
    scope,
    isAcknowledged,
    onToggleAcknowledged,
}: RecipientSafetyNoticeProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    if (isChecking) {
        return (
            <PWView
                style={styles.checking}
                testID='recipient_safety_checking'
            >
                <PWLoadingIndicator />
                <PWText style={styles.label}>
                    {t('send_funds.recipient_safety.checking')}
                </PWText>
            </PWView>
        )
    }

    if (assessment?.kind === 'first-send') {
        return (
            <InfoCallout
                title={t('send_funds.recipient_safety.first_send_title')}
                body={t('send_funds.recipient_safety.first_send_body')}
                style={styles.firstSend}
                testID='recipient_first_send_notice'
            />
        )
    }

    if (assessment?.kind !== 'look-alike') return null

    const codec = addressCodecs.get(scope.chainId)
    const { knownAddress } = assessment
    const diff = diffAddresses(
        codec.normalize(recipient),
        codec.normalize(knownAddress.address),
    )

    return (
        <PWView
            style={styles.warning}
            testID='recipient_look_alike_warning'
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
                    {t('send_funds.recipient_safety.look_alike_title')}
                </PWText>
            </PWView>
            <PWText style={styles.body}>
                {t('send_funds.recipient_safety.look_alike_body')}
            </PWText>
            <ComparedAddress
                label={t(
                    'send_funds.recipient_safety.look_alike_recipient_label',
                )}
                segments={diff.a}
                testID='recipient_look_alike_recipient_address'
            />
            <ComparedAddress
                label={t(KNOWN_LABEL_KEYS[knownAddress.source], {
                    name:
                        knownAddress.name ??
                        codec.truncate(knownAddress.address),
                })}
                segments={diff.b}
                testID='recipient_look_alike_known_address'
            />
            <PWTouchableOpacity
                style={styles.acknowledge}
                onPress={onToggleAcknowledged}
                {...getTestProps('recipient_look_alike_acknowledge')}
            >
                <PWCheckbox
                    checked={isAcknowledged}
                    onPress={onToggleAcknowledged}
                />
                <PWText style={styles.acknowledgeLabel}>
                    {t('send_funds.recipient_safety.look_alike_acknowledge')}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
