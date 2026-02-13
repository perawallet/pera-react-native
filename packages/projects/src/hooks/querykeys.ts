const MODULE_PREFIX = 'projects'

export const projectQueryKeys = {
    all: [MODULE_PREFIX] as const,

    byUrl: (url: string) => [MODULE_PREFIX, 'by-url', { url }] as const,

    application: (applicationId: string) =>
        [MODULE_PREFIX, 'application', { applicationId }] as const,
}
