# Week 4: Conversational Property Search Agent

## Goal

Week 4 converts the Week 3 single-turn MLS search into a multi-turn experience.
The agent remembers one user's filters, asks for missing essentials, queries the
real `rets_property` table when the request is specific enough, and lets the
user refine the same search in later messages.

## Conversation flow

```text
User: Find homes in Irvine
Agent: What is your maximum budget for a home in Irvine?

User: Under $1.2M
Agent: What property type and minimum number of bedrooms do you prefer?

User: Single family with at least 3 beds
Agent: [live rets_property cards with address, price, beds/baths and photo count]

User: Only ones with a pool
Agent: [reruns the search with the saved filters plus pool=True]
```

## Design

- `conversation-agent.mjs` coordinates parsing, follow-up questions, state
  merging, database retrieval, and response formatting.
- `session-store.mjs` persists a separate session per stable sender/session ID.
  IDs are SHA-256 hashed in filenames and never stored in file contents.
- Sessions expire after 24 hours and can be deleted immediately with `reset`.
- Only filters and recent listing IDs are persisted. Full MLS rows, passwords,
  and database connection details are not session data.
- Week 2 remains the only natural-language parser. Week 3 remains the only SQL
  layer, so parameter binding and the 50-row limit apply to conversational use.

The agent waits for a city, maximum price, and either a property type or bedroom
minimum before querying. This produces useful results without issuing an
unnecessarily broad MLS query.

## Run and test

```bash
npm test
npm run test:conversation-db
```

The standard suite uses a fake database dependency to cover multi-turn merging,
follow-ups, user isolation, reset, expiry, refinement, empty results, and ID
privacy. The second command performs a real three-turn query against local
MySQL and is intentionally separate.

## Register with OpenClaw

```bash
openclaw skills install ./skills/conversational-property-search --force
openclaw skills info conversational-property-search
```

The skill imports the already-installed Week 2 and Week 3 sibling skills. The
Week 3 skill therefore needs its `mysql2` dependency installed, as described in
the Week 3 documentation.

## Demo without an LLM

Use the same `--user-id` for all turns:

```bash
node skills/conversational-property-search/scripts/conversation.mjs --user-id demo --message 'Find homes in Irvine'
node skills/conversational-property-search/scripts/conversation.mjs --user-id demo --message 'Under $1.2M'
node skills/conversational-property-search/scripts/conversation.mjs --user-id demo --message 'Single family with at least 3 beds'
node skills/conversational-property-search/scripts/conversation.mjs --user-id demo --message 'Only ones with a pool'
```

In OpenClaw TUI, use:

```text
/conversational-property-search Find homes in Irvine
```

Then send the follow-up answers as normal messages. OpenClaw should invoke the
same skill again with the same session identity.
