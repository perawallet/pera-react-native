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

// Native Discover home with Ethereum registered beside Algorand: the chain
// chips drive the per-chain Top dApps request, a failing chain shows its own
// error while News keeps rendering, and the search pill, news cards and stars
// reach their targets.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import { getChainDescriptor } from "@perawallet/wallet-core-chain-shared";
import { useRemoteConfigStore } from "@perawallet/wallet-core-remote-config";
import { mockDiscoverNews } from "@perawallet/wallet-core-discover/test-handlers";
import {
  mockDiscoverProjects,
  type MockDiscoverProjectsParams,
} from "@perawallet/wallet-core-projects/test-handlers";
import { server } from "@test-utils/msw-server";
import { renderWithNavigation } from "@test-utils/renderWithNavigation";
import { setCapabilityOverrides } from "@test-utils/capability-overrides";
import { useWebViewStore } from "@modules/webview";
import { useDiscoverFavoritesStore } from "@modules/discover/store/useDiscoverFavoritesStore";

// The integration setup registers whichever chains config enables.
vi.mock("@perawallet/wallet-core-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@perawallet/wallet-core-config")>();
  return {
    ...actual,
    config: {
      ...actual.config,
      chains: { enabled: ["algorand", "ethereum"], capabilities: {} },
    },
  };
});

const { DiscoverHomeScreen } =
  await import("@modules/discover/screens/DiscoverHomeScreen/DiscoverHomeScreen");
const { DiscoverTabScreen } =
  await import("@modules/discover/screens/DiscoverTabScreen/DiscoverTabScreen");

// Read lazily: the chain registry is only populated once the setup has run.
const algorandCaip2 = (): string =>
  getChainDescriptor("algorand").networks.find((n) => n.id === "mainnet")
    ?.caip2 ?? "";
const ETHEREUM_CAIP2 = "eip155:1";

type ProjectApiResponse = MockDiscoverProjectsParams["response"][number];

const project = (
  name: string,
  over: Partial<ProjectApiResponse> = {},
): ProjectApiResponse => ({
  id: `p-${name}`,
  name,
  url: `https://${name.toLowerCase()}.example`,
  description: `${name} description`,
  short_description: `${name} description`,
  logo_png: `https://pera.test/${name}.png`,
  verification_tier: "unverified",
  categories: [{ id: "c-dex", title: "DEX" }],
  popularity_score: 1,
  chains: [],
  ...over,
});

const rowOf = (name: string) =>
  `discover_home_dapp_https://${name.toLowerCase()}.example`;

const newsResponse = (titles: string[]) => ({
  next: null,
  previous: null,
  results: titles.map((title, i) => ({
    id: `news-${i + 1}`,
    title,
    banner: null,
    publishing_datetime: "2026-11-09T10:00:00Z",
  })),
});

const ALGORAND_PROJECTS = [
  project("Tinyman", { verification_tier: "verified" }),
  project("Folks"),
  project("Pact"),
  project("Vestige"),
  project("Algofi"),
  project("Cometa"),
];
const ETHEREUM_PROJECTS = [project("Uniswap"), project("Aave")];

const requestedChains: string[] = [];
const onRequest = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/v1/discover/projects/")) {
    requestedChains.push(url.searchParams.get("chains") ?? "");
  }
};

const renderHome = () =>
  renderWithNavigation(DiscoverHomeScreen, "Discover", {
    additionalScreens: [
      {
        name: "DiscoverSearch",
        component: () => <div data-testid="search_screen" />,
      },
      {
        name: "DiscoverDetail",
        component: () => <div data-testid="detail_screen" />,
      },
      {
        name: "DiscoverNews",
        component: () => <div data-testid="news_screen" />,
      },
      {
        name: "DiscoverNewsDetail",
        component: () => <div data-testid="news_detail_screen" />,
      },
      {
        name: "DiscoverDapps",
        component: () => <div data-testid="dapps_screen" />,
      },
      {
        name: "DiscoverFolder",
        component: () => <div data-testid="folder_screen" />,
      },
      {
        name: "DiscoverAllFavorites",
        component: () => <div data-testid="all_favorites_screen" />,
      },
      {
        name: "DiscoverAllFolders",
        component: () => <div data-testid="all_folders_screen" />,
      },
    ],
  });

const useHandlers = ({
  news = ["First story", "Second story"],
  algorand = { response: ALGORAND_PROJECTS, status: 200 },
  ethereum = { response: ETHEREUM_PROJECTS, status: 200 },
}: {
  news?: string[];
  algorand?: { response: ProjectApiResponse[]; status: number };
  ethereum?: { response: ProjectApiResponse[]; status: number };
} = {}) => {
  server.use(
    mockDiscoverProjects({ ...algorand, chains: algorandCaip2() }),
    mockDiscoverProjects({ ...ethereum, chains: ETHEREUM_CAIP2 }),
    mockDiscoverNews({ response: newsResponse(news) }),
  );
};

