import { render } from "@react-email/components";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import CampaignPromo from "../src/templates/campaign-promo";
import OrderConfirm from "../src/templates/order-confirm";
import ShipmentTracking from "../src/templates/shipment-tracking";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(
  __dirname,
  "../../../services/backend-api/email-templates",
);
fs.mkdirSync(outDir, { recursive: true });

// Each template receives Jinja2 token strings as props.
// The {{ }} tokens survive render() as literal text because React
// treats them as plain string content, not JSX expressions.
// For structural blocks (loops), dangerouslySetInnerHTML is used
// in the template to prevent React from escaping HTML tags.

const J2 = (s: string) => `{{ ${s} }}`;
const itemsJinja =
  '{% for item in items %}<tr style="border-bottom:1px solid #eee;">' +
  '<td style="padding:8px 0;">{{ item.qty }}x {{ item.name }}</td>' +
  '<td style="padding:8px 0;text-align:right;">{{ item.price }}</td></tr>' +
  "{% endfor %}";

async function main() {
  const templates: { name: string; render: () => Promise<string> }[] = [
    {
      name: "campaign-promo",
      render: () =>
        render(
          <CampaignPromo
            customerName={J2("customerName")}
            segmentName={J2("segmentName")}
            offerHtml={J2("offerHtml")}
            storeUrl={J2("storeUrl")}
          />,
        ),
    },
    {
      name: "order-confirm",
      render: () =>
        render(
          <OrderConfirm
            customerName={J2("customerName")}
            orderNumber={J2("orderNumber")}
            itemsTable={itemsJinja}
            total={J2("total")}
            storeUrl={J2("storeUrl")}
          />,
        ),
    },
    {
      name: "shipment-tracking",
      render: () =>
        render(
          <ShipmentTracking
            customerName={J2("customerName")}
            orderNumber={J2("orderNumber")}
            carrier={J2("carrier")}
            trackingNumber={J2("trackingNumber")}
            trackingUrl={J2("trackingUrl")}
            storeUrl={J2("storeUrl")}
          />,
        ),
    },
  ];

  for (const { name, render: renderFn } of templates) {
    const html = await renderFn();
    fs.writeFileSync(path.join(outDir, `${name}.html`), html);
    console.log(`Compiled: ${name}.html`);
  }

  console.log(`\nDone — ${templates.length} templates written to ${outDir}`);
}

main().catch(console.error);
