// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlatPricing } from "@/components/proposal/proposalView";

describe("FlatPricing discount rendering (RSL-33)", () => {
  const discountedOneTime = {
    amountCents: 900000,
    displayString: "$9,000",
    label: "Website build",
    discount: { amountCents: 100000, reason: "Loyalty" },
  };

  it("renders nothing when no line carries a discount", () => {
    const { container } = render(
      <FlatPricing
        oneTime={{ amountCents: 900000, displayString: "$9,000", label: "Build" }}
        recurring={null}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows was/now where 'now' equals the charged net (one-time)", () => {
    render(<FlatPricing oneTime={discountedOneTime} recurring={null} />);
    expect(screen.getByText("$9,000")).toBeInTheDocument(); // net (the charged amountCents)
    expect(screen.getByText("$10,000")).toBeInTheDocument(); // derived original (net + discount)
    expect(screen.getByText("Loyalty")).toBeInTheDocument();
  });

  it("shows cadence on a discounted recurring line", () => {
    render(
      <FlatPricing
        oneTime={null}
        recurring={{
          amountCents: 900000,
          displayString: "$9,000/month",
          label: "Retainer",
          intervalMonths: 1,
          discount: { amountCents: 100000, reason: "Promo" },
        }}
      />
    );
    expect(screen.getByText("$9,000/month")).toBeInTheDocument();
    expect(screen.getByText("$10,000/month")).toBeInTheDocument();
  });

  it("gives the struck 'was' price accessible was/now context for screen readers (a11y)", () => {
    render(<FlatPricing oneTime={discountedOneTime} recurring={null} />);
    expect(screen.getByLabelText("Was $10,000, now $9,000")).toBeInTheDocument();
  });
});
