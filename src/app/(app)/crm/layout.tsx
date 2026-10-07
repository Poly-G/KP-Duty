import { CrmTabs } from "@/components/crm/crm-tabs";

export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CrmTabs />
      {children}
    </>
  );
}
