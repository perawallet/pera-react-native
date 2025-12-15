/// <reference types="@welldone-software/why-did-you-render" />
import { config } from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'
import React from 'react'

if (config.profilingEnabled) {
    logger.debug('Enabling Why Did You Render')
    const whyDidYouRender = require('@welldone-software/why-did-you-render')
    whyDidYouRender(React, {
        trackAllPureComponents: false,
        trackHooks: true,
        logOnDifferentValues: true,
    })
}
