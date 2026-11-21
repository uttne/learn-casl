import { Console } from "@/app/console";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Scylla</h1>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          画面の機能は契約で表示を決め、ABAC で有効か無効かを決めます。データは{" "}
          <code>/api</code> から取得し、API 自体へのアクセス、行の where、項目のマスクまたは置換の順で制御します。
        </p>
      </header>
      <Console />
    </main>
  );
}
