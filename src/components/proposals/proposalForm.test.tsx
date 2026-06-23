// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// proposalForm imports the server actions (which pull in next-auth -> next/server, unresolvable
// under vitest) and next/navigation. MoneyFields needs neither, so stub them out.
vi.mock("@/actions/proposals", () => ({ createProposal: vi.fn(), updateProposal: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { MoneyFields, importDiscount } from "@/components/proposals/proposalForm";

type Money = Parameters<typeof MoneyFields>[0]["value"];

/** Controlled wrapper so onChange feeds back into the rendered value (real edit behavior). */
function Harness({ initial, withInterval }: { initial: Money; withInterval?: boolean }) {
  const [value, setValue] = React.useState<Money>(initial);
  return <MoneyFields value={value} onChange={setValue} withDiscount withInterval={withInterval} />;
}

describe("MoneyFields discount inputs (RSL-33)", () => {
  it("reveals the list + discount inputs when the discount is enabled", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ label: "Build", displayString: "$1,000", amountCents: 100000 }} />);

    expect(screen.queryByText("List price ($)")).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch"));
    expect(screen.getByText("List price ($)")).toBeInTheDocument();
    expect(screen.getByText("Discount ($)")).toBeInTheDocument();
  });

  it("recomputes the charged net as list minus discount", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ label: "Build", displayString: "$1,000", amountCents: 100000 }} />);
    await user.click(screen.getByRole("switch")); // listCents stays 100000, discount 0

    const [, discountInput] = screen.getAllByRole("spinbutton"); // [list, discount]
    await user.clear(discountInput);
    await user.type(discountInput, "250");

    // net = $1,000 - $250 = $750 (the "Charged on Stripe" line)
    expect(screen.getByText("$750")).toBeInTheDocument();
  });

  it("restores the list price as the charged amount when the discount is removed", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          label: "Build",
          displayString: "$750",
          amountCents: 75000,
          discountEnabled: true,
          discountCents: 25000,
        }}
      />
    );

    await user.click(screen.getByRole("switch")); // toggle OFF: net -> listCents = $1,000
    expect(screen.getByDisplayValue("$1,000")).toBeInTheDocument();
  });

  it("flags when the discount is the whole price", () => {
    render(
      <Harness
        initial={{
          label: "Build",
          displayString: "$0",
          amountCents: 0,
          discountEnabled: true,
          discountCents: 100000,
        }}
      />
    );
    expect(screen.getByText("The discount can't be the whole price.")).toBeInTheDocument();
  });

  it("flags a display/charged mismatch in non-discount mode", () => {
    render(<Harness initial={{ label: "Build", displayString: "$1,000", amountCents: 90000 }} />);
    expect(screen.getByText(/will be charged/)).toBeInTheDocument();
  });

  it("warns inline when a discount is enabled with a blank reason (RSL-38)", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ label: "Build", displayString: "$1,000", amountCents: 100000 }} />);
    await user.click(screen.getByRole("switch")); // enable discount; reason starts blank
    expect(screen.getByText(/reason for the discount/i)).toBeInTheDocument();
  });
});

/** Surfaces the STORED displayString — the value that flows into the e-sign consent text + PDF. */
function DiscountHarness({ initial, withInterval }: { initial: Money; withInterval?: boolean }) {
  const [value, setValue] = React.useState<Money>(initial);
  return (
    <>
      <MoneyFields value={value} onChange={setValue} withDiscount withInterval={withInterval} />
      <output data-testid="stored">{value.displayString}</output>
    </>
  );
}

describe("MoneyFields keeps the cadence on discounted recurring lines (RSL-34)", () => {
  it("a discounted recurring net carries /month in the stored displayString", async () => {
    const user = userEvent.setup();
    render(
      <DiscountHarness
        withInterval
        initial={{
          label: "Growth",
          displayString: "$700/month",
          amountCents: 70000,
          intervalMonths: 1,
          discountEnabled: true,
          discountCents: 0,
        }}
      />
    );
    const [, discountInput] = screen.getAllByRole("spinbutton"); // [list, discount]
    await user.clear(discountInput);
    await user.type(discountInput, "100"); // $100 off a $700/mo list -> $600/mo
    expect(screen.getByTestId("stored").textContent).toBe("$600/month");
  });

  it("a discounted one-time net stays cadence-free", async () => {
    const user = userEvent.setup();
    render(
      <DiscountHarness
        initial={{
          label: "Setup",
          displayString: "$1,000",
          amountCents: 100000,
          discountEnabled: true,
          discountCents: 0,
        }}
      />
    );
    const [, discountInput] = screen.getAllByRole("spinbutton");
    await user.clear(discountInput);
    await user.type(discountInput, "250"); // $250 off $1,000 -> $750, no cadence
    expect(screen.getByTestId("stored").textContent).toBe("$750");
  });

  it("removing the discount restores the list price WITH its cadence", async () => {
    const user = userEvent.setup();
    render(
      <DiscountHarness
        withInterval
        initial={{
          label: "Growth",
          displayString: "$600/month",
          amountCents: 60000,
          intervalMonths: 1,
          discountEnabled: true,
          discountCents: 10000,
        }}
      />
    );
    await user.click(screen.getByRole("switch")); // toggle OFF -> net = list = $700/mo
    expect(screen.getByTestId("stored").textContent).toBe("$700/month");
  });
});

describe("importDiscount keeps cadence on the skill-import path (RSL-34)", () => {
  it("a recurring discounted import carries /month", () => {
    expect(
      importDiscount({ amountCents: 10000, reason: "Launch promo" }, 70000, 1)?.displayString
    ).toBe("$600/month");
  });
  it("a one-time discounted import stays cadence-free", () => {
    expect(
      importDiscount({ amountCents: 25000, reason: "Launch promo" }, 100000, null)?.displayString
    ).toBe("$750");
  });
});
