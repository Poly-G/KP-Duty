import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeWorkSummary } from "@/components/work/home-work-summary";
import { PageHeading } from "@/components/page-heading";
import { listMyWork } from "@/modules/work/queries";

export default async function HomePage() {
  const tasks = await listMyWork();

  return (
    <>
      <PageHeading
        eyebrow="Home"
        title="What needs your attention?"
        description="Same rule as the SnD Command Center: show current work and what needs attention next, not a wall of metrics."
      />

      <HomeWorkSummary tasks={tasks} />

      <Link
        href="/work"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
      >
        Open Work
        <ArrowRight size={15} />
      </Link>
    </>
  );
}
