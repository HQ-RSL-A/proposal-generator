/** Full client name, omitting a blank last name (a client may be known by first name only). */
export function clientFullName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => String(part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * Collapse the spacing artifact a blank merge field leaves: a space before a comma/period/etc.
 * ("First , Co" -> "First, Co") and any resulting double space. Apply only when a name field is
 * actually blank — normal lines never contain a space before punctuation, so it's a safe cleanup.
 */
export function collapseNameFieldGap(text: string): string {
  return text.replace(/ +([,.;:])/g, "$1").replace(/ {2,}/g, " ");
}
