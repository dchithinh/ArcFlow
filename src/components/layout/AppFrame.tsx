import type { ReactNode } from "react";

type AppFrameProps = {
  header: ReactNode;
  children: ReactNode;
};

export const AppFrame = ({ header, children }: AppFrameProps) => (
  <div className="min-h-screen px-4 py-6 text-ink md:px-6 lg:px-8">
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-panel backdrop-blur">{header}</header>
      <main>{children}</main>
    </div>
  </div>
);
