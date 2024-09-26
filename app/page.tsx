"use client";

import ButtonProvider from "@/components/ButtonProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerUrl } from "@/lib/getServerUrl";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Page() {
  const { status } = useSession();
  const router = useRouter();
  const serverUrl = getServerUrl();

  if (status === "authenticated") {
    // Example usage of serverUrl
    fetch(`${serverUrl}/api/auth/providers`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("Providers:", data);
      })
      .catch((error) => {
        console.error("Error fetching providers:", error);
      });
    if (process.env.NODE_ENV === "production") {
      router.push("/home");
    }
  }

  return (
    <main className="relative h-screen w-full">
      <div className="absolute size-full">
        <Image
          src="/images/background.png"
          alt="background"
          fill
          className="size-full"
          loading="lazy"
        />
      </div>
      <div className="flex-center glassmorphism-auth h-screen w-full">
        <div className="flex items-center justify-center min-h-screen p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <Image
                src="/images/logo.png"
                alt="logo"
                width={125}
                height={125}
                className="m-auto"
              />
            </CardHeader>

            <CardContent>
              <CardTitle className="text-2xl font-bold text-center text-gray-800">
                Connectez-vous
              </CardTitle>
              <CardDescription className="text-center pb-8 pt-3">
                Pour continuer sur l&apos;application des bulletin
              </CardDescription>
              <ButtonProvider />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
