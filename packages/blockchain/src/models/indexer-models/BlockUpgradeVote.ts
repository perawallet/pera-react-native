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
 * @description Fields relating to voting for a protocol upgrade.
*/
export type BlockUpgradeVote = {
    /**
     * @description \\[upgradeyes\\] Indicates a yes vote for the current proposal.
     * @type boolean | undefined
    */
    "upgrade-approve"?: boolean;
    /**
     * @description \\[upgradedelay\\] Indicates the time between acceptance and execution.
     * @type integer | undefined
    */
    "upgrade-delay"?: number;
    /**
     * @description \\[upgradeprop\\] Indicates a proposed upgrade.
     * @type string | undefined
    */
    "upgrade-propose"?: string;
};