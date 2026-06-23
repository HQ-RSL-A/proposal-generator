import { TOKEN_KEYS, type TokensJson } from "@/lib/types";
import { CopyableCode } from "@/components/docs/copyableCode";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Import schema" };

type FieldMeta = { required: boolean; description: string; example: string };

// Typed against keyof TokensJson so this object cannot drift from src/lib/types.ts:
// add or remove a token key there and the build fails until this map is updated.
const FIELD_META: Record<keyof TokensJson, FieldMeta> = {
  "Client.ProposalTitle": {
    required: true,
    description: "Headline of the proposal. Becomes the page title and the PDF cover heading.",
    example: "Growth Marketing System for Acme Corp",
  },
  "Client.FirstName": {
    required: true,
    description: "Primary signer first name. Used in the greeting.",
    example: "Jordan",
  },
  "Client.LastName": {
    required: false,
    description: "Primary signer last name. Optional - leave blank for a client known by first name only.",
    example: "Avery",
  },
  "Client.Company": {
    required: true,
    description:
      "Client company name. Appears in At a Glance, the acceptance block, the agreement, and the PDF filename.",
    example: "Acme Corp",
  },
  "Client.ProblemTitle": {
    required: true,
    description: "Heading for the problem section.",
    example: "Inconsistent lead flow despite strong demand",
  },
  "Client.ProblemText": {
    required: true,
    description: "Problem narrative. Blank lines split it into separate paragraphs.",
    example: "First paragraph of the problem.\\n\\nSecond paragraph.",
  },
  "Client.SolutionTitle": {
    required: true,
    description: "Heading for the solution section.",
    example: "A system that runs itself",
  },
  "Client.SolutionText": {
    required: true,
    description: "Solution narrative. Blank lines split it into separate paragraphs.",
    example: "First paragraph of the solution.\\n\\nSecond paragraph.",
  },
  "Client.AtGlanceServices": {
    required: true,
    description: "One line summarizing what you are building.",
    example: "Website rebuild plus rotating monthly marketing",
  },
  "Client.AtGlanceInvestment": {
    required: true,
    description: "One line, human readable. Not parsed for amounts (pricing is set separately).",
    example: "Three options, $1,800 to $4,500 per month",
  },
  "Client.AtGlanceTimeline": {
    required: true,
    description: "One line timeline summary.",
    example: "Website live in 2 to 3 weeks",
  },
  "Client.ScopeItems": {
    required: true,
    description: "What is included. One item per line. A leading bullet, dash, or long dash is removed.",
    example: "Discovery and strategy\\nWebsite rebuild\\nMonthly campaigns",
  },
  "Client.TimelineItems": {
    required: true,
    description: "Timeline steps. One per line, same bullet stripping as scope items.",
    example: "Week 1: Discovery\\nWeek 2: Build\\nWeek 3: Launch",
  },
  "Client.InvestmentDetails": {
    required: true,
    description: "Lead-in text shown above the pricing. Use it to introduce a tier table.",
    example: "Pick the option that fits where you are.",
  },
  "Client.InvestmentNote": {
    required: true,
    description: "Note shown below the pricing. Payment terms or ROI framing.",
    example: "Monthly fees are billed in advance each cycle.",
  },
  "Document.CreatedDate": {
    required: false,
    description: "Date shown on the document. Defaults to today if you leave it out.",
    example: "June 13, 2026",
  },
  "Client.ValidUntil": {
    required: false,
    description: "Offer expiry. Defaults to today plus 30 days if you leave it out.",
    example: "July 13, 2026",
  },
};

