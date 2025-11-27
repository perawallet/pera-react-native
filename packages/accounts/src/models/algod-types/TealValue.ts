


/**
 * @description Represents a TEAL value.
*/
export type TealValue = {
    /**
     * @description \\[tb\\] bytes value.
     * @type string
    */
    bytes: string;
    /**
     * @description \\[tt\\] value type. Value `1` refers to **bytes**, value `2` refers to **uint**
     * @type integer
    */
    type: number;
    /**
     * @description \\[ui\\] uint value.
     * @type integer, uint64
    */
    uint: number;
};