// Lets React Query's batched notifications land inside act.
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe("Flow: Discover home", () => {
  beforeEach(() => {
    requestedChains.length = 0;
    server.events.on("request:start", onRequest);
    // Reset before any render: a store reset under a mounted screen lands
    // outside act.
    useRemoteConfigStore.getState().resetState();
    useDiscoverFavoritesStore.getState().resetState();
    useWebViewStore.getState().clearWebViews();
    setCapabilityOverrides({ discover: true }, "ethereum");
  });

  afterEach(() => {
    server.events.removeListener("request:start", onRequest);
  });

  it("Given Algorand and Ethereum support Discover, then two chips render and Algorand leads", async () => {
    useHandlers();
    renderHome();

    expect(screen.getByTestId("discover_chain_filter_algorand")).toBeTruthy();
    expect(screen.getByTestId("discover_chain_filter_ethereum")).toBeTruthy();
    expect(screen.queryByTestId("discover_chain_filter_all")).toBeNull();
    await screen.findByTestId(rowOf("Tinyman"));
    expect(requestedChains).toContain(algorandCaip2());
    await flush();
  });

  it("Given a multichain build, when the Discover tab mounts, then it shows the native home", async () => {
    useHandlers();
    renderWithNavigation(DiscoverTabScreen, "Discover");

    await screen.findByTestId(rowOf("Tinyman"));
    expect(screen.getByTestId("discover_chain_filter_ethereum")).toBeTruthy();
    await flush();
  });

  it("Given the Ethereum chip is tapped, then Ethereum is requested with its CAIP-2 and its rows render", async () => {
    useHandlers();
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));

    fireEvent.click(screen.getByTestId("discover_chain_filter_ethereum"));

    await screen.findByTestId(rowOf("Uniswap"));
    expect(requestedChains).toContain(ETHEREUM_CAIP2);
    expect(screen.queryByTestId(rowOf("Tinyman"))).toBeNull();
    await flush();
  });

  it("Given six dApps on the chain, then only the top four render", async () => {
    useHandlers();
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));

    expect(screen.getByTestId(rowOf("Vestige"))).toBeTruthy();
    expect(screen.queryByTestId(rowOf("Algofi"))).toBeNull();
    expect(screen.queryByTestId(rowOf("Cometa"))).toBeNull();
    await flush();
  });

  it("Given a verified dApp, then its row shows the verified badge and a category subtitle", async () => {
    useHandlers();
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));

    expect(screen.getByTestId(`${rowOf("Tinyman")}_verified`)).toBeTruthy();
    expect(screen.queryByTestId(`${rowOf("Folks")}_verified`)).toBeNull();
    expect(screen.getAllByText("DEX").length).toBeGreaterThan(0);
    await flush();
  });

  it("Given Algorand's dApps fail with a 500, then its error shows while News renders, and Ethereum's chip still loads its rows", async () => {
    useHandlers({ algorand: { response: [], status: 500 } });
    renderHome();

    await screen.findByText("discover.home.dapps_error", undefined, {
      timeout: 4000,
    });
    expect(await screen.findByText("First story")).toBeTruthy();

    fireEvent.click(screen.getByTestId("discover_chain_filter_ethereum"));

    await screen.findByTestId(rowOf("Uniswap"));
    expect(screen.queryByText("discover.home.dapps_error")).toBeNull();
    await flush();
  });

  it("Given the error state, when Retry is tapped, then the chain is requested again", async () => {
    useHandlers({ algorand: { response: [], status: 500 } });
    renderHome();
    await screen.findByText("discover.home.dapps_error", undefined, {
      timeout: 4000,
    });
    const before = requestedChains.length;

    fireEvent.click(screen.getByTestId("discover_home_dapps_retry"));

    await waitFor(() => {
      expect(requestedChains.length).toBeGreaterThan(before);
    });
    await screen.findByText("discover.home.dapps_error");
    await flush();
  });

  it("Given Ethereum no longer supports Discover, then no chips render", async () => {
    setCapabilityOverrides({ discover: false }, "ethereum");
    useHandlers();
    renderHome();

    await screen.findByTestId(rowOf("Tinyman"));
    expect(screen.queryByTestId("discover_chain_filter_algorand")).toBeNull();
    expect(screen.queryByTestId("discover_chain_filter_ethereum")).toBeNull();
    await flush();
  });

  it("Given an empty news page, then the News header is hidden", async () => {
    useHandlers({ news: [] });
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));
    await flush();

    expect(screen.queryByText("discover.home.news")).toBeNull();
  });

  it("Given news, then the News header opens the native news list", async () => {
    useHandlers();
    renderHome();

    await screen.findByText("First story");
    expect(screen.getByText("Second story")).toBeTruthy();

    fireEvent.click(screen.getByText("discover.home.news"));

    expect(await screen.findByTestId("news_screen")).toBeTruthy();
    expect(screen.queryByTestId("detail_screen")).toBeNull();
    await flush();
  });

  it("Given news, then a card opens the native news detail", async () => {
    useHandlers();
    renderHome();

    fireEvent.click(await screen.findByText("First story"));

    expect(await screen.findByTestId("news_detail_screen")).toBeTruthy();
    expect(screen.queryByTestId("detail_screen")).toBeNull();
    await flush();
  });

  it("Given the Top dApps header is tapped, then the native directory opens", async () => {
    useHandlers();
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));

    fireEvent.click(screen.getByText("discover.home.top_dapps"));

    expect(await screen.findByTestId("dapps_screen")).toBeTruthy();
    expect(screen.queryByTestId("detail_screen")).toBeNull();
    await flush();
  });

  it("Given an empty Ethereum list, when its chip is tapped, then the empty copy shows", async () => {
    useHandlers({ ethereum: { response: [], status: 200 } });
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));

    fireEvent.click(screen.getByTestId("discover_chain_filter_ethereum"));

    expect(await screen.findByText("discover.home.dapps_empty")).toBeTruthy();
    await flush();
  });

  it("Given a top dApp, when its star is tapped, then it is a favorite and the star offers to remove it", async () => {
    useHandlers();
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));

    fireEvent.click(screen.getByTestId(`${rowOf("Tinyman")}_star`));

    expect(
      useDiscoverFavoritesStore
        .getState()
        .isFavorite("https://tinyman.example"),
    ).toBe(true);
    await waitFor(() => {
      expect(
        screen.getAllByLabelText("discover.dapp_row.unfavorite"),
      ).toHaveLength(1);
    });
    await flush();
  });

  it("Given nothing favorited, then Favorites shows its empty state and New Folder", async () => {
    useHandlers();
    renderHome();

    expect(
      await screen.findByTestId("discover_home_favorites_empty"),
    ).toBeTruthy();
    expect(screen.getByTestId("discover_home_new_folder")).toBeTruthy();
    expect(screen.queryByTestId("discover_home_all_favorites")).toBeNull();
    await flush();
  });

  it("Given a favorite and five folders, then All favorites, the newest four folders and See all show", async () => {
    const store = useDiscoverFavoritesStore.getState();
    store.addFavorite({
      url: "https://tinyman.example",
      name: "Tinyman",
      logo: null,
      categories: [],
      chains: [],
    });
    const ids = ["A", "B", "C", "D", "E"].map((name) =>
      store.createFolder(name),
    );
    useHandlers();
    renderHome();

    await screen.findByTestId("discover_home_all_favorites");
    expect(screen.queryByTestId("discover_home_favorites_empty")).toBeNull();
    ids
      .slice(1)
      .forEach((id) =>
        expect(screen.getByTestId(`discover_home_folder_${id}`)).toBeTruthy(),
      );
    expect(screen.queryByTestId(`discover_home_folder_${ids[0]}`)).toBeNull();

    fireEvent.click(screen.getByTestId("discover_home_folders_see_all"));
    expect(await screen.findByTestId("all_folders_screen")).toBeTruthy();
    await flush();
  });

  it("Given the New Folder action, when a name is entered and created, then the folder leads the list and opens", async () => {
    useHandlers();
    renderHome();
    fireEvent.click(await screen.findByTestId("discover_home_new_folder"));

    const input = await screen.findByTestId("discover_folder_name_input");
    fireEvent.change(input, { target: { value: "  Swap " } });
    fireEvent.click(screen.getByTestId("discover_folder_name_submit"));

    await waitFor(() => {
      expect(useDiscoverFavoritesStore.getState().folderOrder).toHaveLength(1);
    });
    const [id] = useDiscoverFavoritesStore.getState().folderOrder;
    expect(useDiscoverFavoritesStore.getState().folders[id!]?.name).toBe(
      "Swap",
    );
    fireEvent.click(await screen.findByTestId(`discover_home_folder_${id}`));
    expect(await screen.findByTestId("folder_screen")).toBeTruthy();
    await flush();
  });

  it("Given a top dApp, when its row is pressed, then it opens in the in-app browser", async () => {
    useHandlers();
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));

    fireEvent.click(screen.getByTestId(`${rowOf("Tinyman")}_open`));

    expect(useWebViewStore.getState().openWebViews.at(-1)?.url).toBe(
      "https://tinyman.example",
    );
    await flush();
  });

  it("Given the search pill, when it is pressed, then the search screen opens", async () => {
    useHandlers();
    renderHome();
    await screen.findByTestId(rowOf("Tinyman"));

    fireEvent.click(screen.getByTestId("discover_home_search"));

    expect(await screen.findByTestId("search_screen")).toBeTruthy();
    await flush();
  });
});
