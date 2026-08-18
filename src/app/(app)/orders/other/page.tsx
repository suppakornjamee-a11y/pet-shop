import { OrdersList } from "@/components/orders-list";

export default async function OtherOrdersPage(props: PageProps<"/orders/other">) {
  const searchParams = await props.searchParams;
  const status = typeof searchParams.status === "string" ? searchParams.status : "all";

  return (
    <OrdersList
      queueType="OTHER"
      basePath="/orders/other"
      bookHref="/calendar-other"
      status={status}
    />
  );
}
