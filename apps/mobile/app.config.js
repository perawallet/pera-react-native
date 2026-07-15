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

// Dynamic Expo configuration.
// All native config lives in the pure builder so it can be unit-tested per
// variant; this entry just resolves it against the live process environment.

/* eslint-disable @typescript-eslint/no-require-imports */
const { buildAppConfig } = require('./app.config.builder');

module.exports = buildAppConfig(process.env);
