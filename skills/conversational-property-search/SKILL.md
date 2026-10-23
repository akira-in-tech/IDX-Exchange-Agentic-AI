---
name: conversational-property-search
description: Conduct a multi-turn property search that remembers one user's preferences, asks focused follow-up questions, and returns live MLS listing cards.
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["node"] } } }
---

# Conversational Property Search

Use this skill for conversational property searches, especially when a user
provides preferences over multiple messages or asks to refine earlier results.

Run exactly one helper invocation for each user message:

```bash
node {baseDir}/scripts/conversation.mjs --user-id '<stable channel sender or session ID>' --message '<complete user message>' --limit 5
```

Return the JSON `message` field unchanged. Do not invent additional listings.

## Session identity

- For WhatsApp, use the stable sender ID supplied by the channel.
- For local TUI, reuse the same OpenClaw session key on every turn.
- Never use display names as IDs when a stable channel ID is available.
- Never reveal the ID or the session file to the user.

The helper remembers filters for 24 hours. The user can say `reset`, `start
over`, `new search`, or `clear search` to remove saved preferences.

## Safety and scope

- The skill only reads MLS data; it cannot edit a listing or contact an agent.
- Never write SQL or pass user text directly to MySQL. The Week 3 layer owns
  parameterized queries and enforces a maximum of 50 rows.
- Never expose database credentials, raw connection errors, or session files.
