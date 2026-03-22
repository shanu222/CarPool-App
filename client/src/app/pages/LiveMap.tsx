import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import RideMap from "../components/Map";

export function LiveMap() {
  const navigate = useNavigate();

  return (
    <div className="relative">
      <button
        onClick={() => navigate(-1)}
        className="fixed top-4 left-4 z-[700] rounded-xl bg-white/90 px-3 py-2 text-sm shadow"
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
