import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import RideMap from "../components/Map";

export function LiveMap() {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-x-hidden">
      <button
        onClick={() => navigate(-1)}
        className="fixed left-3 top-3 z-[700] min-h-12 rounded-xl bg-white/90 px-3 py-2 text-sm md:text-base shadow md:left-4 md:top-4"
      >
        <span className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </span>
      </button>
      <RideMap />
    </div>
  );
}
