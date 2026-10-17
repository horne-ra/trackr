import { mkdirSync, writeFileSync } from "node:fs";
import type { Issue, Person } from "../src/types.js";

const people: Person[] = [
  { username: "maria", name: "Maria Lopez" }, { username: "dev", name: "Dev Patel" },
  { username: "sam", name: "Sam Okafor" }, { username: "priya", name: "Priya Nair" },
];
const titles = [
  "Checkout page loses delivery notes", "Login form forgets the return URL", "Cart badge stays stale after removing an item", "Search results hide product availability",
  "Payment receipt omits the order reference", "Checkout page flashes an expired discount", "Password reset email arrives with a broken link", "Cart quantity resets after a failed payment",
  "Search filter chips are hard to dismiss", "Shipping estimate ignores the selected country", "Account page shows the wrong email preference", "Product images shift the add button",
  "Gift message disappears after signing in", "Order history rounds the refunded amount", "Login redirect loops on an expired session", "Saved addresses need keyboard focus",
  "Checkout migration changes card error labels", "Search ignores accented product names", "Cart subtotal updates before the delivery fee", "Welcome emails use the previous customer name",
  "Refund timeline is missing a timezone", "Mobile navigation covers the login button", "Product search repeats archived variants", "Shipping confirmation waits for carrier mapping",
  "Checkout migration is waiting on payment approval", "Inventory import awaits supplier credentials", "Saved card rollout needs a security review", "Email resend is blocked by domain verification",
  "Returns form waits on warehouse reason codes", "Address validation needs international samples", "Login screen now announces errors", "Search results preserve the price filter",
  "Checkout page accepts apartment numbers", "Cart removes unavailable variants clearly", "Receipts now include tax totals", "Order history links to the right shipment",
  "Password reset expires old tokens", "Gift cards display remaining credit", "Product images include descriptive text", "Delivery settings persist across sessions",
];
let seed = 20261017;
function random(n: number) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; }
const voices = [
  "I walked through the customer flow again and compared the screen with the support report.",
  "I traced the request through the service and checked the response against our stored order data.",
  "I repeated the reproduction steps on a narrow screen and checked the keyboard path as well.",
  "I reviewed the rollout notes and compared this behavior with the agreement from our planning session.",
];
const observations = [
  "The problem is repeatable with a returning customer, but the first visit still follows the expected path without an extra prompt.",
  "The latest capture makes the ordering easier to see, and there is no indication that the underlying customer record has been lost.",
  "The visible message appears before the background request finishes, which explains why refreshing the page makes the report look inconsistent.",
  "The test account has the same settings as the affected account, so we should keep those details in the regression case.",
];
const nextSteps = [
  "I will attach the request details to this thread and check the smallest change before we include it in the next release.",
  "Please keep the existing behavior for older orders while we check the new path, since support still uses those records every day.",
  "The next useful check is a complete pass with the same account after signing out, including the final confirmation and the email.",
  "Once the change is ready, I can repeat this exact sequence and compare the result with the screenshots already saved for support.",
];
const result: Issue[] = titles.map((title, i) => {
  const status = i < 14 ? "open" : i < 23 ? "in_progress" : i < 29 ? "blocked" : "closed";
  const assignee = i < 4 ? people[0]! : i < 14 ? people[1 + (i % 3)]! : i === 16 ? people[1]! : people[i % 4]!;
  const count = i < 4 ? 15 : 8 + random(8);
  return { id: `TRK-${101 + i}`, title, status, assignee,
    body: "Returning customers see this on mobile.",
    comments: Array.from({ length: count }, (_, j) => {
      const author = people[(i + j) % 4]!;
      return { author: author.username, body: `${voices[(i + j) % 4]} For ${title.toLowerCase()}, I used our Larkspur Goods sample account. ${observations[random(observations.length)]} ${nextSteps[random(nextSteps.length)]} I have kept the original reproduction details so the next person can compare the same sequence without guessing.` };
    }),
  };
});
mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true });
writeFileSync(new URL("../fixtures/issues.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(`Generated ${result.length} fictional Larkspur Goods issues with seed 20261017.`);
