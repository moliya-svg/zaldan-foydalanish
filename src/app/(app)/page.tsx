import { redirect } from "next/navigation";

// Бош саҳифа йўқ: сайт KO'RISH BRON дан очилади
export default function Home() {
  redirect("/korish");
}
