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

import { vi } from 'vitest'

const getRemoteConfig = () => ({
  setDefaults: vi.fn(async () => { }),
  fetchAndActivate: vi.fn(async () => true),
  setConfigSettings: vi.fn(),
  getValue: vi.fn(() => ({
    asString: () => '',
    asBoolean: () => false,
    asNumber: () => 0,
  })),
})

export default { getRemoteConfig }
export { getRemoteConfig }
