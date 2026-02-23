import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

interface SpecialSourceControlsProps {
  onSignalAirClick: () => void;
  onMobileAirClick: () => void;
  isSignalAirVisible: boolean;
  isMobileAirVisible: boolean;
  onSignalAirToggle: (visible: boolean) => void;
  onMobileAirToggle: (visible: boolean) => void;
  hasSignalAirData: boolean;
  hasMobileAirData: boolean;
}

const SpecialSourceControls: React.FC<SpecialSourceControlsProps> = ({
  onSignalAirClick,
  onMobileAirClick,
  isSignalAirVisible,
  isMobileAirVisible,
  onSignalAirToggle,
  onMobileAirToggle,
  hasSignalAirData,
  hasMobileAirData,
}) => {
  const { t } = useTranslation();
  // Détecter si on est sur mobile (breakpoint sm = 640px)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  // Position initiale : en dessous de la barre de recherche
  const getInitialPosition = () => {
    return {
      x: 1005,
      y: 119,
    };
  };

  const [position, setPosition] = useState(getInitialPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Charger la position et l'état collapsed depuis localStorage au montage
  useEffect(() => {
    const savedPosition = localStorage.getItem("specialSourceControlsPosition");
    if (savedPosition) {
      try {
        const { x, y } = JSON.parse(savedPosition);
        setPosition({ x, y });
      } catch (e) {
        // Ignorer les erreurs de parsing, utiliser la position initiale
      }
    }
    
    const savedCollapsed = localStorage.getItem("specialSourceControlsCollapsed");
    if (savedCollapsed) {
      try {
        setIsCollapsed(JSON.parse(savedCollapsed));
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }
  }, []);

  // Ajuster la position initiale si aucune position n'est sauvegardée (après le premier rendu)
  useEffect(() => {
    const savedPosition = localStorage.getItem("specialSourceControlsPosition");
    if (!savedPosition) {
      // Si aucune position sauvegardée, utiliser la position initiale fixe
      setPosition({
        x: 1005,
        y: 119,
      });
    }
  }, []);

  // Sauvegarder la position dans localStorage
  useEffect(() => {
    localStorage.setItem(
      "specialSourceControlsPosition",
      JSON.stringify(position)
    );
  }, [position]);

  // Sauvegarder l'état collapsed dans localStorage
  useEffect(() => {
    localStorage.setItem(
      "specialSourceControlsCollapsed",
      JSON.stringify(isCollapsed)
    );
  }, [isCollapsed]);

  // Ajuster la position lors du redimensionnement de la fenêtre
  useEffect(() => {
    const adjustPosition = () => {
      if (containerRef.current) {
        const maxX = window.innerWidth - containerRef.current.offsetWidth;
        const maxY = window.innerHeight - containerRef.current.offsetHeight;

        setPosition((prev) => ({
          x: Math.max(0, Math.min(prev.x, maxX)),
          y: Math.max(0, Math.min(prev.y, maxY)),
        }));
      }
    };

    // Ajuster la position au montage (après le premier rendu)
    adjustPosition();

    // Ajuster la position lors du redimensionnement
    window.addEventListener("resize", adjustPosition);

    return () => {
      window.removeEventListener("resize", adjustPosition);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setIsDragging(true);
      setDragStart({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Ne pas démarrer le drag si on clique sur un bouton
    const target = e.target as HTMLElement;
    if (target.closest("button") && !target.closest(".drag-handle")) {
      return;
    }
    
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Ne pas démarrer le drag si on touche un bouton
    const target = e.target as HTMLElement;
    if (target.closest("button") && !target.closest(".drag-handle")) {
      return;
    }
    
    const touch = e.touches[0];
    if (touch) {
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }
  };

  useEffect(() => {
    const updatePosition = (clientX: number, clientY: number) => {
      if (isDragging && containerRef.current) {
        const newX = clientX - dragStart.x;
        const newY = clientY - dragStart.y;

        // Limiter la position aux limites de la fenêtre
        const maxX = window.innerWidth - (containerRef.current.offsetWidth || 200);
        const maxY = window.innerHeight - (containerRef.current.offsetHeight || 150);

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        updatePosition(touch.clientX, touch.clientY);
        e.preventDefault();
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, dragStart]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-[1600] flex flex-col",
        // Désactiver les transitions SEULEMENT pendant le drag pour un suivi immédiat
        isDragging ? "select-none opacity-90" : "transition-all duration-300",
        isCollapsed ? "gap-1.5" : "gap-2.5",
        // Largeur maximale sur mobile pour éviter le débordement
        "max-w-[calc(100vw-16px)] sm:max-w-none"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      role="toolbar"
      aria-label="Contrôles des sources spéciales"
    >
      {/* Conteneur principal avec fond unifié */}
      <div
        className={cn(
          "relative bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/80",
          "transition-all duration-300",
          isCollapsed ? "p-1.5 sm:p-2" : "p-2.5 sm:p-3",
          "hover:shadow-3xl hover:border-gray-300/80"
        )}
      >
        {/* Header avec zone de drag intégrée et bouton collapse */}
        <div className={cn(
          "flex items-center justify-between transition-all duration-300 relative",
          isCollapsed ? "mb-1" : "mb-1.5 sm:mb-2"
        )}>
          {/* Zone de drag intégrée dans le header */}
          <div
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 cursor-grab active:cursor-grabbing drag-handle",
              "px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg transition-all duration-200",
              "hover:bg-gray-100/80 active:bg-gray-200 touch-manipulation",
              "group/drag"
            )}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            title="Glisser pour déplacer le panneau"
            aria-label="Zone de déplacement"
          >
            {/* Icône de drag avec lignes horizontales */}
            <div className="flex flex-col gap-1 opacity-60 group-hover/drag:opacity-100 transition-opacity">
              <div className={cn(
                "bg-gray-400 group-hover/drag:bg-gray-600 rounded-full transition-colors",
                isCollapsed ? "w-3 h-0.5" : "w-4 h-0.5"
              )} />
              <div className={cn(
                "bg-gray-400 group-hover/drag:bg-gray-600 rounded-full transition-colors",
                isCollapsed ? "w-3 h-0.5" : "w-4 h-0.5"
              )} />
              <div className={cn(
                "bg-gray-400 group-hover/drag:bg-gray-600 rounded-full transition-colors",
                isCollapsed ? "w-3 h-0.5" : "w-4 h-0.5"
              )} />
            </div>
            {!isCollapsed && (
              <h3 className="font-semibold text-gray-700 text-xs sm:text-sm select-none">
                Sources spéciales
              </h3>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gray-100 hover:bg-gray-200",
              "text-gray-600 hover:text-gray-800 flex items-center justify-center",
              "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400/50",
              "active:scale-95 touch-manipulation",
              isCollapsed && "ml-auto"
            )}
            aria-label={isCollapsed ? "Développer les contrôles" : "Réduire les contrôles"}
            aria-expanded={!isCollapsed}
          >
            <svg
              className={cn(
                "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300",
                isCollapsed && "rotate-180"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Liste des boutons */}
        <div className={cn("flex flex-col", isCollapsed ? "gap-1 sm:gap-1.5" : "gap-1.5 sm:gap-2")}>
          {/* Bouton SignalAir */}
          <div
            className={cn(
              "relative group rounded-xl transition-all duration-200",
              "border-2",
              hasSignalAirData
                ? "border-[#13A0DB]/30 bg-[#13A0DB]/5 hover:border-[#13A0DB]/50 hover:bg-[#13A0DB]/10"
                : "border-transparent bg-gray-50/50 hover:bg-gray-100/50 hover:border-gray-200"
            )}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={onSignalAirClick}
                className={cn(
                  "flex items-center flex-1 rounded-lg transition-all duration-200",
                  "hover:bg-[#13A0DB]/5 focus:outline-none focus:ring-2 focus:ring-[#13A0DB]/30 focus:ring-offset-2",
                  "active:scale-[0.98] touch-manipulation",
                  isCollapsed 
                    ? "gap-0 p-2 sm:p-2.5" 
                    : "gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-3"
                )}
                aria-label={t("panels.openSignalAirSelection")}
              >
                {/* Icône SignalAir SVG */}
                <div className={cn(
                  "flex-shrink-0 transition-all duration-200",
                  isCollapsed ? "w-4 h-4 sm:w-5 sm:h-5" : "w-5 h-5 sm:w-6 sm:h-6"
                )}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 792 612"
                    className="w-full h-full"
                    aria-hidden="true"
                  >
                    <path
                      d="M380.866,538.315L380.866,471.282C401.428,470.066,419.964,462.064,434.247,448.896L491.914639,519.188078C488.16663900000003,524.2530780000001,484.823639,529.419078,484.823639,536.003078C484.823639,544.714078,487.863639,552.007078,493.838639,557.882078C499.91663900000003,563.858078,507.108639,566.796078,515.515639,566.796078C523.922639,566.796078,531.215639,563.858078,537.192639,557.882078C543.269639,552.007078,546.207639,544.613078,546.207639,536.003078C546.207639,527.5950780000001,543.168639,520.404078,537.192639,514.427078C531.114639,508.452078,523.922639,505.514078,515.515639,505.514078C508.931639,505.514078,503.765639,508.85707799999994,498.599639,512.4020780000001L440.629,441.603C444.883,436.64,448.529,431.17,451.568,425.295L572.481928,479.81335C570.758928,484.77735,569.442928,489.84235,569.442928,495.51435C569.442928,509.59435,574.304928,521.34435,584.1299280000001,530.96635C593.955928,540.58935,605.603928,545.35035,619.277928,545.35035C632.952928,545.35035,644.702928,540.58935,654.426928,530.96635C664.251928,521.34435,669.113928,509.59435,669.113928,495.51435C669.113928,481.84035,664.251928,470.19135,654.426928,460.56835C644.601928,450.94535,632.952928,446.18435,619.277928,446.18435C605.603928,446.18435,593.853928,450.94535,584.1299280000001,460.56835C580.8889280000001,463.80935,578.963928,467.55735,576.7359280000001,471.20435L456.024,416.786C459.772,407.063,462.305,396.731,462.305,385.791C462.305,370.394,457.24,356.821,450.149,344.261L581.239503,260.737097C582.555503,262.357097,583.164503,264.282097,584.683503,265.801097C594.509503,275.424097,606.157503,280.185097,619.831503,280.185097C633.506503,280.185097,645.256503,275.424097,654.980503,265.801097C664.805503,256.178097,669.667503,244.428097,669.667503,230.349097C669.667503,216.674097,664.805503,205.026097,654.980503,195.403097C645.155503,185.780097,633.506503,181.019097,619.831503,181.019097C606.157503,181.019097,594.407503,185.780097,584.683503,195.403097C574.858503,205.026097,569.996503,216.674097,569.996503,230.349097C569.996503,238.756097,572.326503,246.151097,575.871503,252.937097L444.883,336.462C440.932,330.89,436.881,325.724,431.715,321.268L519.105747,207.88322200000002C522.3467469999999,209.40122200000002,525.2847469999999,212.035222,529.133747,212.035222C535.9197469999999,212.035222,541.795747,209.60422200000002,546.757747,204.844222C551.6207469999999,200.083222,554.050747,194.106222,554.050747,187.117222C554.050747,180.33122200000003,551.6207469999999,174.45622200000003,546.757747,169.695222C541.896747,164.934222,536.021747,162.50322200000002,529.133747,162.50322200000002C522.3467469999999,162.50322200000002,516.4717469999999,164.934222,511.508747,169.695222C506.646747,174.45622200000003,504.215747,180.33122200000003,504.215747,187.117222C504.215747,193.499222,506.84974700000004,198.665222,510.900747,203.22322200000002L423.915,316.001C412.165,307.897,398.794,302.529,383.803,301.211C386.032,266.57,384.819,230.190091,385.933,206.690091C390.896,205.880091,395.758,204.866091,399.505,201.119091C404.368,196.358091,406.798,190.382091,406.798,183.392091C406.798,176.606091,404.368,170.731091,399.505,165.970091C394.644,161.210091,388.769,158.778091,381.881,158.778091C375.094,158.778091,369.219,161.210091,364.256,165.970091C359.394,170.731091,356.963,176.606091,356.963,183.392091C356.963,190.382091,359.394,196.358091,364.256,201.119091C367.599,204.461091,372.156,205.069091,376.411,206.082091C375.297,228.063091,376.612,263.227,374.282,300.098C371.749,300.199,369.521,301.313,366.988,301.617L339.073223,131.237808C347.378223,129.10980800000002,355.177223,125.665808,361.661223,119.183808C371.486223,109.560808,376.347223,97.810808,376.347223,83.73096290000001C376.347223,70.05636290000001,371.486223,58.4077629,361.661223,48.7849629C351.835223,39.162262899999995,340.186223,34.4014629,326.512223,34.4014629C312.837223,34.4014629,301.087223,39.162262899999995,291.363223,48.7849629C281.538223,58.4077629,276.676223,70.05636290000001,276.676223,83.73096290000001C276.676223,97.810808,281.538223,109.560808,291.363223,119.183808C301.188223,128.805808,312.837223,133.566808,326.512223,133.566808C327.728223,133.566808,328.639223,133.060808,329.753223,132.958808L357.67,303.44C338.019,307.897,321.306,318.229,309.252,333.524L209.44054400000002,263.60395C210.757544,260.56595,213.188544,258.13495,213.188544,254.48795C213.188544,247.70195,210.757544,241.82695,205.895544,237.06595C201.032544,232.30495000000002,195.157544,229.87495,188.269544,229.87495C181.382544,229.87495,175.608544,232.30495000000002,170.645544,237.06595C165.783544,241.82695,163.35154400000002,247.70195,163.35154400000002,254.48795C163.35154400000002,261.47794999999996,165.783544,267.45394999999996,170.645544,272.21495C175.507544,276.97595,181.382544,279.40594999999996,188.269544,279.40594999999996C194.955544,279.40594999999996,200.627544,276.97595,205.388544,272.41695L303.884,341.425C298.819,349.528,295.578,358.139,293.349,367.761C267.924,363.507,236.63346,357.76704,216.47546,354.12004C216.78046,351.89204,217.69146,349.96704,217.69146,347.63704C217.69146,333.96304000000003,212.82946,322.31404000000003,203.00446,312.69104000000004C193.17846,303.06804,181.53046,298.30704000000003,167.85646,298.30704000000003C154.18146000000002,298.30704000000003,142.43146000000002,303.06804,132.70746,312.69104000000004C122.8824417,322.31404000000003,118.0204417,333.96304000000003,118.0204417,347.63704C118.0204417,361.71704,122.8824417,373.46704,132.70746,383.08904C142.53246000000001,392.71204,154.18146000000002,397.47304,167.85646,397.47304C181.53046,397.47304,193.28046,392.71204,203.00446,383.08904C208.77846,377.41704000000004,212.32346,370.73204000000004,214.65246000000002,363.54004000000003C231.46746000000002,366.68004,261.746,372.319,291.424,377.182C291.121,380.22,289.703,382.854,289.703,385.993C289.703,431.879,325.864,468.648,371.142,471.18L371.142,538.214C366.786,539.126,362.735,540.746,359.392,544.089C354.833,548.546,352.504,554.015,352.504,560.3960000000001C352.504,566.98,354.833,572.552,359.392,577.009C363.949,581.466,369.521,583.7950000000001,375.903,583.7950000000001C382.284,583.7950000000001,387.855,581.566,392.412,577.009C396.971,572.552,399.301,566.98,399.301,560.3960000000001C399.301,554.015,396.971,548.546,392.412,544.089C389.273,540.847,385.221,539.126,380.866,538.315Z"
                      fill="#13A0DB"
                      transform="translate(410.705,319.5) translate(-395.705,-319.27)"
                    />
                  </svg>
                </div>
                {!isCollapsed && (
                  <span className="text-xs sm:text-sm font-semibold text-gray-800 flex-1 text-left">
                    SignalAir
                  </span>
                )}
              </button>
              
              {/* Toggle de visibilité */}
              {hasSignalAirData && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSignalAirToggle(!isSignalAirVisible);
                  }}
                  className={cn(
                    "flex-shrink-0 transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-[#13A0DB]/30 focus:ring-offset-2 rounded-lg",
                    "active:scale-95 touch-manipulation",
                    isCollapsed 
                      ? "w-2.5 h-2.5 rounded-full mr-1 sm:mr-2"
                      : "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold mr-1 sm:mr-2"
                  )}
                  aria-label={
                    isSignalAirVisible
                      ? t("panels.hideSignalAir")
                      : t("panels.showSignalAir")
                  }
                  aria-pressed={isSignalAirVisible}
                >
                  {isCollapsed ? (
                    <div
                      className={cn(
                        "w-full h-full rounded-full transition-colors",
                        isSignalAirVisible ? "bg-emerald-500" : "bg-gray-400"
                      )}
                    />
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center min-w-[24px]",
                        isSignalAirVisible
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      )}
                    >
                      {isSignalAirVisible ? "✓" : "✕"}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Bouton MobileAir */}
          <div
            className={cn(
              "relative group rounded-xl transition-all duration-200",
              "border-2",
              hasMobileAirData
                ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10"
                : "border-transparent bg-gray-50/50 hover:bg-gray-100/50 hover:border-gray-200"
            )}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={onMobileAirClick}
                className={cn(
                  "flex items-center flex-1 rounded-lg transition-all duration-200",
                  "hover:bg-green-500/5 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:ring-offset-2",
                  "active:scale-[0.98] touch-manipulation",
                  isCollapsed 
                    ? "gap-0 p-2 sm:p-2.5" 
                    : "gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-3"
                )}
                aria-label={t("panels.openMobileAirSelection")}
              >
                {/* Icône MobileAir SVG */}
                <div className={cn(
                  "flex-shrink-0 text-green-600 transition-all duration-200",
                  isCollapsed ? "w-4 h-4 sm:w-5 sm:h-5" : "w-5 h-5 sm:w-6 sm:h-6"
                )}>
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    className="w-full h-full"
                    aria-hidden="true"
                  >
                    <rect
                      x="5"
                      y="4"
                      width="14"
                      height="16"
                      rx="2"
                      ry="2"
                      strokeWidth={1.5}
                    />
                    <path
                      strokeLinecap="round"
                      strokeWidth={1.5}
                      d="M9 8h6M9 12h6M9 16h3"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 16c1.2-1 1.2-3 0-4"
                    />
                  </svg>
                </div>
                {!isCollapsed && (
                  <span className="text-xs sm:text-sm font-semibold text-gray-800 flex-1 text-left">
                    MobileAir
                  </span>
                )}
              </button>
              
              {/* Toggle de visibilité */}
              {hasMobileAirData && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMobileAirToggle(!isMobileAirVisible);
                  }}
                  className={cn(
                    "flex-shrink-0 transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:ring-offset-2 rounded-lg",
                    "active:scale-95 touch-manipulation",
                    isCollapsed 
                      ? "w-2.5 h-2.5 rounded-full mr-1 sm:mr-2"
                      : "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold mr-1 sm:mr-2"
                  )}
                  aria-label={
                    isMobileAirVisible
                      ? t("panels.hideMobileAir")
                      : t("panels.showMobileAir")
                  }
                  aria-pressed={isMobileAirVisible}
                >
                  {isCollapsed ? (
                    <div
                      className={cn(
                        "w-full h-full rounded-full transition-colors",
                        isMobileAirVisible ? "bg-emerald-500" : "bg-gray-400"
                      )}
                    />
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center min-w-[24px]",
                        isMobileAirVisible
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      )}
                    >
                      {isMobileAirVisible ? "✓" : "✕"}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecialSourceControls;
