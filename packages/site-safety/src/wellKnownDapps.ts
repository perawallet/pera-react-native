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

import type { ImpersonationTarget } from './models'

/** Sites phishing domains imitate. A target's subdomains count as the site itself. */
export const WELL_KNOWN_DAPPS: readonly ImpersonationTarget[] = [
    { name: 'Pera Wallet', domain: 'perawallet.app' },
    { name: 'Tinyman', domain: 'tinyman.org' },
    { name: 'Folks Finance', domain: 'folks.finance' },
    { name: 'Pact', domain: 'pact.fi' },
    { name: 'Vestige', domain: 'vestige.fi' },
    { name: 'NFDomains', domain: 'nf.domains' },
    { name: 'Algorand Foundation', domain: 'algorand.foundation' },
    { name: 'Algorand', domain: 'algorand.co' },
    { name: 'Lofty', domain: 'lofty.ai' },
    { name: 'CompX', domain: 'compx.io' },
    { name: 'Uniswap', domain: 'uniswap.org' },
    { name: 'OpenSea', domain: 'opensea.io' },
    { name: 'Aave', domain: 'aave.com' },
    { name: 'Lido', domain: 'lido.fi' },
    { name: 'Curve', domain: 'curve.fi' },
    { name: 'PancakeSwap', domain: 'pancakeswap.finance' },
    { name: '1inch', domain: '1inch.io' },
    { name: 'MetaMask', domain: 'metamask.io' },
    { name: 'Etherscan', domain: 'etherscan.io' },
    { name: 'Blur', domain: 'blur.io' },
    { name: 'Compound', domain: 'compound.finance' },
    { name: 'Polymarket', domain: 'polymarket.com' },
    { name: 'Hyperliquid', domain: 'hyperliquid.xyz' },
    { name: 'Rabby', domain: 'rabby.io' },
]
