import React, { useEffect, useState } from "react";
import { useDomainConfig } from "../hooks/useDomainConfig";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFavicon } from "../hooks/useFavicon";

interface MaintenanceContent {
  title: string;
  message: string;
  details: string;
  contactLabel: string;
}

const DEFAULT_MAINTENANCE_CONTENT: MaintenanceContent = {
  title: "Maintenance en cours",
  message:
    "La plateforme est temporairement indisponible pendant une opération de maintenance. Nous faisons le nécessaire pour rétablir le service dans les meilleurs délais.",
  details: "Merci de réessayer un peu plus tard.",
  contactLabel: "Contacter l'équipe",
};

const normalizeMaintenanceContent = (
  content: Partial<MaintenanceContent>
): MaintenanceContent => ({
  title: content.title?.trim() || DEFAULT_MAINTENANCE_CONTENT.title,
  message: content.message?.trim() || DEFAULT_MAINTENANCE_CONTENT.message,
  details: content.details?.trim() || DEFAULT_MAINTENANCE_CONTENT.details,
  contactLabel:
    content.contactLabel?.trim() || DEFAULT_MAINTENANCE_CONTENT.contactLabel,
});

const MaintenancePage: React.FC = () => {
  const domainConfig = useDomainConfig();
  const contactUrl = domainConfig.links.contact;
  const [content, setContent] = useState<MaintenanceContent>(
    DEFAULT_MAINTENANCE_CONTENT
  );

  useFavicon(domainConfig.favicon);
  useDocumentTitle(`Maintenance - ${domainConfig.title}`);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/maintenance.json", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Configuration maintenance indisponible");
        }
        return response.json() as Promise<Partial<MaintenanceContent>>;
      })
      .then((maintenanceContent) => {
        setContent(normalizeMaintenanceContent(maintenanceContent));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setContent(DEFAULT_MAINTENANCE_CONTENT);
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center text-center">
        <img
          src={domainConfig.logo}
          alt={`${domainConfig.organization} logo principal`}
          className="mb-8 h-14 max-w-full object-contain sm:h-16"
        />

        <div className="rounded-2xl border border-blue-100 bg-white/90 px-6 py-8 shadow-xl shadow-blue-950/5 backdrop-blur sm:px-10 sm:py-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#4271B3]">
            {domainConfig.title}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {content.title}
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
            {content.message}
          </p>
          <p className="mt-4 text-sm text-slate-500">
            {content.details}
          </p>

          {contactUrl && (
            <a
              href={contactUrl}
              className="mt-8 inline-flex items-center justify-center rounded-lg bg-[#4271B3] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#325A96] focus:outline-none focus:ring-2 focus:ring-[#4271B3]/30 focus:ring-offset-2"
            >
              {content.contactLabel}
            </a>
          )}
        </div>
      </div>
    </main>
  );
};

export default MaintenancePage;
