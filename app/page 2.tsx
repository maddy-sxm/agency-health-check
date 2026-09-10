import { Suspense } from "react";
import AgencyHealthCheckExperience from "@/components/AgencyHealthCheckExperience";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AgencyHealthCheckExperience />
    </Suspense>
  );
}
