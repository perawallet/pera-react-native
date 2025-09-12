import { createBlockchainSlice, type BlockchainSlice } from "../store";
import { Networks } from "../types";

describe("services/blockchain/store", () => {
  test("defaults to mainnet and setNetwork updates", () => {
    let state: BlockchainSlice;
    const set = (partial: Partial<BlockchainSlice>) => {
      state = { ...(state as BlockchainSlice), ...(partial as BlockchainSlice) };
    };
    const get = () => state;

    state = createBlockchainSlice(set as any, get as any, {} as any);

    expect(state.network).toBe(Networks.mainnet);
    state.setNetwork(Networks.testnet);
    expect(state.network).toBe(Networks.testnet);
  });
});