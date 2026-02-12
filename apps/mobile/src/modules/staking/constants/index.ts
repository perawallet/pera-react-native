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

import type { StakingProjectInfo, StakingType } from '../models'

export const STAKING_TYPE_LABELS: Record<StakingType, string> = {
    liquid: 'Liquid Staking',
    pools: 'Staking Pools',
    delegated: 'Delegated Staking',
}

export const STAKING_TYPE_COLORS: Record<StakingType, string> = {
    liquid: 'rgba(255,110,92,1)',
    pools: 'rgba(31,142,157,1)',
    delegated: 'rgba(255,174,227,1)',
}

export const STAKING_TYPE_DESCRIPTIONS: Record<StakingType, string> = {
    liquid: 'Liquid staking applications allow users to stake their Algo while maintaining liquidity. The typical process asks users to deposit Algo and mint new tokens that represent ownership and value of staked Algo, and can be used across the DeFi ecosystem.',
    pools: 'Staking pools enable groups of individuals to participate in consensus together. Users can stake Algo to a validator and get rewarded based on validator rewards. Options like DEX liquidity pool staking are also available.',
    delegated:
        'Delegated staking involves using a third-party to run a node on your behalf while your Algo remains in your wallet. This is useful for users who want to secure the network and collect rewards without running their own node.',
}

export const STAKING_PROJECTS: StakingProjectInfo[] = [
    {
        id: 'folks',
        title: 'Folks Finance',
        description:
            'Stake your Algo on Folks to collect rewards and receive xALGO',
        logoUrl:
            'https://algorand.co/hs-fs/hubfs/xAlgo%20Liquid%20Staking.png?width=80&height=80&name=xAlgo%20Liquid%20Staking.png',
        link: 'https://app.folks.finance/liquid-staking?ref=pera',
        type: 'liquid',
    },
    {
        id: 'tinyman',
        title: 'Tinyman',
        description:
            'Stake your Algo on Tinyman to collect rewards and receive tALGO',
        logoUrl:
            'https://algorand.co/hs-fs/hubfs/tALGO@2x.png?width=80&height=80&name=tALGO@2x.png',
        link: 'https://app.tinyman.org/liquid-stake/stake',
        type: 'liquid',
    },
    {
        id: 'compx',
        title: 'CompX',
        description:
            'Stake your Algo on CompX to collect rewards and receive cALGO',
        logoUrl:
            'https://algorand.co/hs-fs/hubfs/cAlgo.png?width=80&height=80&name=cAlgo.png',
        link: 'https://app.compx.io/staking-pools-pera',
        type: 'liquid',
    },
    {
        id: 'pact',
        title: 'Pact',
        description:
            'On Pact, eligible Algo-paired liquidity pools (LPs) will automatically participate in consensus',
        logoUrl:
            'https://algorand.co/hs-fs/hubfs/Pact_BrandKit_Logomark_Blue-1.png?width=80&height=80&name=Pact_BrandKit_Logomark_Blue-1.png',
        link: 'https://app.pact.fi/stake',
        type: 'pools',
    },
    {
        id: 'reti',
        title: 'Réti',
        description: 'Pool your Algo with others to participate in consensus',
        logoUrl:
            'https://algorand.co/hs-fs/hubfs/R%C3%A9ti-Pooling_og-image@2x_icon.png?width=80&height=80&name=R%C3%A9ti-Pooling_og-image@2x_icon.png',
        link: 'https://reti.nodely.io/',
        type: 'pools',
    },
    {
        id: 'valar',
        title: 'Valar',
        description:
            'Stake your Algo to a network of node runners without it leaving your wallet',
        logoUrl:
            'https://algorand.co/hs-fs/hubfs/Valar2.png?width=80&height=80&name=Valar2.png',
        link: 'https://stake.valar.solutions/',
        type: 'delegated',
    },
    {
        id: 'messina',
        title: 'Messina',
        description:
            'Stake your Algo on Messina to collect rewards and receive mALGO',
        logoUrl:
            'https://pbs.twimg.com/profile_images/1798989048436166656/-boBIisR_400x400.jpg',
        link: 'https://messina.one/liquid-staking',
        type: 'liquid',
    },
    {
        id: 'myth',
        title: 'Myth Finance',
        description:
            'Stake your Algo on Myth to collect rewards and receive dualSTAKE Tokens',
        logoUrl: 'https://myth.finance/favicon.ico',
        link: 'https://myth.finance/dualSTAKE',
        type: 'liquid',
    },
]

export const STAKING_DISCLAIMER_STORAGE_KEY = 'pera.staking.disclaimerAccepted'

export const STAKING_TERMS_URL = 'https://perawallet.app/terms-and-services/'
export const STAKING_DEFI_URL = 'https://algorand.co/ecosystem/defi'
