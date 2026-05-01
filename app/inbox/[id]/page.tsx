import EmailDetailClient from './EmailDetailClient'

// In Next.js 15, params is a Promise — resolve it in this server component
// and pass the id as a plain prop to the client component.
export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EmailDetailClient id={id} />
}
