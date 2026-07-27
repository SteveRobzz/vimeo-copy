import { getCurrentUser } from "@/lib/auth";
import LoopHeader from "@/components/loop-header";
import UploadClient from "./upload-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <LoopHeader userLabel={user.name ?? user.email} />
      <main className="flex-1">
        <UploadClient />
      </main>
    </div>
  );
}
