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

import { PWText, PWToolbar, PWTouchableIcon, PWView } from '@components/core'
import { AddressSearchView } from '@components/AddressSearchView'
import {
    AccountTypes,
    type AccountType,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useAddParticipantContent } from './useAddParticipantContent'
import { useStyles } from './styles'

// Quantum (Falcon) accounts are excluded because Algorand multisig is
// Ed25519-only — a quantum key can never be a valid participant.
const EXCLUDE_TYPES: AccountType[] = [
    AccountTypes.multisig,
    AccountTypes.watch,
    AccountTypes.quantum,
]

export type AddParticipantContentProps = Record<string, never>

export const AddParticipantContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleSelected, dismiss } = useAddParticipantContent()

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWTouchableIcon
                        name='cross'
                        variant='primary'
                        size='md'
                        onPress={dismiss}
                    />
                }
                center={
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {t('multisig.add_participant.title')}
                    </PWText>
                }
                paddingStyle='dense'
            />
            <AddressSearchView
                onSelected={handleSelected}
                excludeTypes={EXCLUDE_TYPES}
                showAllContactsWhenEmpty
                inBottomSheet
                showAddIcon
                showAccountBalance
            />
        </PWView>
    )
}
