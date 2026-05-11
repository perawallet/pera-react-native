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

import { setupServer } from 'msw/node'

// Shared MSW server for integration tests. Starts with no handlers registered
// — tests opt in per-scenario via `server.use(...)`, importing factories from
// each domain package's `*/test-handlers` barrel and fixtures from
// `__integration__/__fixtures__/`. This keeps the contract explicit:
// unhandled requests warn, surfacing missing mocks immediately.
export const server = setupServer()

export { http, HttpResponse } from 'msw'
