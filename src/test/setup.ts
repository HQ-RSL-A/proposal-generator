// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute, ...) for the
// jsdom component tests. Harmless for the node-env logic tests — the matchers only touch the DOM
// when actually called, which those tests never do.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees between tests so jsdom renders don't accumulate (cleanup is a no-op for the
// node-env logic tests, which never mount anything).
afterEach(() => cleanup());
