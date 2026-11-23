import type { Metadata } from "next";
import { TableroView } from "@/components/board/TableroView";

export const metadata: Metadata = { title: "Tablero" };

export default function TableroPage() {
  return <TableroView />;
}
