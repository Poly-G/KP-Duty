import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RecentActivity } from "@/components/activity/recent-activity";
import { HomeWorkSummary } from "@/components/work/home-work-summary";
import { PageHeading } from "@/components/page-heading";
import { listMyWork } from "@/modules/work/queries";
import { listRecentActivity } from "@/modules/projects/queries";

import { listChatMessages } from "@/modules/collaboration/service";

export default async function HomePage() {
  const [tasks, activity, messages] = await Promise.all([
    listMyWork(),
    listRecentActivity(8),
    listChatMessages(true),
  ]);

  return (
    <>
      <PageHeading
        eyebrow="Home"
        title="What needs your attention?"
        description="Same rule as the SnD Command Center: show current work and what needs attention next, not a wall of metrics."
      />

      <div className="mb-5 flex flex-wrap gap-4 text-sm"><Link href="/inbox" className="underline">{messages.length} pending chat messages</Link><Link href="/requests" className="underline">Suggest a feature or report a bug</Link></div>
      <HomeWorkSummary tasks={tasks} />

      <div className="mt-5 flex gap-4">
        <Link
          href="/work"
          className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
        >
          Open Work
          <ArrowRight size={15} />
        </Link>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
        >
          Open Projects
          <ArrowRight size={15} />
        </Link>
      </div>

      <RecentActivity events={activity} />
    </>
  );
}
