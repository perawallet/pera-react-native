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

import { PWView } from '@components/core'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { ActionRows } from './ActionRows'
import { useStyles } from './styles'

type EthereumContractActionDetailsProps = {
    presentation: EthereumTransactionPresentation
}

/** What a known contract's action does; the contract itself is named in the technical sections. */
export const EthereumContractActionDetails = ({
    presentation,
}: EthereumContractActionDetailsProps) => {
    const styles = useStyles()
    const { contractAction } = presentation

    if (!contractAction) return null

    return (
        <PWView style={styles.container}>
            <ActionRows
                action={contractAction}
                presentation={presentation}
            />
        </PWView>
    )
}