const TOKENS_EXAMPLE = `{
  "Client.ProposalTitle": "Growth Marketing System for Acme Corp",
  "Client.FirstName": "Jordan",
  "Client.LastName": "Avery",
  "Client.Company": "Acme Corp",
  "Client.ProblemTitle": "Inconsistent lead flow despite strong demand",
  "Client.ProblemText": "Demand is strong but the pipeline is unpredictable.\\n\\nMost months start from zero with no system feeding it.",
  "Client.SolutionTitle": "A system that runs itself",
  "Client.SolutionText": "A rebuilt site plus a monthly engine that keeps leads coming.\\n\\nYou get the same motion every month, not a scramble.",
  "Client.AtGlanceServices": "Website rebuild plus rotating monthly marketing",
  "Client.AtGlanceInvestment": "Three options, $1,800 to $4,500 per month",
  "Client.AtGlanceTimeline": "Website live in 2 to 3 weeks",
  "Client.ScopeItems": "Discovery and strategy\\nWebsite rebuild\\nMonthly campaigns",
  "Client.TimelineItems": "Week 1: Discovery and setup\\nWeek 2: Build\\nWeek 3: Launch",
  "Client.InvestmentDetails": "Pick the option that fits where you are.",
  "Client.InvestmentNote": "Monthly fees are billed in advance each cycle.",
  "Document.CreatedDate": "June 13, 2026",
  "Client.ValidUntil": "July 13, 2026"
}`;

const PAYMENT_ONETIME = `{
  "currency": "usd",
  "paymentMethods": ["card"],
  "preferAch": false,
  "oneTime": { "amountCents": 250000, "displayString": "$2,500", "label": "Project fee" },
  "recurring": null,
  "tiers": null
}`;

const PAYMENT_RECURRING = `{
  "currency": "usd",
  "paymentMethods": ["card", "us_bank_account"],
  "preferAch": false,
  "oneTime": null,
  "recurring": { "amountCents": 300000, "displayString": "$3,000", "label": "Monthly retainer", "intervalMonths": 1 },
  "tiers": null
}`;

const PAYMENT_COMBO = `{
  "currency": "usd",
  "paymentMethods": ["card"],
  "preferAch": false,
  "oneTime": { "amountCents": 150000, "displayString": "$1,500", "label": "Setup fee" },
  "recurring": { "amountCents": 200000, "displayString": "$2,000", "label": "Monthly retainer", "intervalMonths": 1 },
  "tiers": null
}`;

const PAYMENT_TIERED = `{
  "currency": "usd",
  "paymentMethods": ["card", "us_bank_account"],
  "preferAch": false,
  "oneTime": null,
  "recurring": null,
  "tiers": [
    {
      "id": "tier-starter",
      "label": "Starter",
      "recommended": false,
      "includes": ["Foundational website", "Monthly reporting"],
      "oneTime": null,
      "recurring": { "amountCents": 180000, "displayString": "$1,800", "label": "Starter monthly", "intervalMonths": 1 }
    },
    {
      "id": "tier-growth",
      "label": "Growth",
      "recommended": true,
      "includes": ["Everything in Starter", "Paid ads management", "Conversion tracking"],
      "oneTime": null,
      "recurring": { "amountCents": 300000, "displayString": "$3,000", "label": "Growth monthly", "intervalMonths": 1 }
    }
  ]
}`;

const PAYMENT_SIGNONLY = `{
  "currency": "usd",
  "paymentMethods": ["card"],
  "preferAch": false,
  "oneTime": null,
  "recurring": null,
  "tiers": null
}`;

const PAYMENT_MANUAL_INVOICE = `{
  "currency": "usd",
  "paymentMethods": ["card"],
  "preferAch": false,
  "oneTime": { "amountCents": 600000, "displayString": "$6,000", "label": "Website build" },
  "recurring": null,
  "tiers": null,
  "manualInvoice": true
}`;

const PAYMENT_DISCOUNT = `{
  "currency": "usd",
  "paymentMethods": ["card"],
  "preferAch": false,
  "oneTime": { "amountCents": 500000, "displayString": "$5,000", "label": "Website build", "discount": { "amountCents": 100000, "reason": "Founder discount" } },
  "recurring": null,
  "tiers": null
}`;

const INVESTMENT_STRUCTURE = `{
  "Investment.Structure": {
    "type": "tiers",
    "tiers": [
      { "name": "Starter", "price": "$1,800/month", "includes": ["Foundational website", "Monthly reporting"], "recommended": false },
      { "name": "Growth", "price": "$3,000/month", "includes": ["Everything in Starter", "Paid ads management"], "recommended": true }
    ]
  }
}`;

