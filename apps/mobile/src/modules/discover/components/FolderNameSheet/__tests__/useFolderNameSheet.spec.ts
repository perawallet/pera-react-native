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

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBottomSheetResult } from "@modules/bottom-sheet";
import { useFolderNameSheet } from "../useFolderNameSheet";

vi.mock("@modules/bottom-sheet", () => ({ useBottomSheetResult: vi.fn() }));

const resolve = vi.fn();

describe("useFolderNameSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBottomSheetResult).mockReturnValue({
      resolve,
      dismiss: vi.fn(),
    } as never);
  });

  it("cannot submit a blank name", () => {
    // Arrange
    const { result } = renderHook(() => useFolderNameSheet({}));

    // Act
    act(() => result.current.setName("   "));

    // Assert
    expect(result.current.canSubmit).toBe(false);
  });

  it("submits the trimmed name", () => {
    // Arrange
    const { result } = renderHook(() => useFolderNameSheet({}));
    act(() => result.current.setName("  Swap "));

    // Act
    act(() => result.current.submit());

    // Assert
    expect(result.current.canSubmit).toBe(true);
    expect(resolve).toHaveBeenCalledWith("Swap");
  });

  it("does not resolve when the name is invalid", () => {
    // Arrange
    const { result } = renderHook(() => useFolderNameSheet({}));

    // Act
    act(() => result.current.submit());

    // Assert
    expect(resolve).not.toHaveBeenCalled();
  });

  it("starts from the initial name when renaming", () => {
    // Arrange / Act
    const { result } = renderHook(() =>
      useFolderNameSheet({ initialName: "Old" }),
    );

    // Assert
    expect(result.current.name).toBe("Old");
    expect(result.current.canSubmit).toBe(true);
  });
});
