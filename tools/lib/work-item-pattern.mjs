// Work items that mean nothing to a reader in six months. One pattern, shared
// by the doc-hygiene script (Markdown, shell, YAML) and the lanekeep rule
// pera/no-work-item-refs (code comments).
export const WORK_ITEM =
    /\b(?:PERA-\d+|PQ-0\d\d|IAB-\d+|WB-\d+|F-\d{4}-\d+|Task \d+|M\d+ [Tt]ask)\b/
