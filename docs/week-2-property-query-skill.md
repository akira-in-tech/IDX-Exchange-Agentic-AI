# Week 2: Natural-Language Property Search

## Deliverable

The `parse_property_query` skill converts a free-text real estate request into deterministic filters for the Week 3 MLS query layer. It does not call an LLM or database, so the same message always produces the same result and can be tested locally.

Implementation: [`src/skills/property-query.ts`](../src/skills/property-query.ts)

Tests: [`tests/property-query.test.ts`](../tests/property-query.test.ts)

## Filter mapping

| Parsed field | Future `rets_property` column | Example |
|---|---|---|
| `city` | `L_City` | `"Irvine"` |
| `maxPrice` | `L_SystemPrice` | `1500000` |
| `beds` | `L_Keyword2` | `3` |
| `baths` | `LM_Dec_3` | `2.5` |
| `sqft` | `LM_Int2_3` | `1800` |
| `type` | `L_Type_` | `"Condominium"` |
| `pool` | `PoolPrivateYN` | `"True"` |
| `hasView` | `ViewYN` | `"True"` |
| `maxHoa` | `AssociationFee` | `500` |

Unknown or omitted filters are returned as `null`. Explicit phrases such as `without a pool` and `no view` return `"False"` rather than being mistaken for positive requirements.

## Example

Input:

```text
Show me 3-bedroom condos in Irvine under $1.5M with a pool.
```

Output:

```json
{
  "city": "Irvine",
  "maxPrice": 1500000,
  "beds": 3,
  "baths": null,
  "sqft": null,
  "type": "Condominium",
  "pool": "True",
  "hasView": null,
  "maxHoa": null
}
```

## Run the validation suite

Node.js 22.18 or newer is required because the tests use Node's built-in TypeScript type stripping.

```bash
npm test
```

The suite contains 17 tests and covers the handbook example, multi-word cities, abbreviated and comma-formatted prices, decimal bathrooms, square footage, property types, positive and negative amenities, HOA limits, missing filters, Unicode hyphens, invalid input, the typed adapter, the OpenClaw entry, and the installed skill helper.

## OpenClaw registration

The repository includes a native workspace skill entry at [`skills/property-search-parser/SKILL.md`](../skills/property-search-parser/SKILL.md). OpenClaw discovers `SKILL.md` files below the active workspace's `skills/` directory and exposes this skill as `/property-search-parser`.

Verify registration from an OpenClaw workspace rooted at this repository:

```bash
openclaw skills info property-search-parser
openclaw skills check
```

Invoke it from an OpenClaw chat with:

```text
/property-search-parser Show me 3-bedroom condos in Irvine under $1.5M with a pool.
```

The skill calls its deterministic helper and returns only the structured JSON filter object.

## Scope boundary

This week produces structured filters only. It intentionally does not connect to MySQL or return listings; parameterized database queries and result formatting belong to Week 3.
