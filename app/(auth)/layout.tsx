interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-compass-bg flex items-center justify-center p-4">
      {/* Tło — subtelna siatka */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #EAE8DF 1px, transparent 1px),
            linear-gradient(to bottom, #EAE8DF 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  )
}
