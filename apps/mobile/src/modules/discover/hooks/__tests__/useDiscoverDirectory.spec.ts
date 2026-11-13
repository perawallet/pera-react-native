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

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDiscoverProjectsQuery,
  type PeraProject,
} from "@perawallet/wallet-core-projects";
import { useCapableChainIds } from "@hooks/useCapableChainIds";
import {
  registerEthereumChain,
  restoreAlgorandOnlyChains,
} from "@test-utils/chain-fixtures";
import { useDiscoverDirectory } from "../useDiscoverDirectory";

vi.mock("@hooks/useCapableChainIds", () => ({ useCapableChainIds: vi.fn() }));

const projects: PeraProject[] = [
  { chains: [], url: "https://A.io/", verificationTier: "verified" },
  { chains: [], url: "https://b.io", verificationTier: "unverified" },
];

describe("useDiscoverDirectory", () => {
  beforeEach(() => {
    registerEthereumChain();
    vi.mocked(useCapableChainIds).mockReturnValue(["algorand", "ethereum"]);
    vi.mocked(useDiscoverProjectsQuery).mockReset();
    vi.mocked(useDiscoverProjectsQuery).mockReturnValue({
      data: projects,
      isLoading: false,
      isError: false,
    } as never);
  });
  afterEach(() => {
    restoreAlgorandOnlyChains();
  });

  const lastCall = () =>
    vi.mocked(useDiscoverProjectsQuery).mock.calls.at(-1)?.[0];

  it("queries every discover chain and returns the list and verified set", () => {
    const { result } = renderHook(() => useDiscoverDirectory());
    expect(lastCall()?.chains).toHaveLength(2);
    expect(lastCall()?.chains).toContain("eip155:1");
    expect(lastCall()?.isEnabled).toBe(true);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.verifiedUrls).toEqual(new Set(["https://a.io"]));
  });

  it("passes isEnabled false through while both chains are present", () => {
    renderHook(() => useDiscoverDirectory({ isEnabled: false }));
    expect(lastCall()?.chains).toHaveLength(2);
    expect(lastCall()?.isEnabled).toBe(false);
  });

  it("is disabled with no discover chain and defaults data to []", () => {
    vi.mocked(useCapableChainIds).mockReturnValue([]);
    vi.mocked(useDiscoverProjectsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    const { result } = renderHook(() => useDiscoverDirectory());
    expect(lastCall()?.isEnabled).toBe(false);
    expect(result.current.projects).toEqual([]);
  });
});
