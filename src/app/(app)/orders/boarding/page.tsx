import { OrdersList } from "@/components/orders-list";

export default async function BoardingOrdersPage(props: PageProps<"/orders/boarding">) {
  const searchParams = await props.searchParams;
  const status = typeof searchParams.status === "string" ? searchParams.status : "all";
  const date = typeof searchParams.date === "string" ? searchParams.date : undefined;

  return <OrdersList queueType="BOARDING" basePath="/orders/boarding" status={status} date={date} />;
}
