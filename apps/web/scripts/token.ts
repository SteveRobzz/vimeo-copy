// Unit checks + CLI for the stream-token module.
//   npx tsx scripts/token.ts test
//   npx tsx scripts/token.ts sign <videoId> [ttlSeconds]
import { signStreamToken, verifyStreamToken } from "../lib/stream-token";

const [cmd, a, b] = process.argv.slice(2);

if (cmd === "sign") {
  process.stdout.write(signStreamToken(a, b ? Number(b) : undefined));
} else if (cmd === "verify") {
  process.stdout.write(JSON.stringify(verifyStreamToken(a)));
} else {
  let pass = 0;
  let fail = 0;
  const ok = (name: string, cond: boolean) => {
    (cond ? pass++ : fail++), console.log(`${cond ? "✓" : "✗"} ${name}`);
  };

  const t = signStreamToken("vid_abc", 60);
  ok("valid token verifies to its videoId", verifyStreamToken(t)?.videoId === "vid_abc");
  ok("tampered signature rejected", verifyStreamToken(t.slice(0, -2) + "xy") === null);
  ok("tampered payload rejected", verifyStreamToken("AAAA" + t.slice(4)) === null);
  ok("garbage rejected", verifyStreamToken("not-a-token") === null);
  ok("empty rejected", verifyStreamToken("") === null);
  ok("expired token rejected", verifyStreamToken(signStreamToken("vid_x", -1)) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
