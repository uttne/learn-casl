import { Workspace } from "@/app/workspace";

export default function Home() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[100rem] flex-col px-4 py-4">
      <Workspace />
    </main>
  );
}
