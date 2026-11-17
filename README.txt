CARCA CLONE CPU tactical defense patch v2.0.3 (for GitHub v2.0.2)

HOW TO INSTALL
1. Open https://github.com/0123porupoponnu/carca-clone
2. Open strong.js (root of repository) -> Edit (pencil)
3. Replace all contents with the strong.js file in this ZIP, commit changes.
4. GitHub Pages will publish it. Reload the game; if cached, use private browser or clear website cache.
5. Under new game select the strong CPU or learned CPU modes.

IMPORTANT
- Replace only strong.js. Do NOT replace index.html, cpu.js, learning.js, rules.js, tile-master.json, images or training JSON.
- Existing stored game and trained model format are unchanged.
- The index.html still references strong.js?v=2.0.2; browsers may cache this URL. If it stubbornly stays old, edit index.html's string 'strong.js?v=2.0.2' to 'strong.js?v=2.0.3' and commit.
- Source was checked against publicly accessible GitHub strong.js, cpu.js and learning.js v2.0.2 on 2026-11-17.
- Automated tests cover tactical hole classification and owner advantage. Full real-browser gameplay tests are NOT claimed.

DESIGN
Defense: favor matching tiles that can complete our features and avoid holes impossible to fill.
Weak defense: discourage placements that allow a hostile branching tile to fit, even when direct closure isn't available; keep finishing tiles legal.
Attack: exploit opponent vulnerable city and road holes while considering own risk.
Accounts for rotated variants and quantities of remaining physical tiles; not draw pile order.
Because this is one-ply evaluation, it is NOT a complete multi-turn tactical search.

FILES
strong.js -- replacement strong-CPU implementation, also patches learned CPU on DOMContentLoaded.
test-defense.js -- small Node regression test (optional, do not upload).
