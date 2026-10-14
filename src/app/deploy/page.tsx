import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DeployDesk } from "@/components/deploy/DeployDesk";

// Owner tool, local only: on any public host this route is a 404.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const dynamic = "force-dynamic";
export const metadata = { title: "Deploy", robots: { index: false, follow: false } };

export default async function DeployPage() {
  const host = (await headers()).get("host") ?? "";
  if (!LOCAL_HOST.test(host)) notFound();
  return (
    <div className="wrap pt-12">
      <span className="band" />
      <h1 className="mt-4 text-[34px] font-bold">Deploy ONIXS</h1>
      <p className="mt-3 max-w-3xl text-[15.5px] leading-relaxed text-ink-2">
        Owner tool on this machine only. The connected wallet deploys every contract and becomes the Charter owner, so it can list the
        three stocks. Sixteen transactions, about 15.8M gas; keep around 0.005 ETH in the wallet. Progress is saved in this browser, so a
        closed tab resumes where it stopped. Nothing here is linked from the site.
      </p>
      <DeployDesk />
    </div>
  );
}
