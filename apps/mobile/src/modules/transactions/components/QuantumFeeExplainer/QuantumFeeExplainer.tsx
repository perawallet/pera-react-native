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

import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'

export const QUANTUM_FEE_EXPLAINER_TEST_ID = 'quantum-fee-explainer'

/**
 * Presentation-only affordance rendered next to a transaction fee when the
 * effective signer is a Quantum account. It surfaces the quantum-fee premium
 * (an (i) icon that opens a bottom-sheet explainer) so users understand why
 * the network fee is higher than for standard accounts. The show/hide decision
 * lives in the colocated screen hooks — this component only renders.
 */
export const QuantumFeeExplainer = () => {
    const { t } = useLanguage()

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
