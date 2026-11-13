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
import { generateUniqueId } from "@perawallet/wallet-core-shared";
import { DiscoverEvent, trackEvent } from "@analytics";
import { useAppNavigation } from "@hooks/useAppNavigation";
import { useBottomSheet } from "@modules/bottom-sheet";
import { useDiscoverFavoritesStore } from "../../../store/useDiscoverFavoritesStore";
import type { DiscoverDapp } from "../../../types";
import { useFavoritesSection } from "../useFavoritesSection";

vi.mock("@analytics", async () => ({
  ...(await vi.importActual<object>("@analytics")),
  trackEvent: vi.fn(),
}));
vi.mock("@hooks/useAppNavigation", () => ({ useAppNavigation: vi.fn() }));
vi.mock("@modules/bottom-sheet", () => ({ useBottomSheet: vi.fn() }));

const navigate = vi.fn();
const request = vi.fn();

const dapp = (url: string): DiscoverDapp => ({
  url,
  name: url,
  logo: null,
  categories: [],
  chains: [],
});

const store = () => useDiscoverFavoritesStore.getState();

describe("useFavoritesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let next = 0;
    vi.mocked(generateUniqueId).mockImplementation(() => `folder-${++next}`);
    vi.mocked(useAppNavigation).mockReturnValue({ navigate } as never);
    vi.mocked(useBottomSheet).mockReturnValue({ request } as never);
    useDiscoverFavoritesStore.setState({
      favorites: {},
      favoriteOrder: [],
      folders: {},
      folderOrder: [],
    });
  });

  it("shows at most four folders, newest first, and flags more", () => {
    // Arrange
    ["A", "B", "C", "D", "E"].forEach((name) => store().createFolder(name));

    // Act
    const { result } = renderHook(() => useFavoritesSection());

    // Assert
    expect(result.current.folders.map((f) => f.name)).toEqual([
      "E",
      "D",
      "C",
      "B",
    ]);
    expect(result.current.hasMore).toBe(true);
  });

  it("counts every favorite and each folder's dApps", () => {
    // Arrange
    store().addFavorite(dapp("https://a.io"));
    store().addFavorite(dapp("https://b.io"));
    store().createFolder("One", "https://a.io");

    // Act
    const { result } = renderHook(() => useFavoritesSection());

    // Assert
    expect(result.current.favoriteCount).toBe(2);
    expect(result.current.folders).toEqual([
      { id: "folder-1", name: "One", count: 1 },
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it("is empty only with no favorites and no folders", () => {
    const { result, rerender } = renderHook(() => useFavoritesSection());
    expect(result.current.isEmpty).toBe(true);

    act(() => {
      store().createFolder("One");
    });
    rerender();

    expect(result.current.isEmpty).toBe(false);
  });

  it("creates the named folder and tracks it", async () => {
    // Arrange
    request.mockResolvedValue("Swap");
    const { result } = renderHook(() => useFavoritesSection());

    // Act
    await act(() => result.current.openNewFolder());

    // Assert
    expect(store().folders["folder-1"]?.name).toBe("Swap");
    expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderCreate);
  });

  it("creates nothing when the name sheet is dismissed", async () => {
    request.mockResolvedValue(undefined);
    const { result } = renderHook(() => useFavoritesSection());

    await act(() => result.current.openNewFolder());

    expect(store().folderOrder).toEqual([]);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("opens all favorites, a folder and all folders", () => {
    const { result } = renderHook(() => useFavoritesSection());

    result.current.openAllFavorites();
    result.current.openFolder("f1");
    result.current.openAllFolders();

    expect(navigate).toHaveBeenNthCalledWith(1, "DiscoverAllFavorites");
    expect(navigate).toHaveBeenNthCalledWith(2, "DiscoverFolder", {
      folderId: "f1",
    });
    expect(navigate).toHaveBeenNthCalledWith(3, "DiscoverAllFolders");
  });
});
