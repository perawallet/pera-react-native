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
 * @description Represents a TEAL value.
*/
export type TealValue = {
    /**
     * @description bytes value.
     * @type string
    */
    bytes: string;
    /**
     * @description type of the value. Value `1` refers to **bytes**, value `2` refers to **uint**
     * @type integer
    */
    type: number;
    /**
     * @description uint value.
     * @type integer
    */
    uint: number;
};