import { LiffRequestView } from "@/components/liff-booking/request-view";

export default async function Page(props: PageProps<"/liff/requests/[id]">) {
  const { id } = await props.params;
  return <LiffRequestView requestId={id} />;
}
