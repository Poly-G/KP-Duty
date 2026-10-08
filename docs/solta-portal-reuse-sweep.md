# Solta portal reuse sweep

Reviewed October 7, 2026. This narrows the earlier business-workspace audit to paid onboarding, Solta branding and plan-scoped client requests. No third-party code or dependency was installed/copied in this slice.

## Inventory and decisions

KP already implements the delivery lifecycle, service questionnaires, versioned scopes, private files, client publication, deliverables/review history, explicit owner start gates and retry-safe writes. These modules are the first reuse choice. The current client view is a staff-only read-only preview, not a complete onboarding portal or a branded/authenticated client application. Existing file endpoints and queries authorize staff only. Existing internal Requests creates Poly decisions and should not be directly exposed as a client ticket API.

The connected Poly-G repository inventory was reviewed across both pages. It includes SnD, Internal-Ai-System, NexProviders, mettlesite and KP-Duty. No Solta-named repository is visible; a Solta repository link/access is needed before its components, stack and ongoing redesign can be checked. Do not assume a repo name or edit mettlesite as Solta's website.

| Source | Useful code | License evidence | Decision |
| --- | --- | --- | --- |
| [React Hook Form](https://github.com/react-hook-form/react-hook-form) | Conditional multi-step onboarding, field errors and draft state; Zod is already in KP | Repository declares MIT | First shortlist for a React portal. Recheck Solta's stack and exact version/peer dependencies before installing. Server validation and durable draft saves remain ours. |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Accessible dialogs, tabs, form controls and sidebar building blocks; customize to Solta tokens | Repository declares MIT | Select individual components if Solta is React; reuse existing site components first. This is not a branded template or portal backend. |
| [Uppy](https://github.com/transloadit/uppy) | Upload progress, retry/resume, file restrictions | [MIT license](https://github.com/transloadit/uppy/blob/main/LICENSE) | Shortlist when upgrading client uploads. [Supabase documents TUS/Uppy integration](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). Preserve private immutable file versions, project authorization and explicit sharing. No remote pickers/Companion needed initially. |
| [Stripe checkout-single-subscription](https://github.com/stripe-samples/checkout-single-subscription) | Checkout/Billing and webhook sample structure | [MIT license](https://github.com/stripe-samples/checkout-single-subscription/blob/main/LICENSE) | Reference for final payment integration, not a plan catalog. Confirm whether Solta sells one-time work, subscriptions or both. [Fulfillment docs](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted) define verified payment and retry-safe provisioning. |
| [React Email](https://github.com/resend/react-email) | Branded invitation/message templates, compatible with Resend | Repository declares MIT; preserve LICENSE.md notice if adopted | Deferred with live email delivery. Templates still need brand/domain configuration, authorization, retry and delivery tracking. |
| [Pulseo](https://github.com/CustomDigitalServices-Kevin/pulseo-oss) | Ticket/document/tenant UI concepts and audit patterns | [MIT license](https://github.com/CustomDigitalServices-Kevin/pulseo-oss/blob/main/LICENSE) | Reference only for now. Full fork introduces Better Auth/Drizzle instead of KP's existing Supabase stack. README/test claims are not an independent security audit. |

No dependency version is selected until the actual Solta package manifest is inspected. MIT reuse permits commercial adaptation but requires retaining notices for substantial copied code. Missing/unclear licenses exclude copying. No candidate supplies our purchased-plan entitlement rules, payment-to-customer identity mapping or client/business isolation automatically.

## First implementation

The new allowlisted `projectPortalContent` projection is used by KP's authenticated client preview. Tests exercise injected private fields, internal messages, draft versions and private/pending attachment IDs. It prepares a client-facing data contract while retaining staff-only access. It does not expose an endpoint, connect the repositories, enable Stripe or activate client accounts.

Next: inspect Solta's actual repository and current branding, then adapt its components into the portal shell and onboarding. Configure final plan entitlements from the approved offer, separately test client membership/file isolation, and attach Stripe plus invitations last.
