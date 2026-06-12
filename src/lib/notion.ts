// Notion CRM sync — Clients & Prospect Tracker. Always best-effort via PendingJob:
// Notion being down must never block signing or payment.

const NOTION_DB_ID = "2e6fbb11-fa61-806d-b596-caae1b2e3710";
const NOTION_VERSION = "2022-06-28";

async function notionFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY is not set");
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion ${path} failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

interface NotionDbSchema {
  titlePropertyName: string | null;
  propertyNames: Set<string>;
}

/** DB schema lookup — discovers the title property name and tolerates property drift. */
async function getDbSchema(): Promise<NotionDbSchema> {
  const db = (await notionFetch(`/databases/${NOTION_DB_ID}`)) as unknown as {
    properties: Record<string, { type: string }>;
  };
  const propertyNames = new Set(Object.keys(db.properties ?? {}));
  const titlePropertyName =
    Object.entries(db.properties ?? {}).find(([, p]) => p.type === "title")?.[0] ?? null;
  return { titlePropertyName, propertyNames };
}

/** Find the CRM page whose title contains the company name. */
export async function findCrmPage(company: string): Promise<string | null> {
  const schema = await getDbSchema();
  if (schema.titlePropertyName) {
    const result = (await notionFetch(`/databases/${NOTION_DB_ID}/query`, {
      method: "POST",
      body: JSON.stringify({
        page_size: 3,
        filter: {
          property: schema.titlePropertyName,
          title: { contains: company },
        },
      }),
    })) as unknown as { results: { id: string }[] };
    if (result.results?.length) return result.results[0].id;
  }

  // Fallback: integration-scoped search filtered to this database.
  const search = (await notionFetch(`/search`, {
    method: "POST",
    body: JSON.stringify({ query: company, page_size: 5 }),
  })) as unknown as { results: { id: string; parent?: { database_id?: string } }[] };
  const hit = (search.results ?? []).find(
    (r) => r.parent?.database_id?.replace(/-/g, "") === NOTION_DB_ID.replace(/-/g, "")
  );
  return hit?.id ?? null;
}

async function getDbPropertyNames(): Promise<Set<string>> {
  return (await getDbSchema()).propertyNames;
}

export async function updateCrmOnPaid(input: {
  company: string;
  monthlyFeeCents: number | null;
  oneTimeFeeCents: number | null;
  proposalUrl: string;
  signedPdfUrl: string | null;
  stripeCustomerId: string | null;
}): Promise<{ pageId: string | null }> {
  const pageId = await findCrmPage(input.company);
  if (!pageId) return { pageId: null };

  const available = await getDbPropertyNames();
  const properties: Record<string, unknown> = {};

  if (available.has("Status")) {
    properties["Status"] = { select: { name: "Client" } };
  }
  if (available.has("Contract Start")) {
    properties["Contract Start"] = {
      date: { start: new Date().toISOString().slice(0, 10) },
    };
  }
  if (available.has("Monthly Fee") && input.monthlyFeeCents !== null) {
    properties["Monthly Fee"] = { number: input.monthlyFeeCents / 100 };
  }
  if (available.has("One-Time Fee") && input.oneTimeFeeCents !== null) {
    properties["One-Time Fee"] = { number: input.oneTimeFeeCents / 100 };
  }

  if (Object.keys(properties).length > 0) {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
  }

  // Notes append: write as a comment-safe block append on the page body instead of
  // clobbering a Notes property.
  const noteLines = [
    `Signed & paid ${new Date().toLocaleDateString("en-US")}`,
    `Proposal: ${input.proposalUrl}`,
    input.signedPdfUrl ? `Signed PDF: ${input.signedPdfUrl}` : null,
    input.stripeCustomerId ? `Stripe customer: ${input.stripeCustomerId}` : null,
  ].filter(Boolean) as string[];

  await notionFetch(`/blocks/${pageId}/children`, {
    method: "PATCH",
    body: JSON.stringify({
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: noteLines.join("\n") } }],
          },
        },
      ],
    }),
  });

  return { pageId };
}

export async function noteOnSigned(input: {
  company: string;
  proposalUrl: string;
}): Promise<{ pageId: string | null }> {
  const pageId = await findCrmPage(input.company);
  if (!pageId) return { pageId: null };
  await notionFetch(`/blocks/${pageId}/children`, {
    method: "PATCH",
    body: JSON.stringify({
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `Proposal signed ${new Date().toLocaleDateString("en-US")} — awaiting payment. ${input.proposalUrl}`,
                },
              },
            ],
          },
        },
      ],
    }),
  });
  return { pageId };
}
