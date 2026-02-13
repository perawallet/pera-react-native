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

import { IconName, PWIcon, PWIconProps } from '@components/core'
import { VerificationTier } from '@perawallet/wallet-core-projects'

const verificationMap: Record<VerificationTier, IconName | undefined> = {
    verified: 'assets/verified',
    suspicious: 'assets/suspicious',
    unverified: undefined,
}

type ProjectVerificationIconProps = {
    tier: VerificationTier
} & Omit<PWIconProps, 'name'>

export const ProjectVerificationIcon = ({
    tier,
    ...rest
}: ProjectVerificationIconProps) => {
    const icon = verificationMap[tier]

    if (!icon) return null
    return (
        <PWIcon
            name={icon}
            {...rest}
        />
    )
}
