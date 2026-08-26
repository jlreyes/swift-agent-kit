import { describe, expect, it } from "vitest";

import { macWindowViewTransitionName } from "../window-transition.ts";

describe("macWindowViewTransitionName", () => {
  it("injectively encodes ids that collided under delimiter escaping", () => {
    const ids = [":", "-3a-", "notes:main", "notes-3a-main", "", "é", "😀", "\ud83d", "\ude00"];
    const names = ids.map(macWindowViewTransitionName);

    expect(new Set(names).size).toBe(ids.length);
    expect(names).toEqual([
      "mc-window-1-003a",
      "mc-window-4-002d00330061002d",
      "mc-window-a-006e006f007400650073003a006d00610069006e",
      "mc-window-d-006e006f007400650073002d00330061002d006d00610069006e",
      "mc-window-0-",
      "mc-window-1-00e9",
      "mc-window-2-d83dde00",
      "mc-window-1-d83d",
      "mc-window-1-de00",
    ]);
  });
});
