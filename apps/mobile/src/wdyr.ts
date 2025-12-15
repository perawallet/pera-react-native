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

/// <reference types="@welldone-software/why-did-you-render" />
import { config } from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'
import React from 'react'

if (config.profilingEnabled) {
    logger.debug('Enabling Why Did You Render')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const whyDidYouRender = require('@welldone-software/why-did-you-render')
    whyDidYouRender(React, {
        trackAllPureComponents: false,
        trackHooks: true,
        logOnDifferentValues: true,
    })
}
