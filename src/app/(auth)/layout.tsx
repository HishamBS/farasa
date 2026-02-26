export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[--bg-root] flex items-center justify-center">
      {children}
    </main>
  )
}
