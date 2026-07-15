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

import { config } from './main'

/**
 * Builds vary on two independent axes — don't mix them up:
 *
 *   variant (isProd / isStaging): which backend and release channel the
 *     build is configured for.
 *   debug (isDebug): a locally built bundle (Metro/Expo) vs a signed release
 *     (Firebase App Distribution for staging, the stores for prod).
 *
 * That yields the four build types: prod, prod debug, staging, staging
 * debug. Compose for anything narrower — e.g. the signed store build is
 * `isProd && !isDebug`.
 */

/**
 * True for locally built debug bundles (Metro/Expo), on either variant.
 * `__DEV__` only exists in React Native runtimes and test setups that define
 * it, so it is read defensively off globalThis — keep that cast here and
 * nowhere else.
 *
 * For dev-only code that must be STRIPPED from release bundles (dev screens,
 * dev-only requires), keep using bare `__DEV__` instead: Metro can only
 * dead-code-eliminate the inlined identifier, not this runtime read.
 */
export const isDebug = (globalThis as { __DEV__?: boolean }).__DEV__ === true

/** True for the production variant, signed store release or local debug. */
export const isProd = config.appEnvironment === 'production'

/**
 * True for the staging variant, signed QA release or local debug. Note a
 * local run without APP_ENV set resolves appEnvironment to 'development':
 * such builds are `isDebug` with both variant flags false.
 */
export const isStaging = config.appEnvironment === 'staging'

/**
 * True for the development variant — `config.appEnvironment === 'development'`,
 * which is what an unset `APP_ENV` resolves to (the local backend channel).
 * Note the build-time app config (`apps/mobile/app.config.builder.js`) labels
 * this same variant `dev`; the runtime enum value is `development`.
 *
 * This is a VARIANT flag (which backend/identity the build targets) and is
 * orthogonal to `isDebug` (debug bundle vs signed release). Do not conflate
 * them: a local debug build can run against any variant.
 */
export const isDev = config.appEnvironment === 'development'
