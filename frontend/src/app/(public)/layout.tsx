import NavBar from '@/components/layout/NavBar'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <NavBar />
      <main id="main-content">{children}</main>
    </>
  )
}
