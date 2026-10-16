import AppShell from "@/app/app-shell";
import NewSessionClient from "./new-session-client";
type Props = { params: Promise<{ id: string }> };
export default async function NewSessionPage({ params }: Props) { return <AppShell active="Formaciones"><NewSessionClient trainingId={(await params).id} /></AppShell>; }
