import { Noto_Sans_Lao } from "next/font/google";

// Self-hosted Google font used across the Notes UI (renders Lao script cleanly).
export const notoLao = Noto_Sans_Lao({
  subsets: ["lao", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
