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

// Swapped in for the barrel by metro.config.js (migrationDevToolsStubs) in
// non-dev, non-staging bundles: the simulator is destructive and its fixture
// keys derive from a public constant, so store builds must not carry it.
export const SettingsDeveloperMigrationSimulatorScreen = (): null => null
