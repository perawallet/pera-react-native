export type VerificationTier = 'verified' | 'unverified' | 'suspicious'

export type ProjectCategory = {
    id: string
    title?: string
    order?: number
}

export type PeraProject = {
    name?: string
    url?: string
    description?: string
    shortDescription?: string
    logoPng?: string
    verificationTier?: VerificationTier
    color?: string
    textColor?: string
    backgroundImage?: string
    categories?: ProjectCategory[]
    popularityScore?: number
}

export type PeraApplication = {
    applicationId?: number
    name?: string
    project: PeraProject
}
