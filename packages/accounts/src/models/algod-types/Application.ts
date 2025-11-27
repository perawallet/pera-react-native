

import type { ApplicationParams } from "./ApplicationParams";

/**
 * @description Application index and its parameters
*/
export type Application = {
    /**
     * @description \\[appidx\\] application index.
     * @type integer
    */
    id: number;
    /**
     * @description Stores the global information associated with an application.
     * @type object
    */
    params: ApplicationParams;
};