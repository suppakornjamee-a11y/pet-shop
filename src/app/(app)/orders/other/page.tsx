import { OrdersList } from "@/components/orders-list";

export default async function OtherOrdersPage(props: PageProps<"/orders/other">) {
  const searchParams = await props.searchParams;
  const status = typeof searchParams.status === "string" ? searchParams.status : "all";
  const date = typeof searchParams.date === "string" ? searchParams.date : undefined;

  return <OrdersList queueType="OTHER" basePath="/orders/other" status={status} date={date} />;
}
