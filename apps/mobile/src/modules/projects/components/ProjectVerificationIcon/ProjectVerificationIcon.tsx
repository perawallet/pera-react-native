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
