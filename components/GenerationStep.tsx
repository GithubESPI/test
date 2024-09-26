import { Sparkles, Upload } from "lucide-react";
import Image from "next/image";

interface GenerationStepProps {
  icon: "upload" | "sparkles" | "download";
  description: string;
}

const GenerationStep: React.FC<GenerationStepProps> = () => {
  return (
    <div className="space-y-12pt-10 lg:pt-[72px] lg:space-y-20">
      <div className="sm:flexsm:justify-start sm:items-center gap-10 justify-center items-centertext-base-content-primary">
        <div className="flex flex-colgap-5 w-full tlg:w-1/2">
          <div className="w-14h-14 bg-violet-100 rounded-xl flex flex-col justify-center items-center">
            <Upload />
          </div>
          <div>
            <h3 className="text-neutral-900text-xl lg:text-3xl font-bold leading-relaxed lg:leading-10">
              <span className="text-primary-50">Téléchargement</span>des Fichiers Excel etWord
            </h3>
            <p className="sm:mb-8sm:mt-4 sm:text-sm text-justify">
              Téléchargezvos fichiers Excel et Word contenant les données nécessaires
              <br />
              {""}(notes, informations sur les apprenants, appréciations) provenant d&apos;Yparéo.{" "}
              <br />
              Ces fichiers serviront de base pour la génération des bulletins.
            </p>
          </div>
        </div>
        <div className="flex flex-coljustify-center w-full tlg:w-1/2">
          <div className="max-w-[921px]m-auto bg-white lg:p-6 p-3 rounded-2xl shadow-wtm-image-compare-shadowsm:mt-10">
            <div className="h-autow-full">
              <div className="flexjustify-center items-center">
                <div className="w-full">
                  <div className="relative cursor-pointer">
                    <video
                      autoPlay
                      controls
                      width="320"
                      height="240"
                      src="/videos/video-1.mp4"
                      className="relative w-full rounded-2xlslider-feature-split-line rendered"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sm:flexsm:justify-start sm:items-center gap-10 justify-center items-centertext-base-content-primary flex-row-reverse">
        <div className="flex flex-colgap-5 w-full tlg:w-1/2">
          <div className="w-14h-14 bg-cyan-50 rounded-xl flex flex-col justify-center items-center">
            <Sparkles />
          </div>
          <div>
            <h3 className="text-neutral-900text-xl lg:text-3xl font-bold leading-relaxed lg:leading-10">
              <span className="text-primary-50">Lancer</span>la Génération des Bulletins
            </h3>
            <p className="sm:mb-8sm:mt-4 sm:text-sm text-justify">
              Cliquez sur le bouton <span className="text-primary-50">Générer vos bulletins </span>{" "}
              pour lancer le processus. Déposer votre document Word et Excel, puis le système va
              automatiquement traiter les fichiers Excel et Word pour créer des bulletins denotes au
              format PDF.
            </p>
          </div>
        </div>
        <div className="flex flex-coljustify-center w-full tlg:w-1/2">
          <div className="max-w-[921px]m-auto bg-white lg:p-6 p-3 rounded-2xl shadow-wtm-image-compare-shadowsm:mt-10">
            <div className="h-autow-full">
              <div className="flexjustify-center items-center">
                <div className="w-full">
                  <div className="relative cursor-pointer">
                    <video
                      autoPlay
                      controls
                      width="320"
                      height="240"
                      src="/videos/video-2.mp4"
                      className="relative w-full rounded-2xlslider-feature-split-line rendered"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sm:flexsm:justify-start sm:items-center gap-10 justify-center items-centertext-base-content-primary">
        <div className="flex flex-colgap-5 w-full tlg:w-1/2">
          <div className="w-14h-14 bg-violet-100 rounded-xl flex flex-col justify-center items-center">
            <Upload />
          </div>
          <div>
            <h3 className="text-neutral-900text-xl lg:text-3xl font-bold leading-relaxed lg:leading-10">
              <span className="text-primary-50">Téléchargement</span>des Bulletins Générés
            </h3>
            <p className="sm:mb-8sm:mt-4 sm:text-sm text-justify">
              Une foisla génération terminée, téléchargez tous les bulletins sous forme defichier
              ZIP.
              <br /> Cela vous permet de récupérer l&apos;ensemble des bulletins en un seulfichier
              compressé.
            </p>
          </div>
        </div>
        <div className="flexflex-col justify-center w-full tlg:w-1/2">
          <div className="max-w-[921px]m-auto bg-white lg:p-6 p-3 rounded-2xl shadow-wtm-image-compare-shadowsm:mt-10">
            <div className="h-autow-full">
              <div className="flexjustify-center items-center">
                <div className="w-full">
                  <div className="relative cursor-pointer">
                    <Image
                      src="https://assets.dewatermark.ai/images/watermark-remover/new/featureComparison/before_2.webp"
                      alt="video1"
                      width={921} // Spécifiez la largeur
                      height={518} // Spécifiez la hauteur
                      layout="responsive" // Maintient un ratio réactif
                      className="relative w-full rounded-2xl slider-feature-split-line rendered"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sm:flexsm:justify-start sm:items-center gap-10 justify-center items-centertext-base-content-primary flex-row-reverse">
        <div className="flex flex-colgap-5 w-full tlg:w-1/2">
          <div className="w-14h-14 bg-cyan-50 rounded-xl flex flex-col justify-center items-center">
            <Sparkles />
          </div>
          <div>
            <h3 className="text-neutral-900text-xl lg:text-3xl font-bold leading-relaxed lg:leading-10">
              <span className="text-primary-50">Importation</span>des Bulletins dans Yparéo
            </h3>
            <p className="sm:mb-8sm:mt-4 sm:text-sm text-justify">
              Cliquezsur le bouton <span className="text-primary-50">Envoyer surYparéo </span> pour
              importer les bulletins générés directement dans le système Yparéo. Le système associe
              chaque bulletin à l&apos;apprenant concerné grâce à un identifiant unique.
            </p>
          </div>
        </div>
        <div className="flex flex-coljustify-center w-full tlg:w-1/2">
          <div className="max-w-[921px]m-auto bg-white lg:p-6 p-3 rounded-2xl shadow-wtm-image-compare-shadowsm:mt-10">
            <div className="h-autow-full">
              <div className="flexjustify-center items-center">
                <div className="w-full">
                  <div className="relative cursor-pointer">
                    <Image
                      src="https://assets.dewatermark.ai/images/watermark-remover/new/featureComparison/before_2.webp"
                      alt="video2"
                      width={921}
                      height={518}
                      layout="responsive"
                      className="relative w-full rounded-2xl slider-feature-split-line rendered"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerationStep;
