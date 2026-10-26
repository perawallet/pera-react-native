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
import type { AddressPoisoningRisk } from '@perawallet/wallet-core-transactions'
import { PWCheckbox, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { HighlightedAddress } from './HighlightedAddress'
import { useAddressPoisoningWarningContent } from './useAddressPoisoningWarningContent'
import { useStyles } from './styles'

export type AddressPoisoningDecision = 'continue'

export type AddressPoisoningWarningContentProps = {
    recipient: string
    risk: AddressPoisoningRisk
    scope: ChainScope
}

export const AddressPoisoningWarningContent = ({
    recipient,
    risk,
    scope,
}: AddressPoisoningWarningContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        isAcknowledged,
        setIsAcknowledged,
        recipientSegments,
        similarToSegments,
    } = useAddressPoisoningWarningContent({ recipient, risk })

    return (
        <ConfirmActionContent<AddressPoisoningDecision>
            icon='warning'
            iconVariant='error'
            title={t('send_funds.address_poisoning.title')}
            message={t(
                risk.kind === 'lookalike'
                    ? 'send_funds.address_poisoning.lookalike_body'
                    : 'send_funds.address_poisoning.dust_body',
            )}
            confirmLabel={t('send_funds.address_poisoning.confirm')}
            cancelLabel={t('send_funds.address_poisoning.cancel')}
            confirmValue='continue'
            confirmVariant='destructive'
            isConfirmDisabled={!isAcknowledged}
            testID='address_poisoning_warning'
            confirmTestID='address_poisoning_continue'
            cancelTestID='address_poisoning_cancel'
        >
            <PWView style={styles.body}>
                <PWView style={styles.addressBlock}>
                    <PWText style={styles.label}>
                        {t('send_funds.address_poisoning.recipient_label')}
                    </PWText>
                    <HighlightedAddress
                        segments={recipientSegments}
                        testID='address_poisoning_recipient'
                    />
                </PWView>
                {risk.kind === 'lookalike' && similarToSegments && (
                    <PWView style={styles.addressBlock}>
                        <PWText style={styles.label}>
                            {t('send_funds.address_poisoning.similar_to_label')}
                        </PWText>
                        <AddressDisplay
                            address={risk.similarTo}
                            scope={scope}
                            showCopy={false}
                        />
                        <HighlightedAddress
                            segments={similarToSegments}
                            testID='address_poisoning_similar_to'
                        />
                    </PWView>
                )}
                <PWCheckbox
                    checked={isAcknowledged}
                    onPress={() => setIsAcknowledged(!isAcknowledged)}
                    title={t('send_funds.address_poisoning.acknowledge')}
                    testID='address_poisoning_acknowledge'
                />
            </PWView>
        </ConfirmActionContent>
    )
}
