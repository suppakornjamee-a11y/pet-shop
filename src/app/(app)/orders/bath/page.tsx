import { OrdersList } from "@/components/orders-list";

export default async function BathOrdersPage(props: PageProps<"/orders/bath">) {
  const searchParams = await props.searchParams;
  const status = typeof searchParams.status === "string" ? searchParams.status : "all";

  return (
    <OrdersList queueType="BATH" basePath="/orders/bath" bookHref="/calendar" status={status} />
  );
}
