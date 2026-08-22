import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppProvider } from "@/components/AppContext";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("tw_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AppProvider
      initialMe={{
        id: user.id,
        email: user.email ?? "",
        displayName: profile?.display_name ?? "",
      }}
    >
      <AppShell />
    </AppProvider>
  );
}
