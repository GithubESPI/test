import { ArrowDown } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";


const Hero = () => {
  return (
    <div className="text-center">
      <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6 lg:text-6xl">
        Générer vos bulletins
        <br />
        scolaires
      </h1>

      <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
        Simplifiez la gestion et la distribution aux apprenants,
        <br />
        avec notre application innovante.
      </p>

      <Link href="#templates">
        <Button className="inline-flex items-center bg-wtm-button-linear rounded-lg px-10 py-5 shadow-wtm-button-shadow hover:bg-wtm-button-linear-reverse transition">
          <ArrowDown className="mr-2" size={20} />
          Comment faire ?
        </Button>
      </Link>
    </div>
  );
};

export default Hero;