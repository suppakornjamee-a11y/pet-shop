import { LiffPaymentView } from "@/components/liff-payment-view";

export default async function Page(props: PageProps<"/liff/pay/[id]">) {
  const { id } = await props.params;
  return <LiffPaymentView orderId={id} />;
}
