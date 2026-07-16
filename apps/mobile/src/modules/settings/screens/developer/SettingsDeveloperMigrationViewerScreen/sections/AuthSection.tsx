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

import type { LegacyMigrationData } from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { LegacyVsRnRow } from '../components/LegacyVsRnRow'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

export const AuthSection = ({
    auth,
    biometricEnabled,
    rn,
}: {
    auth: LegacyMigrationData['auth']
    biometricEnabled: boolean | null
    rn: RNMigrationSnapshot
}) => {
    const legacyPinBytes = auth.pin?.length ?? null
    const rnPinDesc = rn.auth.hasPin
        ? `PinRecord v${rn.auth.pinRecordVersion ?? '?'} (${rn.auth.pinRecordBytes ?? '?'} B)`
        : '(absent)'
    const legacyPinDesc =
        legacyPinBytes !== null ? `plaintext (${legacyPinBytes} B)` : '(absent)'
    const legacyBio = biometricEnabled === true
    const rnBio = rn.auth.hasBiometric
    return (
        <MigrationDataSection title='Auth'>
            <LegacyVsRnRow
                label='pin'
                legacyValue={legacyPinDesc}
                rnValue={rnPinDesc}
                matches={(legacyPinBytes !== null) === rn.auth.hasPin}
            />
            <LegacyVsRnRow
                label='biometric enabled'
                legacyValue={legacyBio}
                rnValue={rnBio}
                matches={legacyBio === rnBio}
            />
        </MigrationDataSection>
    )
}
