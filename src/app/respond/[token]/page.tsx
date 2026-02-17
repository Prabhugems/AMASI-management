import { redirect } from "next/navigation"

export default async function RespondPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/speaker/${token}`)
}
