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

// The suites chain packages run against their own implementations; aliased
// as `@perawallet/wallet-core-chain-contract/testing` by consumers, never built.
export { descriptorContractTests } from './descriptor-contract'
export {
    capabilityAdapterContractTests,
    type CapabilityAdapterRegistries,
} from './capability-adapter-contract'
export { addressCodecContractTests } from './address-codec-contract'
export { FIXTURE_CHAIN_ID, fixtureCodec } from './fixture-chain'
export {
    createFakeChainKeyStore,
    keyDerivationContractTests,
} from './key-derivation-contract'
