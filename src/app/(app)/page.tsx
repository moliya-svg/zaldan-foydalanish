import { redirect } from "next/navigation";

// Бош саҳифа йўқ: сайт «Банд зал ва хоналар» (/korish) дан очилади
export default function Home() {
  redirect("/korish");
}