const PAYMENT_ADDONS = `{
  "currency": "usd",
  "paymentMethods": ["card"],
  "preferAch": false,
  "oneTime": { "amountCents": 600000, "displayString": "$6,000", "label": "Website build" },
  "recurring": null,
  "tiers": null,
  "addOns": [
    { "id": "addon-rush", "label": "Rush delivery (two-week build)", "displayString": "$800", "amountCents": 80000, "intervalMonths": null },
    { "id": "addon-seo", "label": "Monthly SEO", "displayString": "$500", "amountCents": 50000, "intervalMonths": 1 }
  ]
}`;

const PAYMENT_DEPOSIT = `{
  "currency": "usd",
  "paymentMethods": ["card"],
  "preferAch": false,
  "oneTime": { "amountCents": 600000, "displayString": "$6,000", "label": "Website build" },
  "recurring": { "amountCents": 50000, "displayString": "$500", "label": "Monthly retainer", "intervalMonths": 1 },
  "tiers": null,
  "deposit": { "depositPercent": 50 }
}`;

const PAYMENT_FUTURE = `{
  "currency": "usd",
  "paymentMethods": ["card"],
  "preferAch": false,
  "oneTime": { "amountCents": 600000, "displayString": "$6,000", "label": "Website build" },
  "recurring": null,
  "tiers": null,
  "futureItems": [
    { "id": "future-seo", "label": "Monthly SEO retainer", "displayString": "$1,500/month", "amountCents": 150000, "intervalMonths": 1, "startsNote": "After launch" },
    { "id": "future-brand", "label": "Brand refresh (Phase 2)", "displayString": "$3,000", "amountCents": 300000, "intervalMonths": null, "startsNote": "Q4 2026" }
  ]
}`;

const INVESTMENT_ADDONS = `{
  "Investment.AddOns": [
    { "name": "Rush delivery (two-week build)", "price": "$800" },
    { "name": "Monthly SEO", "price": "$500/month" }
  ],
  "Investment.DepositPercent": 50
}`;

const INVESTMENT_FUTURE = `{
  "Investment.FutureItems": [
    { "name": "Monthly SEO retainer", "price": "$1,500/month", "starts": "After launch" },
    { "name": "Brand refresh (Phase 2)", "price": "$3,000", "starts": "Q4 2026" }
  ]
}`;

const CONTENT_TRACK_RECORD = `{
  "Content.TrackRecord": {
    "intro": "We build marketing infrastructure for service businesses, designed to run with minimal upkeep.",
    "caseStudies": [
      { "text": "A local restaurant went from 14 to 132 reviews in 60 days.", "url": "https://rsla.io/work/local-seo-reputation-management" },
      { "text": "A salon owner turned $600 in Meta ads into $36K in 3 months.", "url": "https://rsla.io/work/salon-marketing-automation-roi" }
    ]
  }
}`;

function CodeBlock({ children }: { children: string }) {
  return <CopyableCode code={children} />;
}

