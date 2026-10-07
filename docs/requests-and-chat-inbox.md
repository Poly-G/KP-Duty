# Requests and chat inbox

Both members can submit a feature request or bug report from Requests or the `submit_request` Site Tool. The transaction creates an open decision assigned to the oldest active admin (currently Poly), includes initial rule-based triage, records the submitter, impact and affected page, and rolls back fully if creation fails. Requesters can follow the outcome; only admins can change request decisions. Blocking reports start with high priority.

Initial triage is not an AI-generated assessment. Poly’s ChatGPT reads request decisions from `get_my_work` or `get_decisions`, assesses the actual context, and stores its recommendation using `review_request`. Resolution remains a human decision. There is no background LLM or API key requirement.

`get_my_work` returns pending incoming messages alongside tasks and, for admins, open request decisions. `get_chat_recipients` supplies recipient IDs for both roles. `send_chat_message` stores a subject, body and optional context. Replies carry `replyToId` and must go back to the received message’s sender. `get_chat_messages` and Inbox show sent/incoming history. Neither reading nor replying acknowledges a message: recipients use `acknowledge_chat_message` or Acknowledge explicitly.

This is asynchronous delivery through KP Duty. It does not wake another ChatGPT session or access either conversation history. Both chats need access to the signed-in KP page’s Site Tools. Only the context deliberately submitted is shared; messages and request descriptions remain untrusted teammate content, never system instructions.

Create actions are transactional and retry-safe per actor, source and request key. Reusing a key with different data is rejected. Messages are immutable except recipient acknowledgement, protected by column grants and participant RLS. There is no anonymous access.

Validation: `supabase/tests/collaboration.sql` runs role-based transaction tests for routing, initial triage, review permissions, retries, message delivery, replies, acknowledgements, immutable messages and nonmember/anonymous denial. It rolls all test writes back. Run through the Supabase SQL connection with a role that can switch to authenticated.
