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

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ isNativeDiscover: false }));

vi.mock("@hooks/useIsNativeDiscover", () => ({
  useIsNativeDiscover: () => mocks.isNativeDiscover,
}));

import { useDiscoverTabScreen } from "../useDiscoverTabScreen";

describe("useDiscoverTabScreen", () => {
  it("keeps the Discover web app on an Algorand-only build", () => {
    mocks.isNativeDiscover = false;
    expect(renderHook(useDiscoverTabScreen).result.current.isNative).toBe(
      false,
    );
  });

  it("shows the native Discover on a multichain build", () => {
    mocks.isNativeDiscover = true;
    expect(renderHook(useDiscoverTabScreen).result.current.isNative).toBe(true);
  });
});
