import Link from "next/link";

export default function NotFound() {
  return (
    <section className="wrap py-28">
      <span className="band" />
      <h1 className="mt-4 font-display text-[44px] font-black" style={{ fontStretch: "120%" }}>
        Not on the board
      </h1>
      <p className="mt-3 max-w-md text-ink-2">This page does not exist. The markets and the docs are one click away.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/app" className="btn">
          Markets
        </Link>
        <Link href="/docs" className="btn btn-line">
          Docs
        </Link>
      </div>
    </section>
  );
}
