import { RepairsView } from "./repairs-view";

export const metadata = { title: "Mantenimiento" };

export default function MaintenancePage() {
  return <RepairsView kind="reparacion" />;
}