export default function DocsPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-heading text-2xl font-bold">Proposal import schema</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The JSON the import box on New Proposal accepts. An agent or a teammate can build a valid
          payload from this page alone. Pasting JSON is optional. It only pre-fills the form, and
          every field stays editable afterward.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">
          What the tokens fill (and what they don&apos;t)
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The proposal is a fixed RSL/A template. The tokens you paste only fill the blanks: the
          headline, the client name and company, your problem and solution paragraphs, the at a
          glance values, the scope and timeline lists, and the investment lead-in and note.
          Everything else is the same on every proposal and is written by the platform, not by you:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            The greeting (&quot;Hi [first name],&quot;), the contact line (phone plus team@rsla.io),
            and the sign-off (&quot;Thanks, Rahul L.&quot;).
          </li>
          <li>
            Every section heading and its intro and outro lines (Scope of Work, Timelines, Your
            Investment, How to Proceed, and so on).
          </li>
          <li>The Acceptance block, the fine-print notes, and the full Master Services Agreement.</li>
        </ul>
        <p className="max-w-2xl text-sm text-muted-foreground">
          So Client.ProblemText and Client.SolutionText are the body paragraphs only. Do not put a
          greeting, a sign-off, or contact details inside them. The platform already wraps your
          paragraphs with those.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">How import works</h2>
        <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Paste a tokens JSON into the import box on New Proposal.</li>
          <li>The token fields pre-fill the form.</li>
          <li>An optional Investment.Structure block pre-fills the pricing tiers.</li>
          <li>Set or adjust anything in the form, then send.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Token fields</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Seventeen string keys. Fifteen are required. The two date fields fill themselves if you
          leave them out.
        </p>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>What it is</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TOKEN_KEYS.map((key) => {
                const m = FIELD_META[key];
                return (
                  <TableRow key={key}>
                    <TableCell className="align-top font-mono text-xs">{key}</TableCell>
                    <TableCell className="align-top">
                      {m.required ? (
                        <span className="text-xs font-medium text-foreground">Required</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Optional</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      <p>{m.description}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        e.g. {m.example}
                      </p>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>Document.CreatedDate defaults to today. Client.ValidUntil defaults to today plus 30 days.</li>
          <li>ScopeItems and TimelineItems are one item per line. A leading bullet, dash, or long dash is removed.</li>
          <li>ProblemText and SolutionText split on blank lines into paragraphs.</li>
          <li>Any extra keys (for example a legacy CaseStudy field) are accepted and ignored.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Full token example</h2>
        <CodeBlock>{TOKENS_EXAMPLE}</CodeBlock>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Pricing (PaymentConfig)</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pricing is set in the form, or imported from the pasted JSON: flat pricing from top-level
          oneTime / recurring (plus paymentMethods and preferAch), tiers from an Investment.Structure
          block (below). It is stored as a PaymentConfig in one of three shapes (flat, tiered,
          sign-only). Money is
          always an integer amountCents plus a matching displayString. At send time the two must
          agree to the cent. Optional fields stack on top of any shape: addOns (extras the client
          toggles), a discount on any charged line, deposit (charge only a percentage up front),
          futureItems (priced Phase-2 lines shown but never billed), and manualInvoice (skip the
          online checkout and invoice the client yourself).
        </p>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Flat, one time</h3>
          <CodeBlock>{PAYMENT_ONETIME}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Flat, recurring</h3>
          <CodeBlock>{PAYMENT_RECURRING}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Flat, setup fee plus recurring</h3>
          <CodeBlock>{PAYMENT_COMBO}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Tiered (client picks one)</h3>
          <CodeBlock>{PAYMENT_TIERED}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Sign only (no payment)</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Nothing is priced and nothing is charged. The signing flow ends on a confirmation page.
          </p>
          <CodeBlock>{PAYMENT_SIGNONLY}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Manual invoice (priced, but no online checkout)</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Add manualInvoice: true to a flat or tiered deal and the full pricing still shows on the
            proposal and the client signs as normal, but no Stripe checkout runs. You invoice the
            client yourself and click Mark as paid once you have collected. No payment email goes to
            the client, and the deal counts toward your dashboard revenue the moment it is signed.
            Unlike sign-only, the price is shown and committed to. (On a deal with no price at all,
            the flag is ignored and it stays sign-only.) In the form it is the checkbox
            &quot;Don&apos;t collect payment, I&apos;ll invoice manually.&quot;
          </p>
          <CodeBlock>{PAYMENT_MANUAL_INVOICE}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Optional add-ons (any shape)</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A global addOns array the client can toggle on the signing page, on top of the tier or
            flat price they pick. Each add-on is one time (intervalMonths null) or recurring (1, 3,
            or 12). Up to ten, each with a unique id.
          </p>
          <CodeBlock>{PAYMENT_ADDONS}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Discounts (any charged line)</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Any charged line (flat one-time or recurring, a tier&apos;s one-time or recurring, or an
            add-on) can carry a discount. In the form, turn on Apply a discount, enter the list price
            plus the discount amount and a reason; the app charges the net (list minus discount) and
            shows the client the original struck through with the reason. In a pasted JSON, add a
            discount object to the line: on Investment.Structure tiers and Investment.AddOns it is{" "}
            {"{ amount, reason }"} where the line price is the list price; on the internal flat
            oneTime/recurring shape it is {"{ amountCents, reason }"} where amountCents is already the
            net. A discount on a recurring line is an ongoing reduced rate.
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Two discount shapes, one per block. Tiered and add-on discounts use{" "}
            {"{ amount, reason }"} where the line price is the list and the app subtracts the
            discount. Flat oneTime and recurring discounts use {"{ amountCents, reason }"} where
            amountCents is already the net and the discount is recorded for display only. The import
            toast lists each resolved &quot;was X, now Y&quot; so you can confirm the net before
            sending.
          </p>
          <CodeBlock>{PAYMENT_DISCOUNT}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Deposit (charge a percentage up front)</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            deposit.depositPercent (1 to 99, usually 50) charges only that share of the one-time
            build fee at signing. The remaining balance and any monthly retainer are deferred, not
            started at signing, so the signing charge is a single one-time deposit. It needs a
            one-time amount to apply.
          </p>
          <CodeBlock>{PAYMENT_DEPOSIT}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Later phases, display-only (any shape)</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A global futureItems array shown with pricing in Your Investment but never charged — for
            Phase-2 or future services that begin later. Each carries a startsNote (when it begins)
            and is one time (intervalMonths null) or recurring (1, 3, or 12). Up to six, each with a
            unique id. It lives outside the checkout, so it can never be billed at signing.
          </p>
          <CodeBlock>{PAYMENT_FUTURE}</CodeBlock>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Product names on Stripe</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Each line&apos;s label is the exact product name the client sees on the Stripe checkout
            and receipt — for the flat one-time and recurring lines, the selected tier&apos;s lines,
            and each add-on. Name them how you want them to read on the charge.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Optional: Investment.Structure</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A top level block in the pasted JSON that pre-fills the tier pricing UI. It is not one of
          the token fields and is dropped after import.
        </p>
        <CodeBlock>{INVESTMENT_STRUCTURE}</CodeBlock>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>type must be the string tiers, with two to four tiers.</li>
          <li>A price counts as recurring when it contains /mo, /month, /quarter, /yr, or /year.</li>
          <li>Inferred tiers are monthly. Quarterly or annual billing must be set in the form.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">
          Optional: Investment.AddOns, FutureItems, and deposit
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          More top level blocks the import reads and then drops. Investment.AddOns pre-fills the
          add-on editor (a price with a /mo, /month, /quarter, /yr, or /year suffix becomes a
          recurring add-on; otherwise one time). Investment.DepositPercent (1 to 99) turns the
          deposit on.
        </p>
        <CodeBlock>{INVESTMENT_ADDONS}</CodeBlock>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Investment.FutureItems pre-fills the Later phases editor — display-only priced lines that
          are never billed. Each takes a name, a price (recurring when it carries a /mo, /month,
          /quarter, /yr, or /year suffix), and a starts note. Up to six.
        </p>
        <CodeBlock>{INVESTMENT_FUTURE}</CodeBlock>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Optional: Content.TrackRecord</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A top level block that pre-fills the Our Track Record editor. intro is an optional
          lead-in; caseStudies is the list shown to the client. The section heading and the
          results-vary disclaimer are added for you. Drop the block (or send no case studies) to
          hide the whole section.
        </p>
        <CodeBlock>{CONTENT_TRACK_RECORD}</CodeBlock>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            Each case study needs text. url is optional: with a url it renders as a link, without
            one it is plain text.
          </li>
          <li>Up to six case studies. Extra ones are dropped on import.</li>
          <li>Leave it out to hide Our Track Record on this proposal.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Gotchas</h2>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>displayString must match amountCents to the cent, or sending is blocked.</li>
          <li>Tiers: two to four, each with a unique id, and at most one marked recommended.</li>
          <li>Every tier needs at least a one time or a recurring amount.</li>
          <li>Use flat pricing or tiers, not both.</li>
          <li>Add-ons: up to ten, each with a unique id, each one time or recurring.</li>
          <li>
            A deposit needs a one-time build fee (flat or on at least one tier). With a deposit, the
            retainer and recurring add-ons are deferred, so only the deposit is charged at signing.
          </li>
          <li>
            Future items: up to six, each with a unique id and a startsNote. Display-only — shown
            with pricing but never billed (kept out of checkout). Bill them separately when they
            begin.
          </li>
          <li>Track Record: up to six case studies, each with text and an optional url. No case studies hides the section.</li>
          <li>Use generic names in examples and tests. The Notion sync matches real CRM rows by company name.</li>
        </ul>
      </section>
    </div>
  );
}
