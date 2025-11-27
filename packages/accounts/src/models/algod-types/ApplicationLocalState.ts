

import type { ApplicationStateSchema } from "./ApplicationStateSchema";
import type { TealKeyValueStore } from "./TealKeyValueStore";

/**
 * @description Stores local state associated with an application.
*/
export type ApplicationLocalState = {
    /**
     * @description The application which this local state is for.
     * @type integer
    */
    id: number;
    /**
     * @description Represents a key-value store for use in an application.
     * @type array | undefined
    */
    "key-value"?: TealKeyValueStore;
    /**
     * @description Specifies maximums on the number of each type that may be stored.
     * @type object
    */
    schema: ApplicationStateSchema;
};