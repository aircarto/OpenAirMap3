import { useState, useEffect } from "react";
import { SignalAirReport } from "../../../types";
import L from "leaflet";

interface UseSignalAirProps {
  signalAirHasLoaded: boolean;
  signalAirReportsCount: number;
  isSignalAirLoading: boolean;
  reports: SignalAirReport[];
  mapRef: React.RefObject<L.Map | null>;
  isEnabled?: boolean;
  /** Mode historique avec signalements chargés : 0 dans fenêtre courante ≠ aucune donnée */
  isHistoricalModeWithSignalAirData?: boolean;
}

export const useSignalAir = ({
  signalAirHasLoaded,
  signalAirReportsCount,
  isSignalAirLoading,
  reports,
  mapRef,
  isEnabled = false,
  isHistoricalModeWithSignalAirData = false,
}: UseSignalAirProps) => {
  const [selectedSignalAirReport, setSelectedSignalAirReport] =
    useState<SignalAirReport | null>(null);
  const [isSignalAirDetailPanelOpen, setIsSignalAirDetailPanelOpen] =
    useState(false);
  const [signalAirDetailPanelSize, setSignalAirDetailPanelSize] = useState<
    "normal" | "fullscreen" | "hidden"
  >("normal");
  const [signalAirFeedback, setSignalAirFeedback] = useState<string | null>(
    null
  );

  // Extinction de SignalAir : le panneau de détail et le feedback survivraient
  // sinon à la disparition des marqueurs qui les justifient.
  useEffect(() => {
    if (isEnabled) return;

    setIsSignalAirDetailPanelOpen(false);
    setSignalAirDetailPanelSize("normal");
    setSelectedSignalAirReport(null);
    setSignalAirFeedback(null);
  }, [isEnabled]);

  // Effet pour gérer le feedback quand aucun signalement n'est trouvé
  useEffect(() => {
    if (signalAirHasLoaded && signalAirReportsCount === 0) {
      if (isHistoricalModeWithSignalAirData) {
        setSignalAirFeedback(
          "Aucun signalement dans la fenêtre temporelle courante. Naviguez sur la timeline pour en voir."
        );
      } else {
        setSignalAirFeedback(
          "Aucun signalement SignalAir n'a été trouvé pour la période sélectionnée."
        );
      }
      setIsSignalAirDetailPanelOpen(false);
      setSelectedSignalAirReport(null);
    } else if (signalAirReportsCount > 0) {
      setSignalAirFeedback(null);
    }
  }, [signalAirHasLoaded, signalAirReportsCount, isHistoricalModeWithSignalAirData]);

  // Effet pour nettoyer le feedback pendant le chargement
  useEffect(() => {
    if (isSignalAirLoading) {
      setSignalAirFeedback(null);
    }
  }, [isSignalAirLoading]);

  // Effet pour vérifier que le rapport sélectionné existe toujours
  useEffect(() => {
    if (!selectedSignalAirReport) {
      return;
    }

    const exists = reports.some(
      (report) => report.id === selectedSignalAirReport.id
    );

    if (!exists) {
      setSelectedSignalAirReport(null);
      setIsSignalAirDetailPanelOpen(false);
      setSignalAirDetailPanelSize("normal");
    }
  }, [reports, selectedSignalAirReport]);

  // Handlers
  const handleSignalAirMarkerClick = (report: SignalAirReport) => {
    setSelectedSignalAirReport(report);
    setIsSignalAirDetailPanelOpen(true);
    setSignalAirDetailPanelSize("normal");

    if (mapRef.current) {
      mapRef.current.panTo([report.latitude, report.longitude], {
        animate: true,
        duration: 0.5,
      });
    }
  };

  const handleCloseSignalAirDetailPanel = () => {
    setIsSignalAirDetailPanelOpen(false);
    setSignalAirDetailPanelSize("normal");
    setSelectedSignalAirReport(null);
  };

  const handleSignalAirDetailPanelSizeChange = (
    newSize: "normal" | "fullscreen" | "hidden"
  ) => {
    setSignalAirDetailPanelSize(newSize);
    // Réactiver le panel si on change de "hidden" à autre chose
    if (newSize !== "hidden" && !isSignalAirDetailPanelOpen) {
      setIsSignalAirDetailPanelOpen(true);
    }
  };

  const handleCenterOnSignalAirReport = (report: SignalAirReport) => {
    if (mapRef.current) {
      mapRef.current.panTo([report.latitude, report.longitude], {
        animate: true,
        duration: 0.5,
      });
    }
  };

  const handleDismissSignalAirFeedback = () => {
    setSignalAirFeedback(null);
  };

  return {
    // États
    selectedSignalAirReport,
    isSignalAirDetailPanelOpen,
    signalAirDetailPanelSize,
    signalAirFeedback,

    // Handlers
    handleSignalAirMarkerClick,
    handleCloseSignalAirDetailPanel,
    handleSignalAirDetailPanelSizeChange,
    handleCenterOnSignalAirReport,
    handleDismissSignalAirFeedback,
  };
};

