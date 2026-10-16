import AppShell from "@/app/app-shell";
import PersonHistoryClient from "./person-history-client";
import { canReadPersonHistory } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";

type Props = { params: Promise<{ id: string }> };
export default async function PersonPage({ params }: Props) { const { id } = await params; return <AppShell active="Personal">{canReadPersonHistory(await getPageUser()) ? <PersonHistoryClient personId={id} /> : <><h1>Ficha individual</h1><p className="error">No autorizado para consultar el historial formativo.</p></>}</AppShell>; }
