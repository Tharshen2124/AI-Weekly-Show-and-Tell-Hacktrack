/**
 * Credit to the community this app descends from. Sets no colour of its own —
 * the landing page renders it on hardcoded dark hexes while the dashboard uses
 * the semantic theme tokens, so colour is inherited and the link is marked by
 * its underline instead.
 */
export function Attribution() {
  return (
    <span>
      This tracker is adapted with permission from the system in use at{" "}
      <a
        href="https://hackerspacemmu.rocks/"
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-2 transition-opacity hover:opacity-80"
      >
        Hackerspace MMU
      </a>
      .
    </span>
  );
}
