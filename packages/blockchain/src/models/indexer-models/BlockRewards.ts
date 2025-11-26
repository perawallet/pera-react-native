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


/**
 * @description Fields relating to rewards,
*/
export type BlockRewards = {
    /**
     * @description \\[fees\\] accepts transaction fees, it can only spend to the incentive pool.
     * @type string
    */
    "fee-sink": string;
    /**
     * @description \\[rwcalr\\] number of leftover MicroAlgos after the distribution of rewards-rate MicroAlgos for every reward unit in the next round.
     * @type integer
    */
    "rewards-calculation-round": number;
    /**
     * @description \\[earn\\] How many rewards, in MicroAlgos, have been distributed to each RewardUnit of MicroAlgos since genesis.
     * @type integer
    */
    "rewards-level": number;
    /**
     * @description \\[rwd\\] accepts periodic injections from the fee-sink and continually redistributes them as rewards.
     * @type string
    */
    "rewards-pool": string;
    /**
     * @description \\[rate\\] Number of new MicroAlgos added to the participation stake from rewards at the next round.
     * @type integer
    */
    "rewards-rate": number;
    /**
     * @description \\[frac\\] Number of leftover MicroAlgos after the distribution of RewardsRate/rewardUnits MicroAlgos for every reward unit in the next round.
     * @type integer
    */
    "rewards-residue": number;
};