

import type { ApplicationStateSchema } from "./ApplicationStateSchema";
import type { TealKeyValueStore } from "./TealKeyValueStore";

/**
 * @description Stores the global information associated with an application.
*/
export type ApplicationParams = {
    /**
     * @description \\[approv\\] approval program.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string, byte
    */
    "approval-program": string;
    /**
     * @description \\[clearp\\] approval program.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string, byte
    */
    "clear-state-program": string;
    /**
     * @description The address that created this application. This is the address where the parameters and global state for this application can be found.
     * @type string
    */
    creator: string;
    /**
     * @description \\[epp\\] the amount of extra program pages available to this app.
     * @type integer | undefined, uint64
    */
    "extra-program-pages"?: number;
    /**
     * @description Represents a key-value store for use in an application.
     * @type array | undefined
    */
    "global-state"?: TealKeyValueStore;
    /**
     * @description Specifies maximums on the number of each type that may be stored.
     * @type object | undefined
    */
    "global-state-schema"?: ApplicationStateSchema;
    /**
     * @description Specifies maximums on the number of each type that may be stored.
     * @type object | undefined
    */
    "local-state-schema"?: ApplicationStateSchema;
    /**
     * @description \\[v\\] the number of updates to the application programs
     * @type integer | undefined
    */
    version?: number;
};