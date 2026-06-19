// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// proposalForm imports the server actions (which pull in next-auth -> next/server, unresolvable
// under vitest) and next/navigation. MoneyFields needs neither, so stub them out.
vi.mock("@/actions/proposals", () => ({ createProposal: vi.fn(), updateProposal: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { MoneyFields } from "@/components/proposals/proposalForm";

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
});
