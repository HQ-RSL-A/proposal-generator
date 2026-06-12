import Image from "next/image";

export function OutcomeCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="document-page w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center">
        <Image src="/logomark.svg" alt="RSL/A" width={32} height={32} className="mx-auto" />
        <div className="mt-6 text-4xl">{icon}</div>
        <h1 className="font-heading mt-3 text-xl font-bold">{title}</h1>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <p className="mt-6 text-xs text-muted-foreground/70">
          Questions? Email{" "}
          <a href="mailto:lalia@rsla.io" className="underline">
            lalia@rsla.io
          </a>
        </p>
      </div>
    </div>
  );
}
