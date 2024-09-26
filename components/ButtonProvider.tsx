import { signIn } from "next-auth/react";
import { useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { SiMicrosoftazure } from "react-icons/si";
import { Button } from "./ui/button";

const ButtonsProvider = () => {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (provider: string) => {
    setLoading(true); // Démarre le loader
    try {
      await signIn(provider, {
        callbackUrl: "/home",
      }); // Appelez le fournisseur d'authentification ici
    } catch (error) {
      setLoading(false); // Si une erreur se produit, arrêtez le loader
      console.error("Erreur lors de la connexion :", error);
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-4">
        <Button
          onClick={() => handleSignIn("azure-ad")}
          className="w-full bg-primary-50 p-6 flex items-center justify-center"
          disabled={loading}
        >
          {loading ? (
            <FaSpinner className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <SiMicrosoftazure className="h-4 w-4 mr-2" />
          )}
          <p className="text-white">Se connecter avec mon compte ESPI</p>
        </Button>
      </div>
    </>
  );
};

export default ButtonsProvider;
