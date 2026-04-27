import React from "react";
import { useDomainConfig } from "../hooks/useDomainConfig";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFavicon } from "../hooks/useFavicon";

const MaintenancePage: React.FC = () => {
  const domainConfig = useDomainConfig();
  const contactUrl = domainConfig.links.contact;

  useFavicon(domainConfig.favicon);
  useDocumentTitle(`Maintenance - ${domainConfig.title}`);

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
            Maintenance en cours
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
            La plateforme est temporairement indisponible pendant une opération
            de maintenance. Nous faisons le nécessaire pour rétablir le service
            dans les meilleurs délais.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Merci de réessayer un peu plus tard.
          </p>

          {contactUrl && (
            <a
              href={contactUrl}
              className="mt-8 inline-flex items-center justify-center rounded-lg bg-[#4271B3] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#325A96] focus:outline-none focus:ring-2 focus:ring-[#4271B3]/30 focus:ring-offset-2"
            >
              Contacter {domainConfig.organization}
            </a>
          )}
        </div>
      </div>
    </main>
  );
};

export default MaintenancePage;
