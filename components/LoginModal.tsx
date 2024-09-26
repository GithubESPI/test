import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import Image from "next/image";
import { type Dispatch, type SetStateAction } from "react";
// import Confetti from "react-dom-confetti";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
const LoginModal = ({
  isOpen,
  setIsOpen,
  title,
  description,
  children,
  onImportClick, // Nouvelle prop pour le clic du bouton d'importation
  isImporting, // Indicateur de progression de l'importation
}: {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  title: string;
  description: string;
  children: React.ReactNode;
  onImportClick?: () => void; // Nouvelle prop pour l'action d'importation
  isImporting?: boolean; // Pour indiquer si l'importation est en cours
}) => {
  // const [showConfetti, setShowConfetti] = useState<boolean>(false);

  // useEffect(() => {
  //   setShowConfetti(true);
  // }, []);
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 overflow-hidden flex justify-center"
      >
        {" "}
        {/* <Confetti active={showConfetti} config={{ elementCount: 400, spread: 150 }} /> */}
      </div>
      <Dialog onOpenChange={setIsOpen} open={isOpen}>
        <DialogContent className="absolute z-[9999999]">
          <DialogHeader>
            <div className="relative mx-auto w-22 h-29 mb-2">
              <Image
                src="/images/logo.png"
                alt="ESPI logo"
                width={200}
                height={200}
                className="object-contain"
                loading="lazy"
              />
            </div>
            <DialogTitle className="text-3xl text-center font-bold tracking-tight text-gray-900">
              {title}
            </DialogTitle>
            <DialogDescription className="text-base text-center py-2">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">{children}</div>

          {onImportClick && (
            <div className="mt-8 flex justify-center">
              <Button
                className="px-4 sm:px-6 lg:px-8"
                onClick={onImportClick}
                disabled={isImporting}
              >
                {isImporting ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  "Envoyer les bulletins sur Yparéo"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoginModal;
