

import type { AssetParams } from "./AssetParams";

/**
 * @description Specifies both the unique identifier and the parameters for an asset
*/
export type Asset = {
    /**
     * @description unique asset identifier
     * @type integer
    */
    index: number;
    /**
     * @description AssetParams specifies the parameters for an asset.\n\n\\[apar\\] when part of an AssetConfig transaction.\n\nDefinition:\ndata/transactions/asset.go : AssetParams
     * @type object
    */
    params: AssetParams;
};