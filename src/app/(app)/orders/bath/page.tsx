import { OrdersList } from "@/components/orders-list";

export default async function BathOrdersPage(props: PageProps<"/orders/bath">) {
  const searchParams = await props.searchParams;
  const status = typeof searchParams.status === "string" ? searchParams.status : "all";
  const date = typeof searchParams.date === "string" ? searchParams.date : undefined;

  return <OrdersList queueType="BATH" basePath="/orders/bath" status={status} date={date} />;
}
