

import type { TealValue } from "./TealValue";

/**
 * @description Represents a key-value pair in an application store.
*/
export type TealKeyValue = {
    /**
     * @type string
    */
    key: string;
    /**
     * @description Represents a TEAL value.
     * @type object
    */
    value: TealValue;
};