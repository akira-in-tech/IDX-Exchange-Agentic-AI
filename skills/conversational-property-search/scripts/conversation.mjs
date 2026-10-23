#!/usr/bin/env node
import { handleConversationMessage } from "./conversation-agent.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function usage() {
  return "Usage: node conversation.mjs --user-id <stable-id> --message <text> [--limit 5]";
}

async function main() {
  const args = process.argv.slice(2);
  const userId = option(args, "--user-id");
  const message = option(args, "--message");
  const limitText = option(args, "--limit") ?? "5";
  if (!userId || !message) throw new Error(usage());
  const result = await handleConversationMessage({ userId, message, limit: Number(limitText) });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  // Keep infrastructure details and database credentials out of chat output.
  const safeMessage = error instanceof RangeError || error instanceof TypeError || error.message === usage()
    ? error.message
    : "Property search is temporarily unavailable. Please try again shortly.";
  process.stderr.write(`${safeMessage}\n`);
  process.exitCode = 1;
});
