// Entry point for the "Make the Judge Laugh in One Line" bounty.
//
// The whole job is deliberately small: take one hard-coded sentence,
// prove it satisfies the bounty's gate rules, and drop it as a single
// line of UTF-8 text at /output/entry.txt. Nothing is read from disk
// except for the final read-back check, and nothing else is produced.

import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

// The submission text. It must reach the output file byte-for-byte, so
// it lives here as a plain literal and is never transformed downstream.
const LINE: string =
  "I don't need a fitness tracker. My jeans already send a daily notification.";

// Gate limits taken from the bounty's BOUNTY.json ("gate": "1-200"):
// the entry has to be one line between one and two hundred characters.
const MIN_CHARS: number = 1;
const MAX_CHARS: number = 200;

// Where the judge expects to find the finished entry.
const OUTPUT_PATH: string = "/output/entry.txt";

// Stop loudly rather than writing anything questionable: a failed run
// is easy to retry, a silently malformed entry is not.
function fail(reason: string): never {
  console.error(`entry rejected: ${reason}`);
  process.exit(1);
}

// Check the sentence against every rule the gate enforces. The order
// goes from structural problems (line breaks, padding) to size limits
// so the error message points at the most specific defect first.
function validateGate(text: string): void {
  if (text.includes("\n") || text.includes("\r")) {
    fail("entry must be a single line, line breaks are not allowed");
  }
  if (text !== text.trim()) {
    fail("entry must not start or end with whitespace");
  }
  if (text.trim().length === 0) {
    fail("entry must not be blank");
  }
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
    fail(
      `entry length ${text.length} is outside the ${MIN_CHARS}-${MAX_CHARS} character gate`,
    );
  }
}

// Write via a temporary sibling file and rename into place, so a reader
// can never observe a half-written entry. Permissions are pinned to
// 0644 explicitly because the default mode depends on the umask.
function writeAtomically(target: string, contents: string): void {
  mkdirSync(dirname(target), { recursive: true });
  const staging: string = `${target}.tmp-${process.pid}`;
  writeFileSync(staging, contents, { encoding: "utf8" });
  chmodSync(staging, 0o644);
  renameSync(staging, target);
}

// After writing, read the file back and demand an exact match: same
// bytes, no trailing newline sneaking in, no encoding surprises. The
// raw byte length and the on-disk permission bits get checked too, so
// a multi-byte character or a loose umask cannot slip through.
function verifyReadBack(target: string, expected: string): void {
  const actual: string = readFileSync(target, "utf8");
  if (actual !== expected) {
    fail("read-back mismatch: file contents differ from the entry line");
  }
  const expectedBytes: number = Buffer.byteLength(expected, "utf8");
  const stats = statSync(target);
  if (stats.size !== expectedBytes) {
    fail(`read-back size ${stats.size} != expected ${expectedBytes} bytes`);
  }
  if ((stats.mode & 0o777) !== 0o644) {
    fail(
      `output mode ${(stats.mode & 0o777).toString(8)} is not the required 644`,
    );
  }
}

function main(): void {
  validateGate(LINE);
  writeAtomically(OUTPUT_PATH, LINE);
  verifyReadBack(OUTPUT_PATH, LINE);
  console.log(`wrote ${LINE.length} characters to ${OUTPUT_PATH}`);
}

main();
