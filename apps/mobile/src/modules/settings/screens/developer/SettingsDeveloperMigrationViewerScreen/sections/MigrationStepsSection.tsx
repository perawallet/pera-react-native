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

import { MigrationDataSection } from '../components/MigrationDataSection'
import { MigrationDataRow } from '../components/MigrationDataRow'
import type { MigrationStepRow } from '../useMigrationStepVersions'

export const MigrationStepsSection = ({
    steps,
}: {
    steps: MigrationStepRow[]
}) => {
    return (
        <MigrationDataSection
            title='Migration Steps'
            count={steps.length}
        >
            {steps.map(step => (
                <MigrationDataRow
                    key={step.name}
                    label={step.name}
                    value={`${step.recorded}/${step.target}${step.isPending ? ' — pending' : ''}`}
                />
            ))}
        </MigrationDataSection>
    )
}
