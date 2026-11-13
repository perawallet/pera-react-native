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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getChainDescriptor } from "@perawallet/wallet-core-chain-shared";
import {
  registerEthereumChain,
  restoreAlgorandOnlyChains,
} from "@test-utils/chain-fixtures";
import { discoverCaip2Of } from "../discoverCaip2";

describe("discoverCaip2Of", () => {
  beforeEach(() => {
    registerEthereumChain();
  });
  afterEach(() => {
    restoreAlgorandOnlyChains();
  });

  it("uses the selected Algorand network", () => {
    const testnet = getChainDescriptor("algorand").networks.find(
      (n) => n.id === "testnet",
    );
    expect(testnet).toBeDefined();
    expect(discoverCaip2Of("algorand", "testnet")).toBe(testnet?.caip2);
  });

  it("always sends the mainnet CAIP-2 for EVM, whatever network is selected", () => {
    expect(discoverCaip2Of("ethereum", "sepolia")).toBe("eip155:1");
  });

  it("is null for an Algorand network the descriptor does not list", () => {
    expect(discoverCaip2Of("algorand", "nonsense")).toBeNull();
  });
});
