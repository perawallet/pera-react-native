/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { PWTouchableIcon, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import type { Participant } from '../../hooks/useMultisigCreation'
import { useStyles } from './styles'

type ParticipantListItemProps = {
    participant: Participant
    index: number
    isInWallet: boolean
    onEdit: (index: number) => void
    onRemove: (index: number) => void
}

export const ParticipantListItem = ({
    participant,
    index,
    isInWallet,
    onEdit,
    onRemove,
}: ParticipantListItemProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.container}
            testID={`participant_item_${index}_${participant.address}`}
        >
            <AddressDisplay
                address={participant.address}
                showCopy={false}
                forceShowIcon
                style={styles.addressDisplay}
            />
            {isInWallet ? (
                <PWTouchableIcon
                    name='trash'
                    size='md'
                    variant='error'
                    onPress={() => onRemove(index)}
                    testID={`participant_remove_${index}_${participant.address}`}
                />
            ) : (
                <PWTouchableIcon
                    name='edit-pen'
                    size='md'
                    variant='positive'
                    onPress={() => onEdit(index)}
                    testID={`participant_edit_${index}_${participant.address}`}
                />
            )}
        </PWView>
    )
}
