# Solta website client workflow

Use this workflow from the agreed website purchase through launch and handoff. KP holds the delivery record; the client portal holds the client's project view, files, messages, reviews and payments. Every next step should have an owner and a clear completion condition.

## From deposit to launch

| Step | Client does | Solta does in KP | Ready to move on when |
| --- | --- | --- | --- |
| Agree the work | Confirms the scope, price and final approver. | Creates the company and planned project; records scope and terms. | The current scope has a recorded client approval. |
| Confirm the deposit | Pays through Stripe and keeps the receipt. | Verifies the paid deposit and records its reference. A public website deposit requires manual company/project setup; do not request a second deposit. | The actual payment is verified against the agreed amount. |
| Open the portal | Each person signs in with their own email. | Sets one final approver and any teammates, then sends each welcome invitation. | The intended people can access the correct company/project. |
| Collect the materials | Sends answers, copy, images and logo; uses portal files and messages for ordinary materials. | Enters onboarding answers, submits and reviews them, confirms dependencies and capacity, then explicitly approves delivery start. | Scope, onboarding, required payment, access and capacity gates are satisfied. |
| Build and review | Reviews the working preview. The approver decides on the exact version; teammates can request changes. | Saves, internally reviews and publishes each version, then checks the recorded client decision. | The current version is approved; a revision requires a fresh decision. |
| Prepare launch | Confirms final details and pays any agreed remaining balance. | Requests only the agreed balance, verifies payment, completes QA and records launch authorization. | Required QA, current approvals, payment and launch checks are complete. |
| Launch and hand over | Confirms the delivered site and receives agreed handoff/support information. | Performs the authorized launch, checks the live site, records handoff acceptance and closes the delivery stage when appropriate. | The live result and handoff match the agreed scope. |

For a standard website bought directly on the public site, the package agreement and deposit may arrive before KP setup. Record the existing agreement and payment rather than asking the client to repeat them. For custom work, agree scope and set up portal access before requesting the deposit through the portal.

Public checkout currently sends an internal deposit email; it does not automatically create a KP company, project or portal account. Assign that manual setup step to Solta when the payment is verified.

## Client materials

- Accurate business name, services, contact details and where enquiries should go.
- Agreed pages/features, audience and the main action visitors should take.
- Copy, approved claims, images, logo and existing brand materials; identify anything Solta must supply.
- Domain ownership and required access, provided through the appropriate secure access process.
- Final approver, teammates, dependencies and agreed timing.

Use the agreed scope to decide which items are required. Confirm required materials and dependencies before committing to a launch date.

Staff currently prepare onboarding answers in KP. The portal supports messages, files and website review; it does not yet provide the full client onboarding questionnaire. Publish one clear list of missing materials and the client's next action in project progress.

## Operating rules

Check the verified Stripe record before treating a payment as received. A browser return screen alone is not payment evidence. Test payments do not satisfy real payment requirements.

Portal access, a paid request and a website approval do not start delivery or launch automatically. Use KP's explicit start and production approvals. A new website version always needs a new decision.

Check KP for incoming messages/files and review decisions until the [email alerts](solta-client-email-alerts.md) are implemented. The client should be told to use the portal for project updates and requested payments; do not promise email alerts that are not enabled.

## Verified foundation

The October 13 QA company passed two invitation deliveries, approver/member role checks, messages, verified Word/PowerPoint uploads, exact-version approval and changes requests, and a fake Stripe payment synchronized to KP. The staff file download matched the original file exactly. Details are retained in [the hosted verification record](solta-first-client-verification.json).

Live Stripe-signed delivery awaits the first authorized real customer payment. No real money was used in QA.
