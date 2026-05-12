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

import {
    FINALIZED_SIGN_REQUEST_STATUSES,
    type MultisigSignRequest,
    type SignRequestStatus,
} from '@perawallet/wallet-core-multisig'
import type { SignerStatus } from '../components/SignerStatusListItem'

export type SignerRow = {
    address: string
    status: SignerStatus
    /**
     * True when the participant slot is a hardware-wallet account in an
     * actionable state — i.e. the row is *eligible* to show the per-row
     * Sign button. Not folded with `isSigning`; the consumer combines them
     * to decide whether to render the button (button shows when
     * `canSignAsHardware || isSigning`).
     */
    canSignAsHardware: boolean
    isSigning: boolean
}

type BuildSignerRowsParams = {
    signRequest: MultisigSignRequest
    status: SignRequestStatus | null
    hardwareUnsignedSet: Set<string>
    inFlightCosignAddresses: Set<string>
}

export const buildSignerRows = ({
    signRequest,
    status,
    hardwareUnsignedSet,
    inFlightCosignAddresses,
}: BuildSignerRowsParams): SignerRow[] => {
    const isFinalized =
        status !== null && FINALIZED_SIGN_REQUEST_STATUSES.has(status)
    const responses = signRequest.transactionLists[0]?.responses ?? []
    const responseByAddress = new Map(responses.map(r => [r.address, r]))

    return signRequest.multisigAccount.participantAddresses.map(address => {
        const response = responseByAddress.get(address)
        if (response?.response === 'signed') {
            return {
                address,
                status: 'signed' as const,
                canSignAsHardware: false,
                isSigning: false,
            }
        }
        if (response?.response === 'declined') {
            return {
                address,
                status: 'declined' as const,
                canSignAsHardware: false,
                isSigning: false,
            }
        }
        const unrespondedStatus: SignerStatus = isFinalized
            ? 'unsigned'
            : 'pending'
        return {
            address,
            status: unrespondedStatus,
            canSignAsHardware: !isFinalized && hardwareUnsignedSet.has(address),
            isSigning: inFlightCosignAddresses.has(address),
        }
    })
}
