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

import { type Decimal } from 'decimal.js'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'

export const QUANTUM_FEE_EXPLAINER_TEST_ID = 'quantum-fee-explainer'

export type QuantumFeeExplainerProps = {
    /**
     * When present, the explainer describes a fee Pera raised to the quantum
     * minimum (original → adjusted) instead of the generic quantum-fee premium.
     * Both fees are in ALGO display units.
     */
    adjustment?: {
        originalFee: Decimal
        adjustedFee: Decimal
    }
}

/**
 * Presentation-only affordance rendered next to a transaction fee when the
 * effective signer is a Quantum account. It surfaces the quantum-fee premium
 * (an (i) icon that opens a bottom-sheet explainer) so users understand why
 * the network fee is higher than for standard accounts. The show/hide decision
 * lives in the colocated screen hooks — this component only renders.
 *
 * When `adjustment` is provided (PQ-017), the explainer instead reports that
 * Pera raised the dApp's below-minimum fee, showing the original and adjusted
 * amounts.
 */
export const QuantumFeeExplainer = ({
    adjustment,
}: QuantumFeeExplainerProps = {}) => {
    const { t } = useLanguage()

    if (adjustment) {
        return (
            <InfoButton
                variant='secondary'
                title={t('transactions.quantum_fee.adjusted_title')}
                testID={QUANTUM_FEE_EXPLAINER_TEST_ID}
            >
                {t('transactions.quantum_fee.adjusted_body', {
                    originalFee: adjustment.originalFee.toString(),
                    adjustedFee: adjustment.adjustedFee.toString(),
                })}
            </InfoButton>
        )
    }

    return (
        <InfoButton
            variant='secondary'
            title={t('transactions.quantum_fee.title')}
            testID={QUANTUM_FEE_EXPLAINER_TEST_ID}
        >
            {t('transactions.quantum_fee.body')}
        </InfoButton>
    )
}
