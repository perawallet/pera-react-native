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
 * Two independent axes — don't mix them up. *Variant* (`isProd`/`isStaging`/
 * `isDev`) is which backend the build targets; *debug* (`isDebug`) is a local
 * Metro bundle vs a signed release. Compose for anything narrower: the signed
 * store build is `isProd && !isDebug`.
 */

/**
 * `__DEV__` exists only in RN runtimes and test setups that define it, so it's
 * read defensively off globalThis — keep that cast here and nowhere else.
 *
 * Dev-only code that must be STRIPPED from release bundles still needs bare
 * `__DEV__`: Metro can dead-code-eliminate the inlined identifier, not this
 * runtime read. For a whole module rather than a branch, prefer the resolver
 * swap in apps/mobile/metro.config.js — it excludes the file from the graph
 * outright instead of shipping it with no reachable caller.
 */
export const isDebug = (globalThis as { __DEV__?: boolean }).__DEV__ === true

/** True for the production variant, signed store release or local debug. */
export const isProd = config.appEnvironment === 'production'

/** A local run without APP_ENV set is `isDebug` with all variant flags false. */
export const isStaging = config.appEnvironment === 'staging'

/**
 * What an unset `APP_ENV` resolves to. `app.config.builder.js` labels this same
 * variant `dev`; the runtime enum value is `development`.
 */
export const isDev = config.appEnvironment === 'development'
