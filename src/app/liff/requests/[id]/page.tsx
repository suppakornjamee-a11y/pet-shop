import { LiffRequestView } from "@/components/liff-booking/request-view";

export default async function Page(props: PageProps<"/liff/requests/[id]">) {
  const { id } = await props.params;
  const { order } = await props.searchParams;
  return <LiffRequestView requestId={id} initialOrderId={typeof order === "string" ? order : undefined} />;
}
