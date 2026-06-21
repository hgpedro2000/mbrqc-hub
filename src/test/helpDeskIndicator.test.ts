import { describe, it, expect } from "vitest";
import { getHelpDeskIndicator } from "@/lib/helpDeskIndicator";

describe("getHelpDeskIndicator", () => {
  it("returns red badge with count for admin with pending tickets", () => {
    expect(
      getHelpDeskIndicator({ isAdmin: true, pendingAdminCount: 3, newResolvedCount: 0 }),
    ).toEqual({ color: "red", count: 3 });
  });

  it("counts em_andamento + pendente together (caller pre-aggregates)", () => {
    // The query in ReportErrorButton uses .in('status', ['pendente','em_andamento'])
    // so pendingAdminCount already covers both — verify single-source-of-truth.
    expect(
      getHelpDeskIndicator({ isAdmin: true, pendingAdminCount: 5, newResolvedCount: 0 }).count,
    ).toBe(5);
  });

  it("clears the indicator for admin as soon as pending count drops to zero", () => {
    expect(
      getHelpDeskIndicator({ isAdmin: true, pendingAdminCount: 0, newResolvedCount: 0 }),
    ).toEqual({ color: null, count: 0 });
  });

  it("shows green dot for regular user with new resolved tickets", () => {
    expect(
      getHelpDeskIndicator({ isAdmin: false, pendingAdminCount: 0, newResolvedCount: 2 }),
    ).toEqual({ color: "green", count: 2 });
  });

  it("returns no indicator for regular user with nothing new", () => {
    expect(
      getHelpDeskIndicator({ isAdmin: false, pendingAdminCount: 0, newResolvedCount: 0 }),
    ).toEqual({ color: null, count: 0 });
  });

  it("ignores admin pending count when user is not admin", () => {
    expect(
      getHelpDeskIndicator({ isAdmin: false, pendingAdminCount: 9, newResolvedCount: 0 }),
    ).toEqual({ color: null, count: 0 });
  });

  it("prefers red admin badge over green resolved dot", () => {
    expect(
      getHelpDeskIndicator({ isAdmin: true, pendingAdminCount: 1, newResolvedCount: 4 }),
    ).toEqual({ color: "red", count: 1 });
  });

  it("transitions from red -> none after the responsible closes the last ticket", () => {
    const before = getHelpDeskIndicator({ isAdmin: true, pendingAdminCount: 1, newResolvedCount: 0 });
    const after = getHelpDeskIndicator({ isAdmin: true, pendingAdminCount: 0, newResolvedCount: 0 });
    expect(before.color).toBe("red");
    expect(after.color).toBeNull();
  });
});
