import { describe, expect, it } from "vitest";
import { declineOutcome } from "@/lib/signingOutcome";

describe("declineOutcome (RSL-32 client routing)", () => {
  it("redirects to the server's redirectUrl on a successful decline", () => {
    expect(declineOutcome(true, { redirectUrl: "/sign/tok/declined" }, "tok")).toEqual({
      kind: "redirect",
      url: "/sign/tok/declined",
    });
  });

  it("falls back to the declined page when ok but no redirectUrl", () => {
    expect(declineOutcome(true, {}, "tok")).toEqual({ kind: "redirect", url: "/sign/tok/declined" });
  });

  it("routes already_signed to the signed terminal page", () => {
    expect(declineOutcome(false, { code: "already_signed" }, "tok")).toEqual({
      kind: "redirect",
      url: "/sign/tok/signed",
    });
  });

  it("routes expired to the expired terminal page", () => {
    expect(declineOutcome(false, { code: "expired" }, "tok")).toEqual({
      kind: "redirect",
      url: "/sign/tok/expired",
    });
  });

  it("routes an already-declined (code 'declined') to the declined page", () => {
    expect(declineOutcome(false, { code: "declined" }, "tok")).toEqual({
      kind: "redirect",
      url: "/sign/tok/declined",
    });
  });

  it("shows an error toast for an unrouted code, surfacing the server message", () => {
    expect(
      declineOutcome(false, { code: "voided", error: "This proposal was withdrawn." }, "tok")
    ).toEqual({ kind: "toast", message: "This proposal was withdrawn." });
  });

  it("shows a generic toast when an error has no code or message", () => {
    expect(declineOutcome(false, {}, "tok")).toEqual({ kind: "toast", message: "Something went wrong" });
  });
});
